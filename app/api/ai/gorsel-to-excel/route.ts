import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getOpenAI } from "@/lib/openai";
import { getAiPrompt } from "@/lib/ai-prompts";
import { extractText } from "unpdf";

export const dynamic = "force-dynamic";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VISION_PAGES = 6;

async function pdfToBase64Images(buffer: Buffer): Promise<string[]> {
  const { pdf } = await import("pdf-to-img");
  const images: string[] = [];
  const document = await pdf(buffer, { scale: 2 });
  let page = 0;
  for await (const img of document) {
    if (page >= MAX_VISION_PAGES) break;
    images.push((img as Buffer).toString("base64"));
    page++;
  }
  return images;
}

function parseJsonContent(content: string): any {
  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); }
      catch { throw new Error("Model yanıtı eksik geldi, dosyayı daha küçük parçalara bölün."); }
    }
    throw new Error("Geçersiz yanıt formatı.");
  }
}

export async function POST(req: NextRequest) {
  const openai = getOpenAI();

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }

  const { role, department } = token as any;
  if (role !== "ADMIN" && department !== "BAGIMSIZ_DENETIM") {
    return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek formatı" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "Dosya bulunamadı" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Dosya boyutu 10MB'ı geçemez" }, { status: 400 });
  }

  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: "Yalnızca JPG, PNG, WEBP veya PDF dosyaları desteklenmektedir" }, { status: 400 });
  }

  try {
    const prompt = await getAiPrompt("TARAYICI") + "\n\nYanıtını JSON formatında ver.";
    const buffer = Buffer.from(await file.arrayBuffer());

    if (file.type === "application/pdf") {
      // Try text extraction first
      const { text: pdfText } = await extractText(new Uint8Array(buffer), { mergePages: true });

      if (pdfText?.trim() && pdfText.trim().length >= 50) {
        // Text-based path — single call
        const messageContent = [
          {
            type: "text",
            text: `${prompt}\n\nBelge içeriği:\n${pdfText.slice(0, 8000)}`,
          },
        ];

        const response = await openai.chat.completions.create({
          model: "gpt-5.4-nano",
          messages: [{ role: "user", content: messageContent }],
          response_format: { type: "json_object" },
          max_completion_tokens: 8000,
        });

        const result = parseJsonContent(response.choices[0].message.content ?? "{}");

        if (!Array.isArray(result.headers) || !Array.isArray(result.rows)) {
          return NextResponse.json(
            { error: "Görsel analiz edildi ancak tablo yapısı çıkarılamadı. Daha net bir görsel deneyin" },
            { status: 422 }
          );
        }

        return NextResponse.json(result);
      }

      // Vision path — convert pages then process each separately
      let pageImages: string[];
      try {
        pageImages = await pdfToBase64Images(buffer);
      } catch (e: any) {
        return NextResponse.json(
          { error: "PDF sayfaları görüntüye dönüştürülemedi: " + (e?.message ?? "bilinmeyen hata") },
          { status: 422 }
        );
      }

      if (pageImages.length === 0) {
        return NextResponse.json(
          { error: "PDF'den sayfa okunamadı. Dosya bozuk olabilir." },
          { status: 422 }
        );
      }

      // Process first page — extract full structure (headers + rows + metadata)
      const firstResponse = await openai.chat.completions.create({
        model: "gpt-5.4-nano",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:image/png;base64,${pageImages[0]}`, detail: "high" } },
          ],
        }],
        response_format: { type: "json_object" },
        max_completion_tokens: 8000,
      });

      const firstResult = parseJsonContent(firstResponse.choices[0].message.content ?? "{}");

      if (!Array.isArray(firstResult.headers) || !Array.isArray(firstResult.rows)) {
        return NextResponse.json(
          { error: "Görsel analiz edildi ancak tablo yapısı çıkarılamadı. Daha net bir görsel deneyin" },
          { status: 422 }
        );
      }

      const headers: string[] = firstResult.headers;
      const allRows: any[][] = [...firstResult.rows];

      // Process remaining pages — extract only rows using the same column structure
      for (let i = 1; i < pageImages.length; i++) {
        const pagePrompt =
          `Bu tablo belgesinin ${i + 1}. sayfasıdır. ` +
          `Sütun başlıkları sırasıyla: ${headers.join(", ")}. ` +
          `Yalnızca bu sayfadaki tablo satırlarını aynı sütun sırasıyla çıkar. ` +
          `Başlık satırı ekleme. Sadece şu JSON formatında döndür: {"rows": [[...], ...]}`;

        const pageResponse = await openai.chat.completions.create({
          model: "gpt-5.4-nano",
          messages: [{
            role: "user",
            content: [
              { type: "text", text: pagePrompt },
              { type: "image_url", image_url: { url: `data:image/png;base64,${pageImages[i]}`, detail: "high" } },
            ],
          }],
          response_format: { type: "json_object" },
          max_completion_tokens: 8000,
        });

        const pageResult = parseJsonContent(pageResponse.choices[0].message.content ?? "{}");
        if (Array.isArray(pageResult.rows) && pageResult.rows.length > 0) {
          allRows.push(...pageResult.rows);
        }
      }

      return NextResponse.json({ ...firstResult, rows: allRows });
    }

    // Single image path — one call
    const base64 = buffer.toString("base64");
    const mimeType = file.type as "image/jpeg" | "image/png" | "image/webp";
    const messageContent = [
      { type: "text", text: prompt },
      {
        type: "image_url",
        image_url: { url: `data:${mimeType};base64,${base64}`, detail: "high" },
      },
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-5.4-nano",
      messages: [{ role: "user", content: messageContent }],
      response_format: { type: "json_object" },
      max_completion_tokens: 8000,
    });

    const result = parseJsonContent(response.choices[0].message.content ?? "{}");

    if (!Array.isArray(result.headers) || !Array.isArray(result.rows)) {
      return NextResponse.json(
        { error: "Görsel analiz edildi ancak tablo yapısı çıkarılamadı. Daha net bir görsel deneyin" },
        { status: 422 }
      );
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[gorsel-to-excel]", err);
    if (err?.code === "invalid_api_key") {
      return NextResponse.json({ error: "OpenAI API anahtarı geçersiz" }, { status: 500 });
    }
    return NextResponse.json(
      { error: "Görsel işlenirken bir hata oluştu. Lütfen tekrar deneyin" },
      { status: 500 }
    );
  }
}
