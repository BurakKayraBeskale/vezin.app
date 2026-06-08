import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getOpenAI } from "@/lib/openai";
import { getAiPrompt } from "@/lib/ai-prompts";

export const dynamic = "force-dynamic";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VISION_PAGES = 6;
// 1-2 sayfa: tek çağrı, 3+ sayfa: sayfa sayfa işle
const PAGED_THRESHOLD = 2;

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

function imageContent(b64: string) {
  return { type: "image_url" as const, image_url: { url: `data:image/png;base64,${b64}`, detail: "high" as const } };
}

export async function POST(req: NextRequest) {
  const openai = getOpenAI();

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }

  const { role, department } = token as any;
  if (role !== "ADMIN" && department !== "YEMINLI_MALI_MUSAVIR") {
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
  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "Yalnızca PDF dosyaları desteklenmektedir" }, { status: 400 });
  }

  const prompt = await getAiPrompt("BEYANNAME") + "\n\nYanıtını JSON formatında ver.";

  try {
    const buffer = Buffer.from(await file.arrayBuffer());

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

    // ── 1-2 sayfa: tek çağrıda tüm sayfalar ─────────────────────────────────
    if (pageImages.length <= PAGED_THRESHOLD) {
      const response = await openai.chat.completions.create({
        model: "gpt-5.4-mini",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            ...pageImages.map(imageContent),
          ],
        }],
        response_format: { type: "json_object" },
        temperature: 0,
        max_completion_tokens: 16000,
      });

      const parsed = parseJsonContent(response.choices[0].message.content ?? "{}");
      return NextResponse.json({ data: parsed });
    }

    // ── 3+ sayfa: sayfa sayfa işle ───────────────────────────────────────────

    // Sayfa 1: tam yapı (mukellef, donem, bolumler, ozet)
    const firstResponse = await openai.chat.completions.create({
      model: "gpt-5.4-mini",
      messages: [{
        role: "user",
        content: [
          { type: "text", text: prompt },
          imageContent(pageImages[0]),
        ],
      }],
      response_format: { type: "json_object" },
      temperature: 0,
      max_completion_tokens: 16000,
    });

    const firstResult = parseJsonContent(firstResponse.choices[0].message.content ?? "{}");
    const allBolumler: any[] = Array.isArray(firstResult.bolumler) ? [...firstResult.bolumler] : [];

    // Sayfa 2-N: sadece bölümler
    for (let i = 1; i < pageImages.length; i++) {
      const pagePrompt = `Sayfa ${i + 1}. Sadece bu sayfadaki beyanname bölümlerini ve satırlarını çıkar. {"bolumler": [...]}`;

      const pageResponse = await openai.chat.completions.create({
        model: "gpt-5.4-mini",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: pagePrompt },
            imageContent(pageImages[i]),
          ],
        }],
        response_format: { type: "json_object" },
        temperature: 0,
        max_completion_tokens: 16000,
      });

      const pageResult = parseJsonContent(pageResponse.choices[0].message.content ?? "{}");
      if (Array.isArray(pageResult.bolumler) && pageResult.bolumler.length > 0) {
        allBolumler.push(...pageResult.bolumler);
      }
    }

    // Özet: tüm birleşik bölümlerden
    let ozet = firstResult.ozet ?? null;
    if (allBolumler.length > 0) {
      const ozetPrompt =
        `Aşağıdaki beyanname bölümlerine göre özet oluştur. Sadece {"ozet": {...}} döndür:\n\n` +
        JSON.stringify({ bolumler: allBolumler }).slice(0, 6000);

      const ozetResponse = await openai.chat.completions.create({
        model: "gpt-5.4-mini",
        messages: [{ role: "user", content: ozetPrompt }],
        response_format: { type: "json_object" },
        temperature: 0,
        max_completion_tokens: 4000,
      });

      const ozetResult = parseJsonContent(ozetResponse.choices[0].message.content ?? "{}");
      if (ozetResult.ozet) ozet = ozetResult.ozet;
    }

    const merged = {
      ...firstResult,
      bolumler: allBolumler,
      ...(ozet !== null ? { ozet } : {}),
    };

    return NextResponse.json({ data: merged });
  } catch (err: any) {
    console.error(
      "[beyanname] Hata:",
      err?.status, err?.code, err?.message,
      JSON.stringify(err?.error ?? err)
    );
    return NextResponse.json(
      {
        error: "Belge analiz edilirken bir hata oluştu.",
        debug: {
          status:  err?.status  ?? null,
          code:    err?.code    ?? null,
          message: err?.message ?? "Bilinmeyen hata",
          detail:  err?.error   ?? null,
        },
      },
      { status: err?.status ?? 500 }
    );
  }
}
