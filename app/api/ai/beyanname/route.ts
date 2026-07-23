import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getOpenAI } from "@/lib/openai";
import { getAiPrompt } from "@/lib/ai-prompts";
import { pdfToBase64Images, imageContent } from "@/lib/pdf-vision-extractor";
import { hesaplaTutarlilik } from "@/lib/tutarlilik-skoru";
import { BYPASS_AUTH_ROLES } from "@/lib/auth-bypass";

export const dynamic = "force-dynamic";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
// 1-2 sayfa: tek çağrı, 3+ sayfa: sayfa sayfa işle
const PAGED_THRESHOLD = 2;

// Tek-dosya route'unda başarısız JSON sert hata fırlatır (çok-dosya capraz-kontrol'den farklı).
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
  // DEBUG — gerçek token değerlerini logla (karşılaştırma tamamlanınca kaldır)
  const { email: _dbgEmail } = token as any;
  console.log('[auth] user:', _dbgEmail, '| role:', (token as any).role, '| dept:', (token as any).department, '| api:', req.nextUrl?.pathname ?? req.url);

  // GEÇİCİ: tüm giriş yapmış kullanıcılara açık
  // TODO: Aşağıdaki bloğu uncomment ederek Admin+YMM kısıtına geri dön
  // const { role, department } = token as any;
  // if (role !== "ADMIN" && department !== "YEMINLI_MALI_MUSAVIR") {
  //   return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
  // }

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
      const tutarlilik = hesaplaTutarlilik(parsed);
      return NextResponse.json({ data: parsed, tutarlilik });
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
      const pagePrompt = `Sayfa ${i + 1}. Sadece bu sayfadaki beyanname bölümlerini ve satırlarını çıkar. Çıktıyı geçerli JSON formatında döndür: {"bolumler": [...]}`;

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
        `Aşağıdaki beyanname bölümlerine göre özet oluştur. Çıktıyı geçerli JSON formatında döndür, sadece {"ozet": {...}} ver:\n\n` +
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

    const tutarlilik = hesaplaTutarlilik(merged);
    return NextResponse.json({ data: merged, tutarlilik });
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
