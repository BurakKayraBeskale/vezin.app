import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getOpenAI } from "@/lib/openai";
import { getAiPrompt } from "@/lib/ai-prompts";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_SIZE = 10 * 1024 * 1024;
const MAX_VISION_PAGES = 6;
const MAX_FILES = 20;

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

/** Mark extraction as failed if critical fields are missing */
function markExtractionStatus(ext: Extraction): Extraction {
  const mk = ext.mukellef;
  const unvan   = typeof mk === "object" ? safeStr((mk as any).unvan   ?? "") : safeStr(mk);
  const vergiNo = typeof mk === "object" ? safeStr((mk as any).vergi_kimlik_no ?? "") : "";
  const hasContent = ext.belge_turu.trim() !== "" || ext.veriler.length > 0 || unvan.trim() !== "" || vergiNo.trim() !== "";
  if (!hasContent) {
    return { ...ext, failed: true, failedReason: ext.failedReason ?? "Beyanname verisi çıkarılamadı" };
  }
  if (!ext.belge_turu.trim() || !ext.donem.trim() || !unvan.trim()) {
    return { ...ext, failed: true, failedReason: "Belge türü, dönem veya mükellef bilgisi eksik" };
  }
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
    const { pdf } = await import("pdf-to-img");
    const document = await pdf(buffer, { scale: 2 });
    let page = 0;
    for await (const img of document) {
      if (page >= MAX_VISION_PAGES) break;
      pageImages.push((img as Buffer).toString("base64"));
      page++;
    }
  } catch {
    return {
      dosya_adi: file.name, belge_turu: "", mukellef: {}, donem: "", veriler: [],
      failed: true, failedReason: "PDF görüntüye dönüştürülemedi",
    };
  }

  if (pageImages.length === 0) {
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
    if (pageImages.length <= 2) {
      // ── Tek geçiş: tüm sayfalar aynı anda (beyanname/route.ts ile aynı mantık) ──
      const response = await openai.chat.completions.create({
        model: "gpt-5.4-mini",
        messages: [{ role: "user", content: [{ type: "text", text: prompt }, ...pageImages.map(imageContent)] }],
        response_format: { type: "json_object" },
        temperature: 0,
        max_completion_tokens: 2000,
      });
      const parsed = parseJsonContent(response.choices[0].message.content ?? "{}");
      return markExtractionStatus({ dosya_adi: file.name, ...parsed, veriler: parsed.veriler ?? [] });
    }

    // ── Çok geçişli: sayfa 1–2 tam yapı, kalan sayfalar ek veriler ──
    const firstResp = await openai.chat.completions.create({
      model: "gpt-5.4-mini",
      messages: [{ role: "user", content: [{ type: "text", text: prompt }, ...pageImages.slice(0, 2).map(imageContent)] }],
      response_format: { type: "json_object" },
      temperature: 0,
      max_completion_tokens: 2000,
    });
    const first = parseJsonContent(firstResp.choices[0].message.content ?? "{}");
    let allVeriler: any[] = first.veriler ?? [];

    for (let i = 2; i < pageImages.length; i++) {
      const extraPrompt = basePrompt +
        `\n\nBu sayfadaki TÜM veri alanlarını çıkar. YALNIZCA şu JSON formatında ver:
{"veriler": [{"alan": "...", "deger": "...", "birim": "TRY veya boş"}]}`;
      const extraResp = await openai.chat.completions.create({
        model: "gpt-5.4-mini",
        messages: [{ role: "user", content: [{ type: "text", text: extraPrompt }, imageContent(pageImages[i])] }],
        response_format: { type: "json_object" },
        temperature: 0,
        max_completion_tokens: 2000,
      });
      const extra = parseJsonContent(extraResp.choices[0].message.content ?? "{}");
      allVeriler = [...allVeriler, ...(extra.veriler ?? [])];
    }

    return markExtractionStatus({
      dosya_adi: file.name,
      belge_turu: first.belge_turu ?? "",
      mukellef:   first.mukellef  ?? {},
      donem:      first.donem     ?? "",
      veriler:    allVeriler,
    });
  } catch {
    return {
      dosya_adi: file.name, belge_turu: "", mukellef: {}, donem: "", veriler: [],
      failed: true, failedReason: "AI yanıtı alınamadı",
    };
  }
}

// ── Single-document internal consistency checks ────────────────────────────

function runSingleChecks(ext: Extraction): CheckResult[] {
  if (ext.failed) return [];
  const results: CheckResult[] = [];
  const tur   = (ext.belge_turu ?? "").toLowerCase();
  const label = safeStr(ext.belge_turu) || ext.dosya_adi;

  // 1. VKN (10 hane) / TCKN (11 hane) doğrulama
  const mk      = ext.mukellef;
  const vergiNo = typeof mk === "object" ? safeStr((mk as any).vergi_kimlik_no ?? "") : "";
  const cleanNo = vergiNo.replace(/\D/g, "");
  if (cleanNo.length > 0) {
    if (cleanNo.length !== 10 && cleanNo.length !== 11) {
      results.push({
        name: `VKN/TCKN Doğrulama — ${label}`,
        detail: `Kimlik no "${vergiNo}" geçersiz uzunluk (${cleanNo.length} hane) — VKN 10, TCKN 11 hane olmalı`,
        status: "UYARI",
      });
    } else {
      results.push({
        name: `VKN/TCKN Doğrulama — ${label}`,
        detail: `${cleanNo.length === 10 ? "VKN" : "TCKN"} format geçerli (${cleanNo.length} hane): ${vergiNo}`,
        status: "UYGUN",
      });
    }
  }

  // KDV beyannamesi iç tutarlılık kontrolleri
  if (tur.includes("kdv") || tur.includes("katma")) {
    const odenecek   = findField(ext.veriler, ["ödenecek kdv", "ödenmesi gereken kdv", "ödenecek"]);
    const devreden   = findField(ext.veriler, ["devreden kdv", "sonraki döneme devreden", "devreden"]);
    const hesaplanan = findField(ext.veriler, ["hesaplanan kdv", "hesaplanan katma değer vergisi"]);
    const indirilecek = findField(ext.veriler, ["indirilecek kdv", "toplam indirim", "indirilecek katma"]);

    // 2. Ödenecek/Devreden KDV mantık: ikisi aynı anda pozitif olamaz
    if (odenecek > 0 && devreden > 0) {
      results.push({
        name: `KDV Ödenecek/Devreden Mantık — ${label}`,
        detail: "Ödenecek KDV ve Devreden KDV aynı anda pozitif olamaz — çelişki var",
        value1: odenecek,  value1Label: "Ödenecek KDV",
        value2: devreden,  value2Label: "Devreden KDV",
        status: "UYARI",
      });
    } else if (odenecek > 0 || devreden > 0) {
      results.push({
        name: `KDV Ödenecek/Devreden Mantık — ${label}`,
        detail: odenecek > 0
          ? `Ödenecek KDV: ${odenecek.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺ — tutarlı`
          : `Devreden KDV: ${devreden.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺ — tutarlı`,
        status: "UYGUN",
      });
    }

    // 3. Hesaplanan KDV − İndirilecek KDV ≈ Ödenecek/Devreden (%1 tolerans)
    const sonuc = odenecek > 0 ? odenecek : devreden;
    if (hesaplanan > 0 && indirilecek > 0 && sonuc > 0) {
      const expected = hesaplanan - indirilecek;
      const diff     = Math.abs(expected - sonuc);
      const diffPct  = hesaplanan > 0 ? (diff / hesaplanan) * 100 : 0;
      if (diffPct > 1) {
        results.push({
          name: `KDV Matrah Tutarlılığı — ${label}`,
          detail: `Hesaplanan(${hesaplanan.toLocaleString("tr-TR")}) − İndirilecek(${indirilecek.toLocaleString("tr-TR")}) = ${expected.toLocaleString("tr-TR")} ₺ ≠ ${sonuc.toLocaleString("tr-TR")} ₺ (%${diffPct.toFixed(1)} fark — eşik %1)`,
          value1: expected, value1Label: "Hesap.−İndir.",
          value2: sonuc,    value2Label: odenecek > 0 ? "Ödenecek KDV" : "Devreden KDV",
          diff, diffPercent: diffPct,
          status: "UYARI",
        });
      } else {
        results.push({
          name: `KDV Matrah Tutarlılığı — ${label}`,
          detail: `Hesaplanan − İndirilecek ≈ Ödenecek/Devreden KDV — uyumlu (%${diffPct.toFixed(1)} fark)`,
          status: "UYGUN",
        });
      }
    }
  }

  return results;
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
    let failedCount  = 0;
    let successCount = 0;
    for (const file of files) {
      const ext = await extractFromFile(openai, file, basePrompt);
      extractions.push(ext);
      if (ext.failed) failedCount++; else successCount++;
    }

    // Tek-belge iç tutarlılık kontrolleri
    const singleChecks: CheckResult[] = [];
    for (const ext of extractions) singleChecks.push(...runSingleChecks(ext));

    // Çapraz kontroller yalnızca başarılı çıkarımlar üzerinde çalışır
    const crossChecks = runChecks(extractions.filter(e => !e.failed));
    const checks = [...singleChecks, ...crossChecks];

    return NextResponse.json({ extractions, checks, failedCount, successCount });
  } catch (err: any) {
    console.error("[capraz-kontrol] Hata:", err?.status, err?.code, err?.message);
    return NextResponse.json(
      { error: "İşlem sırasında hata: " + (err?.message ?? "Bilinmeyen hata") },
      { status: err?.status ?? 500 },
    );
  }
}
