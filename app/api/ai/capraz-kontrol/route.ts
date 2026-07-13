import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getOpenAI } from "@/lib/openai";
import { getAiPrompt } from "@/lib/ai-prompts";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_SIZE = 10 * 1024 * 1024;
const MAX_VISION_PAGES = 4;
const MAX_FILES = 20;

// ── Types ──────────────────────────────────────────────────────────────────

export interface Extraction {
  dosya_adi: string;
  belge_turu: string;
  mukellef: { unvan?: string; vergi_kimlik_no?: string; vergi_dairesi?: string } | string;
  donem: string;
  veriler: Array<{ alan: string; deger: string; birim?: string }>;
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

function toNum(val: any): number {
  const s = safeStr(val).replace(/[^0-9.,-]/g, "").replace(",", ".");
  return parseFloat(s) || 0;
}

function parseJsonContent(content: string): any {
  try { return JSON.parse(content); } catch { /* fall through */ }
  const match = content.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch { /* fall through */ }
  }
  return {};
}

function imageContent(b64: string) {
  return {
    type: "image_url" as const,
    image_url: { url: `data:image/png;base64,${b64}`, detail: "high" as const },
  };
}

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

/** Find highest-value field matching any keyword in veriler */
function findField(veriler: any[], keywords: string[]): number {
  const candidates: number[] = [];
  for (const v of veriler ?? []) {
    const alan = safeStr(v.alan ?? v.ad ?? "").toLowerCase();
    for (const kw of keywords) {
      if (alan.includes(kw)) {
        const n = toNum(v.deger ?? v.tutar ?? v.value ?? 0);
        if (n > 0) candidates.push(n);
        break;
      }
    }
  }
  // Return max candidate (avoids picking a partial subtotal)
  return candidates.length > 0 ? Math.max(...candidates) : 0;
}

function getVergiNo(ext: Extraction): string {
  const mk = ext.mukellef;
  if (!mk) return "";
  if (typeof mk === "string") return "";
  return safeStr(mk.vergi_kimlik_no ?? "");
}

function hasType(extractions: Extraction[], ...keywords: string[]): boolean {
  return extractions.some(e =>
    keywords.some(kw => (e.belge_turu ?? "").toLowerCase().includes(kw))
  );
}

function findByType(extractions: Extraction[], ...keywords: string[]): Extraction | undefined {
  return extractions.find(e =>
    keywords.some(kw => (e.belge_turu ?? "").toLowerCase().includes(kw))
  );
}

// ── Cross-check engine ────────────────────────────────────────────────────

function runChecks(extractions: Extraction[]): CheckResult[] {
  const results: CheckResult[] = [];

  // 1. Vergi no tutarlılığı
  const vergiNos = extractions.map(getVergiNo).filter(Boolean);
  if (vergiNos.length > 1) {
    const unique = [...new Set(vergiNos)];
    if (unique.length > 1) {
      results.push({
        name: "Mükellef Vergi No Tutarlılığı",
        detail: `Farklı vergi numaraları tespit edildi: ${unique.join(", ")} — karışık mükellef riski`,
        status: "UYARI",
      });
    } else {
      results.push({
        name: "Mükellef Vergi No Tutarlılığı",
        detail: `Tüm beyannamelerde aynı: ${unique[0]}`,
        status: "UYGUN",
      });
    }
  }

  // 2. Aynı tür beyanname çakışması
  const typeCounts: Record<string, number> = {};
  for (const e of extractions) {
    const tur = (e.belge_turu ?? "").trim().toLowerCase();
    if (tur) typeCounts[tur] = (typeCounts[tur] ?? 0) + 1;
  }
  for (const [tur, count] of Object.entries(typeCounts)) {
    if (count > 1) {
      results.push({
        name: `Dönem Çakışması: ${tur.toUpperCase()}`,
        detail: `Aynı türden ${count} beyanname yüklendi — dönem çakışması olabilir`,
        status: "UYARI",
      });
    }
  }

  // 3. Muhtasar ücret matrahı ↔ SGK prime esas kazanç
  const muhtasar = findByType(extractions, "muhtasar", "stopaj");
  const sgk      = findByType(extractions, "sgk", "sosyal güvenlik", "bildirge");
  if (muhtasar && sgk) {
    const muhtasarMatrah = findField(muhtasar.veriler, [
      "ücret ödemeleri", "ücret stopaj", "ücret matrah", "brüt ücret", "maaş", "ücret",
    ]);
    const sgkPrime = findField(sgk.veriler, [
      "prime esas kazanç", "prime esas", "sigorta primine esas", "brüt kazanç", "kazanç",
    ]);
    if (muhtasarMatrah > 0 && sgkPrime > 0) {
      const diff       = Math.abs(muhtasarMatrah - sgkPrime);
      const diffPct    = (diff / Math.max(muhtasarMatrah, sgkPrime)) * 100;
      const status     = diffPct > 10 ? "UYARI" : "UYGUN";
      results.push({
        name: "Muhtasar Ücret Matrahı ↔ SGK Prime Esas Kazanç",
        detail: diffPct > 10
          ? `%${diffPct.toFixed(1)} fark tespit edildi — eşik %10, kontrol gerekli`
          : `%${diffPct.toFixed(1)} fark — kabul edilebilir`,
        value1: muhtasarMatrah, value1Label: "Muhtasar Ücret Matrahı",
        value2: sgkPrime,       value2Label: "SGK Prime Esas Kazanç",
        diff, diffPercent: diffPct,
        status,
      });
    } else {
      results.push({
        name: "Muhtasar Ücret Matrahı ↔ SGK Prime Esas Kazanç",
        detail: "Karşılaştırılabilir alanlar çıkarılamadı (manuel kontrol önerilir)",
        status: "BİLGİ",
      });
    }
  }

  // 4. KDV teslim bedeli ↔ Geçici vergi hasılatı
  const kdv    = findByType(extractions, "kdv", "katma değer");
  const gecici = findByType(extractions, "geçici", "gecici");
  if (kdv && gecici) {
    const kdvTeslim = findField(kdv.veriler, [
      "teslim ve hizmet", "teslim bedeli", "matrah", "vergilendirilecek teslim", "toplam matrah",
    ]);
    const geciciHasilat = findField(gecici.veriler, [
      "hasılat", "brüt satış", "net satış", "toplam gelir", "matrah",
    ]);
    if (kdvTeslim > 0 && geciciHasilat > 0) {
      const diff    = Math.abs(kdvTeslim - geciciHasilat);
      const diffPct = (diff / Math.max(kdvTeslim, geciciHasilat)) * 100;
      const status  = diffPct > 20 ? "UYARI" : "UYGUN";
      results.push({
        name: "KDV Teslim Bedeli ↔ Geçici Vergi Hasılatı",
        detail: diffPct > 20
          ? `%${diffPct.toFixed(1)} fark — dönemsel uyumsuzluk olabilir`
          : `%${diffPct.toFixed(1)} fark — uyumlu`,
        value1: kdvTeslim,      value1Label: "KDV Teslim Bedeli",
        value2: geciciHasilat,  value2Label: "Geçici Vergi Hasılatı",
        diff, diffPercent: diffPct,
        status,
      });
    }
  }

  // 5. Ödenecek vergi kontrolleri (negatif / anormal büyük)
  for (const ext of extractions) {
    const odenmesi = findField(ext.veriler, ["ödenecek", "tahakkuk eden", "ödeme"]);
    const tur = safeStr(ext.belge_turu);
    if (odenmesi < 0) {
      results.push({
        name: `Negatif Ödenecek: ${tur}`,
        detail: `${odenmesi.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺ — iade durumu olabilir`,
        value1: odenmesi, value1Label: "Ödenecek / İade Tutarı",
        status: "UYARI",
      });
    } else if (odenmesi > 10_000_000) {
      results.push({
        name: `Olağandışı Yüksek Ödenecek: ${tur}`,
        detail: `${odenmesi.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺ — 10M ₺ üzeri`,
        value1: odenmesi, value1Label: "Ödenecek Tutarı",
        status: "UYARI",
      });
    }
  }

  // 6. Eksik beyanname tespiti
  const missing: string[] = [];
  if (hasType(extractions, "kdv") && !hasType(extractions, "muhtasar", "stopaj")) {
    missing.push("KDV mevcut ancak Muhtasar yüklenmedi");
  }
  if (hasType(extractions, "muhtasar", "stopaj") && !hasType(extractions, "sgk")) {
    missing.push("Muhtasar mevcut ancak SGK bildirimi yüklenmedi");
  }
  if (hasType(extractions, "kurumlar", "gelir") && !hasType(extractions, "geçici", "gecici")) {
    missing.push("Kurumlar/Gelir Vergisi mevcut ancak Geçici Vergi yüklenmedi");
  }
  for (const m of missing) {
    results.push({ name: "Eksik Beyanname Tespiti", detail: m, status: "BİLGİ" });
  }

  return results;
}

// ── AI extraction per file ─────────────────────────────────────────────────

async function extractFromFile(
  openai: any,
  file: File,
  basePrompt: string,
): Promise<Extraction> {
  const buffer = Buffer.from(await file.arrayBuffer());

  let pageImages: string[] = [];
  try {
    const { pdf } = await import("pdf-to-img");
    const document = await pdf(buffer, { scale: 2 });
    let page = 0;
    for await (const img of document) {
      if (page >= MAX_VISION_PAGES) break;
      pageImages.push((img as Buffer).toString("base64"));
      page++;
    }
  } catch { /* proceed with empty */ }

  const base: Extraction = {
    dosya_adi: file.name,
    belge_turu: "",
    mukellef: { unvan: "", vergi_kimlik_no: "", vergi_dairesi: "" },
    donem: "",
    veriler: [],
  };

  if (pageImages.length === 0) return base;

  const prompt =
    basePrompt +
    `\n\nYanıtını YALNIZCA şu JSON formatında ver (başka alan ekleme):
{
  "belge_turu": "KDV / Muhtasar / Kurumlar Vergisi / Gelir Vergisi / SGK / Geçici Vergi / diğer",
  "mukellef": {"unvan": "", "vergi_kimlik_no": "", "vergi_dairesi": ""},
  "donem": "YYYY-MM veya YYYY formatında",
  "veriler": [{"alan": "...", "deger": "...", "birim": "TRY veya boş"}]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.4-mini",
      messages: [{
        role: "user",
        content: [
          { type: "text", text: prompt },
          ...pageImages.slice(0, 2).map(imageContent),
        ],
      }],
      response_format: { type: "json_object" },
      temperature: 0,
      max_completion_tokens: 2000,
    });
    const parsed = parseJsonContent(response.choices[0].message.content ?? "{}");
    return { dosya_adi: file.name, ...parsed, veriler: parsed.veriler ?? [] };
  } catch {
    return base;
  }
}

// ── Route handler ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const openai = getOpenAI();

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });

  const { role } = token as any;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
  }

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
    for (const file of files) {
      const ext = await extractFromFile(openai, file, basePrompt);
      extractions.push(ext);
    }

    const checks = runChecks(extractions);
    return NextResponse.json({ extractions, checks });
  } catch (err: any) {
    console.error("[capraz-kontrol] Hata:", err?.status, err?.code, err?.message);
    return NextResponse.json(
      { error: "İşlem sırasında hata: " + (err?.message ?? "Bilinmeyen hata") },
      { status: err?.status ?? 500 },
    );
  }
}
