import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getOpenAI } from "@/lib/openai";
import { getAiPrompt } from "@/lib/ai-prompts";
import { pdfToBase64Images, imageContent, parseJsonContent } from "@/lib/pdf-vision-extractor";
import { hesaplaTutarlilik, skorKontrolToCheckResult } from "@/lib/tutarlilik-skoru";
import { BYPASS_AUTH_ROLES } from "@/lib/auth-bypass";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_SIZE   = 10 * 1024 * 1024;
const MAX_FILES  = 20;
const MAX_TOKENS = 16000; // beyanname/route.ts ile aynı

// ── Types ──────────────────────────────────────────────────────────────────

export interface Extraction {
  dosya_adi: string;
  belge_turu: string;
  mukellef: { unvan?: string; vergi_kimlik_no?: string; vergi_dairesi?: string } | string;
  donem: string;
  veriler: Array<{ alan: string; deger: string; birim?: string }>;
  failed?: boolean;
  failedReason?: string;
}

export interface CheckResult {
  name: string;
  detail: string;
  value1?: number;
  value1Label?: string;
  value2?: number;
  value2Label?: string;
  diff?: number;
  diffPercent?: number;
  status: "UYGUN" | "UYARI" | "BİLGİ";
}

// ── Helpers ────────────────────────────────────────────────────────────────

function safeStr(val: any): string {
  if (val == null) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (typeof val === "object") {
    const s = val.metin ?? val.text ?? val.unvan ?? val.value ?? val.deger ?? val.label ?? val.ad;
    if (s != null) return safeStr(s);
    return JSON.stringify(val);
  }
  return String(val);
}

// ── AI extraction per file ─────────────────────────────────────────────────

/** Mark extraction as failed; logs which specific field caused the failure. */
function markExtractionStatus(ext: Extraction, fileName: string): Extraction {
  const mk      = ext.mukellef;
  const unvan   = typeof mk === "object" ? safeStr((mk as any).unvan   ?? "") : safeStr(mk);
  const vergiNo = typeof mk === "object" ? safeStr((mk as any).vergi_kimlik_no ?? "") : "";
  const hasContent = ext.belge_turu.trim() !== "" || ext.veriler.length > 0 || unvan.trim() !== "" || vergiNo.trim() !== "";

  if (!hasContent) {
    const reason = "Beyanname verisi çıkarılamadı — GPT yanıtı tamamen boş";
    console.warn(`[capraz-kontrol] BAŞARISIZ dosya="${fileName}" neden="${reason}"`);
    return { ...ext, failed: true, failedReason: reason };
  }

  const missing: string[] = [];
  if (!ext.belge_turu.trim()) missing.push("belge türü");
  if (!ext.donem.trim())      missing.push("dönem bilgisi");
  if (!unvan.trim())          missing.push("mükellef unvanı");

  if (missing.length > 0) {
    const reason = `${missing.join(", ")} çıkarılamadı`;
    console.warn(`[capraz-kontrol] BAŞARISIZ dosya="${fileName}" eksik_alanlar=${JSON.stringify(missing)} neden="${reason}"`);
    return { ...ext, failed: true, failedReason: reason };
  }

  console.log(`[capraz-kontrol] BAŞARILI dosya="${fileName}" belge_turu="${ext.belge_turu}" donem="${ext.donem}" vkn="${vergiNo}" veriler=${ext.veriler.length}`);
  return { ...ext, failed: false };
}

async function extractFromFile(
  openai: any,
  file: File,
  basePrompt: string,
): Promise<Extraction> {
  const buffer = Buffer.from(await file.arrayBuffer());

  let pageImages: string[] = [];
  try {
    pageImages = await pdfToBase64Images(buffer);
  } catch {
    console.error(`[capraz-kontrol] PDF→görüntü hatası dosya="${file.name}"`);
    return {
      dosya_adi: file.name, belge_turu: "", mukellef: {}, donem: "", veriler: [],
      failed: true, failedReason: "PDF görüntüye dönüştürülemedi",
    };
  }

  console.log(`[capraz-kontrol] dosya="${file.name}" sayfa_sayisi=${pageImages.length}`);

  if (pageImages.length === 0) {
    console.warn(`[capraz-kontrol] 0 sayfa dosya="${file.name}" — bozuk PDF?`);
    return {
      dosya_adi: file.name, belge_turu: "", mukellef: {}, donem: "", veriler: [],
      failed: true, failedReason: "PDF sayfası okunamadı — dosya bozuk olabilir",
    };
  }

  const jsonSchema =
    `\n\nYanıtını YALNIZCA şu JSON formatında ver (başka alan ekleme):
{
  "belge_turu": "KDV / Muhtasar / Kurumlar Vergisi / Gelir Vergisi / SGK / Geçici Vergi / diğer",
  "mukellef": {"unvan": "", "vergi_kimlik_no": "", "vergi_dairesi": ""},
  "donem": "YYYY-MM veya YYYY formatında",
  "veriler": [{"alan": "...", "deger": "...", "birim": "TRY veya boş"}]
}`;

  const prompt = basePrompt + jsonSchema;

  try {
    let parsed: any;

    if (pageImages.length <= 2) {
      // ── Tek geçiş: tüm sayfalar aynı anda ─────────────────────────────────
      const response = await openai.chat.completions.create({
        model: "gpt-5.4-mini",
        messages: [{ role: "user", content: [{ type: "text", text: prompt }, ...pageImages.map(imageContent)] }],
        response_format: { type: "json_object" },
        temperature: 0,
        max_completion_tokens: MAX_TOKENS,
      });
      parsed = parseJsonContent(response.choices[0].message.content ?? "{}");
      console.log(`[capraz-kontrol] GPT yanıtı dosya="${file.name}" belge_turu="${parsed?.belge_turu}" donem=${JSON.stringify(parsed?.donem)} vkn="${parsed?.mukellef?.vergi_kimlik_no}" veriler=${parsed?.veriler?.length ?? 0} bolumler=${parsed?.bolumler?.length ?? "—"}`);
      return markExtractionStatus({ dosya_adi: file.name, ...parsed, veriler: parsed.veriler ?? [] }, file.name);
    }

    // ── Çok geçişli: sayfa 1 tam yapı, kalan sayfalar ek veriler ───────────
    const firstResp = await openai.chat.completions.create({
      model: "gpt-5.4-mini",
      messages: [{ role: "user", content: [{ type: "text", text: prompt }, imageContent(pageImages[0])] }],
      response_format: { type: "json_object" },
      temperature: 0,
      max_completion_tokens: MAX_TOKENS,
    });
    const first = parseJsonContent(firstResp.choices[0].message.content ?? "{}");
    console.log(`[capraz-kontrol] GPT geçiş-1 dosya="${file.name}" belge_turu="${first?.belge_turu}" donem=${JSON.stringify(first?.donem)} vkn="${first?.mukellef?.vergi_kimlik_no}" veriler=${first?.veriler?.length ?? 0}`);
    let allVeriler: any[] = first.veriler ?? [];

    for (let i = 1; i < pageImages.length; i++) {
      const extraPrompt = basePrompt +
        `\n\nBu sayfadaki TÜM veri alanlarını çıkar. YALNIZCA şu JSON formatında ver:\n{"veriler": [{"alan": "...", "deger": "...", "birim": "TRY veya boş"}]}`;
      const extraResp = await openai.chat.completions.create({
        model: "gpt-5.4-mini",
        messages: [{ role: "user", content: [{ type: "text", text: extraPrompt }, imageContent(pageImages[i])] }],
        response_format: { type: "json_object" },
        temperature: 0,
        max_completion_tokens: MAX_TOKENS,
      });
      const extra = parseJsonContent(extraResp.choices[0].message.content ?? "{}");
      console.log(`[capraz-kontrol] GPT geçiş-${i + 1} dosya="${file.name}" ek_veriler=${extra?.veriler?.length ?? 0}`);
      allVeriler = [...allVeriler, ...(extra.veriler ?? [])];
    }

    parsed = {
      belge_turu: first.belge_turu ?? "",
      mukellef:   first.mukellef  ?? {},
      donem:      first.donem     ?? "",
      veriler:    allVeriler,
    };
    return markExtractionStatus({ dosya_adi: file.name, ...parsed }, file.name);
  } catch (err: any) {
    console.error(`[capraz-kontrol] AI hatası dosya="${file.name}"`, err?.message ?? err);
    return {
      dosya_adi: file.name, belge_turu: "", mukellef: {}, donem: "", veriler: [],
      failed: true, failedReason: "AI yanıtı alınamadı",
    };
  }
}


// ── Route handler ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const openai = getOpenAI();

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
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
  try { formData = await req.formData(); }
  catch { return NextResponse.json({ error: "Geçersiz istek formatı" }, { status: 400 }); }

  const files = formData.getAll("files[]") as File[];
  if (!files || files.length === 0)
    return NextResponse.json({ error: "En az bir dosya yükleyin" }, { status: 400 });
  if (files.length > MAX_FILES)
    return NextResponse.json({ error: `En fazla ${MAX_FILES} dosya yüklenebilir` }, { status: 400 });

  for (const file of files) {
    if (file.type !== "application/pdf")
      return NextResponse.json({ error: `"${file.name}" PDF değil` }, { status: 400 });
    if (file.size > MAX_SIZE)
      return NextResponse.json({ error: `"${file.name}" 10MB'ı geçemez` }, { status: 400 });
  }

  const basePrompt = await getAiPrompt("BEYANNAME");

  try {
    const extractions: Extraction[] = [];
    let failedCount  = 0;
    let successCount = 0;
    for (const file of files) {
      const ext = await extractFromFile(openai, file, basePrompt);
      extractions.push(ext);
      if (ext.failed) failedCount++; else successCount++;
    }

    // Tutarlılık skoru (tek-belge + çapraz; başarısızlar filtre edilir)
    const tutarlilik = hesaplaTutarlilik(extractions as any[]);
    const checks: CheckResult[] = tutarlilik.kontroller.map(skorKontrolToCheckResult);

    return NextResponse.json({ extractions, checks, failedCount, successCount, tutarlilik });
  } catch (err: any) {
    console.error("[capraz-kontrol] Hata:", err?.status, err?.code, err?.message);
    return NextResponse.json(
      { error: "İşlem sırasında hata: " + (err?.message ?? "Bilinmeyen hata") },
      { status: err?.status ?? 500 },
    );
  }
}
