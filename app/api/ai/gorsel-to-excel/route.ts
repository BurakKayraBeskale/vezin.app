import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getOpenAI } from "@/lib/openai";
import { getAiPrompt } from "@/lib/ai-prompts";
import { extractText } from "unpdf";

export const dynamic = "force-dynamic";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VISION_PAGES = 6;

async function pdfToBase64Images(arrayBuffer: ArrayBuffer): Promise<string[]> {
  const { pdf } = await import("pdf-to-img");
  const images: string[] = [];
  const document = await pdf(Buffer.from(arrayBuffer), { scale: 2 });
  let page = 0;
  for await (const img of document) {
    if (page >= MAX_VISION_PAGES) break;
    images.push((img as Buffer).toString("base64"));
    page++;
  }
  return images;
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
    const arrayBuffer = await file.arrayBuffer();
    let messageContent: any[];

    if (file.type === "application/pdf") {
      // Try text extraction first
      const pdfBuffer = new Uint8Array(arrayBuffer);
      const { text: pdfText } = await extractText(pdfBuffer, { mergePages: true });

      if (pdfText?.trim() && pdfText.trim().length >= 50) {
        // Text-based path
        messageContent = [
          {
            type: "text",
            text: `${prompt}\n\nBelge içeriği:\n${pdfText.slice(0, 8000)}`,
          },
        ];
      } else {
        // Fallback: convert pages to PNG and send via vision
        let pageImages: string[];
        try {
          pageImages = await pdfToBase64Images(arrayBuffer);
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

        messageContent = [
          { type: "text", text: prompt },
          ...pageImages.map((b64) => ({
            type: "image_url" as const,
            image_url: { url: `data:image/png;base64,${b64}`, detail: "high" as const },
          })),
        ];
      }
    } else {
      const base64 = Buffer.from(arrayBuffer).toString("base64");
      const mimeType = file.type as "image/jpeg" | "image/png" | "image/webp";
      messageContent = [
        { type: "text", text: prompt },
        {
          type: "image_url",
          image_url: { url: `data:${mimeType};base64,${base64}`, detail: "high" },
        },
      ];
    }

    const response = await openai.chat.completions.create({
      model: "gpt-5.4-nano",
      messages: [{ role: "user", content: messageContent }],
      response_format: { type: "json_object" },
      max_completion_tokens: 4000,
    });

    const raw = response.choices[0].message.content ?? "{}";
    const result = JSON.parse(raw);

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
