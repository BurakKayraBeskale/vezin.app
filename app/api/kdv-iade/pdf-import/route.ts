import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getOpenAI } from "@/lib/openai";
import { pdfToBase64Images, imageContent, parseJsonContent } from "@/lib/pdf-vision-extractor";

export const dynamic  = "force-dynamic";
export const maxDuration = 120;

const MAX_SIZE  = 10 * 1024 * 1024; // 10 MB / dosya
const MAX_FILES = 50;

// ── Types ──────────────────────────────────────────────────────────────────

export interface AiInvoice {
  filename:       string;
  faturaTarihi:   string;   // GG.AA.YYYY veya YYYY-MM-DD
  faturaNo:       string;
  seri:           string;
  siraNo:         string;
  saticiUnvan:    string;
  saticiVkn:      string;
  aliciUnvan:     string;
  aliciVkn:       string;
  malHizmetCinsi: string;
  miktar:         number;
  kdvHaricTutar:  number;
  kdvOrani:       number;
  kdvTutari:      number;
}

export interface PdfFailedItem {
  filename: string;
  reason:   string;
}

export interface PdfImportResult {
  invoices: AiInvoice[];
  failed:   PdfFailedItem[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** PDF buffer'larını ZIP içinden dahil ederek toplar. */
async function collectPdfBuffers(
  files: File[],
): Promise<Array<{ filename: string; buffer: Buffer }>> {
  const out: Array<{ filename: string; buffer: Buffer }> = [];

  for (const file of files) {
    const lc = file.name.toLowerCase();

    if (lc.endsWith(".pdf")) {
      out.push({ filename: file.name, buffer: Buffer.from(await file.arrayBuffer()) });

    } else if (lc.endsWith(".zip")) {
      const JSZip = require("jszip");
      const zip   = await JSZip.loadAsync(Buffer.from(await file.arrayBuffer()));
      for (const [path, entry] of Object.entries(zip.files) as Array<[string, any]>) {
        if (!entry.dir && path.match(/\.pdf$/i)) {
          const buf = Buffer.from(await entry.async("arraybuffer"));
          out.push({ filename: path.split("/").pop() || path, buffer: buf });
        }
      }
    }
  }

  return out;
}

/** Tek fatura PDF'inden veriyi çıkarır. */
async function extractInvoice(
  openai: any,
  filename: string,
  buffer: Buffer,
): Promise<AiInvoice | PdfFailedItem> {
  let pageImages: string[] = [];
  try {
    pageImages = await pdfToBase64Images(buffer);
  } catch {
    return { filename, reason: "PDF görüntüye dönüştürülemedi" };
  }

  if (pageImages.length === 0) {
    return { filename, reason: "PDF sayfası okunamadı — dosya bozuk olabilir" };
  }

  // Yalnızca ilk 2 sayfa yeterli — fatura basit belgedir.
  const pages = pageImages.slice(0, 2);

  const prompt = `Sen bir Türk e-fatura okuma asistanısın. Bu fatura görselinden aşağıdaki bilgileri çıkar ve JSON formatında döndür.

Döndüreceğin JSON şeması:
{
  "faturaTarihi":   "GG.AA.YYYY formatında fatura tarihi",
  "faturaNo":       "tam fatura numarası (örn: TRZ2025000001)",
  "seri":           "fatura serisi (örn: TRZ) — yoksa boş string",
  "siraNo":         "fatura sıra numarası (rakamlar) — yoksa faturaNo",
  "saticiUnvan":    "satıcı firma adı veya unvanı",
  "saticiVkn":      "satıcı vergi kimlik no (10 hane) veya TC kimlik no (11 hane) — yalnızca rakamlar",
  "aliciUnvan":     "alıcı firma adı veya unvanı",
  "aliciVkn":       "alıcı vergi kimlik no (10 hane) veya TC kimlik no (11 hane) — yalnızca rakamlar",
  "malHizmetCinsi": "mal/hizmet cinsi (birden fazla kalem varsa virgülle birleştir)",
  "miktar":         1,
  "kdvHaricTutar":  0.00,
  "kdvOrani":       20,
  "kdvTutari":      0.00
}

Birden fazla kalem içeren faturalarda TOPLAM kdvHaricTutar ve TOPLAM kdvTutari kullan.
Sayısal alanları Türk formatından (nokta binlik, virgül ondalık) düzgün dönüştür.
Yanıtını YALNIZCA geçerli JSON olarak ver, başka metin ekleme.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.4-nano",
      messages: [{
        role: "user",
        content: [
          { type: "text", text: prompt },
          ...pages.map(imageContent),
        ],
      }],
      response_format: { type: "json_object" },
      temperature: 0,
      max_completion_tokens: 1000,
    });

    const raw    = response.choices[0].message.content ?? "{}";
    const parsed = parseJsonContent(raw);

    // Zorunlu alan kontrolü
    if (!parsed.saticiUnvan && !parsed.aliciUnvan && !parsed.kdvHaricTutar) {
      console.warn(`[pdf-import] Boş çıkarım dosya="${filename}"`);
      return { filename, reason: "Fatura bilgileri çıkarılamadı — okunamayan PDF?" };
    }

    // Sayıları normalize et (bazen string gelir)
    const toN = (v: any): number => {
      if (typeof v === "number") return v;
      const s = String(v ?? "").replace(/[^\d,.]/g, "").replace(",", ".");
      return parseFloat(s) || 0;
    };

    console.log(`[pdf-import] BAŞARILI dosya="${filename}" satici="${parsed.saticiUnvan}" kdv=${toN(parsed.kdvTutari)}`);

    return {
      filename,
      faturaTarihi:   String(parsed.faturaTarihi   ?? ""),
      faturaNo:       String(parsed.faturaNo        ?? ""),
      seri:           String(parsed.seri            ?? ""),
      siraNo:         String(parsed.siraNo          ?? parsed.faturaNo ?? ""),
      saticiUnvan:    String(parsed.saticiUnvan     ?? ""),
      saticiVkn:      String(parsed.saticiVkn       ?? ""),
      aliciUnvan:     String(parsed.aliciUnvan      ?? ""),
      aliciVkn:       String(parsed.aliciVkn        ?? ""),
      malHizmetCinsi: String(parsed.malHizmetCinsi  ?? ""),
      miktar:         toN(parsed.miktar)    || 1,
      kdvHaricTutar:  toN(parsed.kdvHaricTutar),
      kdvOrani:       toN(parsed.kdvOrani),
      kdvTutari:      toN(parsed.kdvTutari),
    } as AiInvoice;
  } catch (err: any) {
    console.error(`[pdf-import] AI hatası dosya="${filename}"`, err?.message ?? err);
    return { filename, reason: "AI yanıtı alınamadı" };
  }
}

// ── Route ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const openai = getOpenAI();

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { role } = token as any;
  if (role !== "ADMIN") return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });

  let formData: FormData;
  try { formData = await req.formData(); }
  catch { return NextResponse.json({ error: "Geçersiz istek formatı" }, { status: 400 }); }

  const rawFiles = formData.getAll("files[]") as File[];
  if (!rawFiles || rawFiles.length === 0)
    return NextResponse.json({ error: "En az bir dosya yükleyin" }, { status: 400 });

  // Yalnızca PDF ve ZIP kabul et
  for (const f of rawFiles) {
    const lc = f.name.toLowerCase();
    if (!lc.endsWith(".pdf") && !lc.endsWith(".zip"))
      return NextResponse.json({ error: `"${f.name}" desteklenmiyor (PDF veya ZIP gerekli)` }, { status: 400 });
    if (f.size > MAX_SIZE)
      return NextResponse.json({ error: `"${f.name}" 10MB'ı geçemez` }, { status: 400 });
  }

  // ZIP'leri aç, PDF'leri topla
  let pdfs: Array<{ filename: string; buffer: Buffer }>;
  try {
    pdfs = await collectPdfBuffers(rawFiles);
  } catch (err: any) {
    return NextResponse.json({ error: "Dosya açılamadı: " + (err?.message ?? "") }, { status: 400 });
  }

  if (pdfs.length === 0)
    return NextResponse.json({ error: "İşlenecek PDF bulunamadı" }, { status: 400 });
  if (pdfs.length > MAX_FILES)
    return NextResponse.json({ error: `En fazla ${MAX_FILES} PDF işlenebilir` }, { status: 400 });

  console.log(`[pdf-import] ${pdfs.length} PDF işlenecek`);

  const invoices: AiInvoice[]    = [];
  const failed: PdfFailedItem[]  = [];

  for (const { filename, buffer } of pdfs) {
    const result = await extractInvoice(openai, filename, buffer);
    if ("faturaTarihi" in result) invoices.push(result as AiInvoice);
    else                          failed.push(result as PdfFailedItem);
  }

  return NextResponse.json({ invoices, failed } satisfies PdfImportResult);
}
