import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getOpenAI } from "@/lib/openai";
import { getAiPrompt } from "@/lib/ai-prompts";
import { hesaplaTutarlilik, tutarlilikSayfasiEkle } from "@/lib/tutarlilik-skoru";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_SIZE = 10 * 1024 * 1024;
const MAX_VISION_PAGES = 4;
const MAX_FILES = 20;

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

function solidFill(argb: string) {
  return { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb } };
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

// ── Financial value extraction from veriler ────────────────────────────────

interface Financials {
  matrah: number;
  hesaplanan: number;
  indirim: number;
  odenmesi_gereken: number;
}

function extractFinancials(belge_turu: string, veriler: any[]): Financials {
  const fields: Record<string, number> = {};
  for (const v of veriler ?? []) {
    const alan = safeStr(v.alan ?? v.ad ?? "").toLowerCase().trim();
    if (alan) fields[alan] = toNum(v.deger ?? v.tutar ?? v.value ?? 0);
  }

  function find(...keywords: string[]): number {
    for (const [key, val] of Object.entries(fields)) {
      for (const kw of keywords) {
        if (key.includes(kw)) return val;
      }
    }
    return 0;
  }

  const tur = (belge_turu ?? "").toLowerCase();

  if (tur.includes("kdv")) {
    return {
      matrah:           find("matrah", "teslim", "bedel"),
      hesaplanan:       find("hesaplanan kdv", "hesaplanan"),
      indirim:          find("indirilecek", "indirim"),
      odenmesi_gereken: find("ödenecek kdv", "ödenecek", "ödeme"),
    };
  }
  if (tur.includes("muhtasar") || tur.includes("stopaj")) {
    return {
      matrah:           find("matrah", "prime esas", "kazanç", "ücret"),
      hesaplanan:       find("stopaj", "kesinti", "hesaplanan"),
      indirim:          find("mahsup", "indirim"),
      odenmesi_gereken: find("ödenecek", "tahakkuk"),
    };
  }
  if (tur.includes("kurumlar") || tur.includes("gelir")) {
    return {
      matrah:           find("matrah", "vergiye tabi"),
      hesaplanan:       find("hesaplanan vergi", "hesaplanan"),
      indirim:          find("mahsup", "indirim", "geçmiş yıl"),
      odenmesi_gereken: find("ödenecek", "ödeme"),
    };
  }
  if (tur.includes("sgk") || tur.includes("prime")) {
    return {
      matrah:           find("prime esas", "kazanç", "matrah"),
      hesaplanan:       find("prim", "sigorta"),
      indirim:          find("indirim", "teşvik"),
      odenmesi_gereken: find("ödenecek", "tahakkuk"),
    };
  }

  return {
    matrah:           find("matrah"),
    hesaplanan:       find("hesaplanan", "vergi"),
    indirim:          find("indirim", "mahsup"),
    odenmesi_gereken: find("ödenecek", "tahakkuk"),
  };
}

// ── AI extraction per file ─────────────────────────────────────────────────

async function extractFromFile(
  openai: any,
  file: File,
  basePrompt: string,
): Promise<any | null> {
  const buffer = Buffer.from(await file.arrayBuffer());

  let pageImages: string[];
  try {
    pageImages = await pdfToBase64Images(buffer);
  } catch {
    return null;
  }
  if (pageImages.length === 0) return null;

  const prompt =
    basePrompt +
    `\n\nYanıtını YALNIZCA şu JSON formatında ver (başka alan ekleme):
{
  "belge_turu": "KDV / Muhtasar / Kurumlar Vergisi / Gelir Vergisi / SGK / diğer",
  "mukellef": {"unvan": "", "vergi_kimlik_no": "", "vergi_dairesi": ""},
  "donem": "YYYY-MM veya YYYY formatında",
  "veriler": [{"alan": "...", "deger": "...", "birim": "TRY veya boş"}]
}`;

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

  return parseJsonContent(response.choices[0].message.content ?? "{}");
}

// ── Excel builder ──────────────────────────────────────────────────────────

async function buildTamTasdikExcel(results: any[], fileNames: string[]): Promise<Uint8Array> {
  const ExcelJS = require("exceljs");
  const wb = new ExcelJS.Workbook();

  const ORANGE     = "FFF57C28";
  const ORANGE_LT  = "FFFFF3E8";
  const DARK_BLUE  = "FF1F3864";
  const LIGHT_BLUE = "FFD9E1F2";
  const WHITE      = "FFFFFFFF";
  const GRAY_LT    = "FFF5F5F5";
  const GRAY_MED   = "FFE8E8E8";
  const NUM_FMT    = "#,##0.00";

  const valid = results.filter(Boolean);
  const validWithNames = valid.map((r, i) => ({ ...r, dosya_adi: fileNames[i] ?? `dosya-${i + 1}` }));

  // Mükellef bilgileri — ilk geçerli sonuçtan
  const first = valid[0] ?? {};
  const mk = first.mukellef ?? {};
  const mukellefUnvan   = typeof mk === "string" ? mk : safeStr(mk?.unvan ?? "");
  const mukellefVergiNo = typeof mk === "string" ? "" : safeStr(mk?.vergi_kimlik_no ?? first.vergi_no ?? "");
  const mukellefDaire   = typeof mk === "string" ? "" : safeStr(mk?.vergi_dairesi ?? "");

  const periods = valid.map(r => safeStr(r?.donem)).filter(Boolean);
  const incelemeDonemi =
    periods.length > 1
      ? `${periods[periods.length - 1]} – ${periods[0]}`
      : periods[0] ?? "";

  const today = new Date().toLocaleDateString("tr-TR", {
    day: "2-digit", month: "long", year: "numeric",
  });

  function applyBorders(row: any, cols: number, thin = true) {
    const s = thin ? "thin" as const : "hair" as const;
    for (let i = 1; i <= cols; i++) {
      row.getCell(i).border = { top: { style: s }, left: { style: s }, bottom: { style: s }, right: { style: s } };
    }
  }

  function mainHeader(ws: any, title: string, cols: number) {
    const endCol = String.fromCharCode(64 + cols);
    ws.mergeCells(`A1:${endCol}1`);
    const c = ws.getCell("A1");
    c.value = "YMM TAM TASDİK ÖZET RAPORU";
    c.fill  = solidFill(ORANGE);
    c.font  = { bold: true, size: 15, color: { argb: WHITE } };
    c.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(1).height = 34;

    ws.mergeCells(`A2:${endCol}2`);
    const c2 = ws.getCell("A2");
    c2.value = title;
    c2.fill  = solidFill(DARK_BLUE);
    c2.font  = { bold: true, size: 12, color: { argb: WHITE } };
    c2.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(2).height = 22;

    ws.getRow(3).height = 6;
  }

  function sectionHeader(ws: any, row: number, text: string, cols: number) {
    const endCol = String.fromCharCode(64 + cols);
    ws.mergeCells(`A${row}:${endCol}${row}`);
    const c = ws.getCell(`A${row}`);
    c.value = text;
    c.fill  = solidFill(DARK_BLUE);
    c.font  = { bold: true, size: 11, color: { argb: WHITE } };
    c.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    ws.getRow(row).height = 22;
  }

  // ── SHEET 1 — I. GENEL BİLGİLER ─────────────────────────────────────────
  const ws1 = wb.addWorksheet("I. GENEL BİLGİLER");
  ws1.pageSetup = { paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, orientation: "portrait" };
  ws1.columns = [{ width: 34 }, { width: 52 }];
  mainHeader(ws1, "I. GENEL BİLGİLER", 2);

  const infoRows: Array<[string, string]> = [
    ["Mükellefin Adı / Ünvanı",   mukellefUnvan   || "—"],
    ["Vergi Dairesi",              mukellefDaire   || "—"],
    ["Vergi Kimlik Numarası",      mukellefVergiNo || "—"],
    ["İnceleme Dönemi",            incelemeDonemi  || "—"],
    ["Rapor Tarihi",               today],
  ];

  let r1 = 4;
  for (const [label, value] of infoRows) {
    const row = ws1.getRow(r1);
    const lc = row.getCell(1);
    lc.value = label; lc.fill = solidFill(LIGHT_BLUE);
    lc.font = { bold: true, size: 10 };
    lc.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    const vc = row.getCell(2);
    vc.value = value; vc.fill = solidFill(WHITE);
    vc.font = { size: 10 }; vc.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    applyBorders(row, 2);
    row.height = 20;
    r1++;
  }

  r1 += 2;
  sectionHeader(ws1, r1, "İncelenen Beyannameler", 2);
  r1++;

  // Beyannameler tablo başlığı
  const bhRow = ws1.getRow(r1);
  ["Dönem", "Beyanname Türü"].forEach((h, i) => {
    const c = bhRow.getCell(i + 1);
    c.value = h; c.fill = solidFill(GRAY_MED);
    c.font = { bold: true, size: 10 };
    c.alignment = { horizontal: "center", vertical: "middle" };
  });
  applyBorders(bhRow, 2);
  ws1.getRow(r1).height = 20;
  r1++;

  for (const res of valid) {
    const row = ws1.getRow(r1);
    row.getCell(1).value = safeStr(res.donem) || "—";
    row.getCell(2).value = safeStr(res.belge_turu) || "—";
    row.getCell(1).alignment = { horizontal: "center" };
    row.getCell(2).alignment = { horizontal: "left", indent: 1 };
    row.getCell(1).fill = solidFill(r1 % 2 === 0 ? GRAY_LT : WHITE);
    row.getCell(2).fill = solidFill(r1 % 2 === 0 ? GRAY_LT : WHITE);
    applyBorders(row, 2, false);
    row.height = 18;
    r1++;
  }

  r1 += 2;
  sectionHeader(ws1, r1, "YMM Bilgileri (Elle Doldurulacak)", 2);
  r1++;

  const ymmFields = [
    "Adı Soyadı", "YMM Sicil Numarası",
    "Sözleşme Numarası", "Sözleşme Tarihi", "Bağlı Olduğu Oda",
  ];
  for (const f of ymmFields) {
    const row = ws1.getRow(r1);
    const lc = row.getCell(1);
    lc.value = f; lc.fill = solidFill(LIGHT_BLUE);
    lc.font = { bold: true, size: 10 };
    lc.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    row.getCell(2).fill = solidFill(WHITE);
    applyBorders(row, 2);
    row.height = 20;
    r1++;
  }

  // ── SHEET 2 — II. USUL İNCELEMELERİ ────────────────────────────────────
  const ws2 = wb.addWorksheet("II. USUL İNCELEMELERİ");
  ws2.pageSetup = { paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, orientation: "portrait" };
  ws2.columns = [{ width: 62 }, { width: 8 }, { width: 8 }, { width: 34 }];
  mainHeader(ws2, "II. USUL İNCELEMELERİ", 4);

  const usulHeaders = ["İnceleme Konusu", "Evet", "Hayır", "Açıklama"];
  const uhRow = ws2.getRow(4);
  usulHeaders.forEach((h, i) => {
    const c = uhRow.getCell(i + 1);
    c.value = h; c.fill = solidFill(GRAY_MED);
    c.font = { bold: true, size: 10 };
    c.alignment = { horizontal: "center", vertical: "middle" };
    c.border = {
      top: { style: "medium" }, left: { style: "thin" },
      bottom: { style: "medium" }, right: { style: "thin" },
    };
  });
  ws2.getRow(4).height = 22;

  const usulItems = [
    "Yasal defterlerin tasdik bilgileri mevcut mudur?",
    "Yevmiye defteri yasal süresinde tasdik ettirilmiş midir?",
    "Defteri kebir tutulmakta mıdır?",
    "Envanter defteri tasdikli tutulmakta mıdır?",
    "Defter kayıtlarına dayanak belgeler düzenli olarak saklanmakta mıdır?",
    "Fatura ve benzeri belgeler mevzuata uygun düzenlenmiş midir?",
    "KDV beyannameleri yasal süresi içinde verilmiş midir?",
    "Muhtasar beyannameler yasal süresi içinde verilmiş midir?",
    "Kurumlar/Gelir Vergisi beyannamesi yasal süresi içinde verilmiş midir?",
    "Geçici vergi beyannameleri zamanında verilmiş midir?",
    "SGK bildirgeleri zamanında verilmiş midir?",
    "Tahakkuk eden vergiler zamanında ödenmiş midir?",
  ];

  let r2 = 5;
  for (const item of usulItems) {
    const row = ws2.getRow(r2);
    row.getCell(1).value = item;
    row.getCell(1).font = { size: 10 };
    row.getCell(1).alignment = { horizontal: "left", vertical: "middle", wrapText: true, indent: 1 };
    [2, 3, 4].forEach(i => {
      row.getCell(i).alignment = { horizontal: "center", vertical: "middle" };
    });
    const bg = r2 % 2 === 0 ? GRAY_LT : WHITE;
    for (let i = 1; i <= 4; i++) {
      row.getCell(i).fill = solidFill(bg);
      row.getCell(i).border = {
        top: { style: "hair" }, left: { style: "thin" },
        bottom: { style: "hair" }, right: { style: "thin" },
      };
    }
    row.height = 24;
    r2++;
  }

  // ── SHEET 3 — III. HESAP İNCELEMELERİ ──────────────────────────────────
  const ws3 = wb.addWorksheet("III. HESAP İNCELEMELERİ");
  ws3.pageSetup = { paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, orientation: "landscape" };
  ws3.columns = [
    { width: 14 }, // Dönem
    { width: 24 }, // Beyanname türü
    { width: 18 }, // Matrah
    { width: 20 }, // Hesaplanan vergi
    { width: 20 }, // İndirim/Mahsup
    { width: 20 }, // Ödenecek/İade
  ];
  mainHeader(ws3, "III. HESAP İNCELEMELERİ — BEYANNAME ÖZETİ", 6);

  const col3H = ["Dönem", "Beyanname Türü", "Matrah (₺)", "Hesaplanan Vergi (₺)", "İndirim / Mahsup (₺)", "Ödenecek / İade (₺)"];
  const ch3Row = ws3.getRow(4);
  col3H.forEach((h, i) => {
    const c = ch3Row.getCell(i + 1);
    c.value = h; c.fill = solidFill(GRAY_MED);
    c.font = { bold: true, size: 10 };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.border = {
      top: { style: "medium" }, left: { style: "thin" },
      bottom: { style: "medium" }, right: { style: "thin" },
    };
  });
  ws3.getRow(4).height = 30;

  let r3 = 5;
  const dataStartRow = r3;

  for (const res of valid) {
    const fin = extractFinancials(res.belge_turu, res.veriler ?? []);
    const row = ws3.getRow(r3);

    row.getCell(1).value = safeStr(res.donem) || "—";
    row.getCell(2).value = safeStr(res.belge_turu) || "—";
    row.getCell(3).value = fin.matrah    || null;
    row.getCell(4).value = fin.hesaplanan || null;
    row.getCell(5).value = fin.indirim   || null;
    row.getCell(6).value = fin.odenmesi_gereken || null;

    row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
    row.getCell(2).alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    [3, 4, 5, 6].forEach(i => {
      row.getCell(i).numFmt = NUM_FMT;
      row.getCell(i).alignment = { horizontal: "right", vertical: "middle" };
    });

    const bg = r3 % 2 === 0 ? GRAY_LT : WHITE;
    for (let i = 1; i <= 6; i++) {
      row.getCell(i).fill = solidFill(bg);
      row.getCell(i).border = {
        top: { style: "hair" }, left: { style: "thin" },
        bottom: { style: "hair" }, right: { style: "thin" },
      };
    }
    row.height = 20;
    r3++;
  }

  // Totals row
  const totRow = ws3.getRow(r3);
  ws3.mergeCells(`A${r3}:B${r3}`);
  totRow.getCell(1).value = "TOPLAM";
  totRow.getCell(1).fill  = solidFill(ORANGE);
  totRow.getCell(1).font  = { bold: true, size: 10, color: { argb: WHITE } };
  totRow.getCell(1).alignment = { horizontal: "right", vertical: "middle", indent: 1 };
  totRow.getCell(1).border = {
    top: { style: "medium" }, left: { style: "medium" },
    bottom: { style: "medium" }, right: { style: "thin" },
  };

  const endDataRow = r3 - 1;
  if (endDataRow >= dataStartRow) {
    ["C", "D", "E", "F"].forEach((col, idx) => {
      const c = totRow.getCell(idx + 3);
      c.value = { formula: `SUM(${col}${dataStartRow}:${col}${endDataRow})` };
      c.numFmt = NUM_FMT;
      c.font = { bold: true, size: 10 };
      c.fill = solidFill(ORANGE_LT);
      c.alignment = { horizontal: "right", vertical: "middle" };
      c.border = {
        top: { style: "medium" }, left: { style: "thin" },
        bottom: { style: "medium" }, right: { style: idx === 3 ? "medium" : "thin" },
      };
    });
  }
  ws3.getRow(r3).height = 24;

  // ── SHEET 4 — IV. SONUÇ ─────────────────────────────────────────────────
  const ws4 = wb.addWorksheet("IV. SONUÇ");
  ws4.pageSetup = { paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, orientation: "portrait" };
  ws4.columns = [{ width: 34 }, { width: 52 }];
  mainHeader(ws4, "IV. SONUÇ VE KANAAT", 2);

  // Dönem toplamları section
  sectionHeader(ws4, 4, "Dönem Toplamları", 2);
  let r4 = 5;

  const totalOdenmesiGereken = valid.reduce((sum, res) => {
    const fin = extractFinancials(res.belge_turu, res.veriler ?? []);
    return sum + fin.odenmesi_gereken;
  }, 0);

  const toplamlar: Array<[string, any, boolean]> = [
    ["Toplam Ödenecek / İade (₺)", totalOdenmesiGereken, true],
    ["İnceleme Kapsamındaki Beyanname Sayısı", valid.length, false],
  ];

  for (const [label, value, isCurrency] of toplamlar) {
    const row = ws4.getRow(r4);
    const lc = row.getCell(1);
    lc.value = label; lc.fill = solidFill(LIGHT_BLUE);
    lc.font = { bold: true, size: 10 };
    lc.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    const vc = row.getCell(2);
    vc.value = value; vc.fill = solidFill(WHITE);
    vc.font = { bold: true, size: 10 };
    vc.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    if (isCurrency) vc.numFmt = NUM_FMT;
    applyBorders(row, 2);
    row.height = 20;
    r4++;
  }

  r4 += 2;
  sectionHeader(ws4, r4, "Sonuç Metni (Şablon — YMM Tarafından Düzenlenecek)", 2);
  r4++;

  const concText =
    `Yukarıda belirtilen ${incelemeDonemi || "ilgili"} dönemine ait beyannameler incelenmiş olup;\n\n` +
    `• ${mukellefUnvan || "[Mükellef Ünvanı]"} unvanlı mükellefin söz konusu döneme ait muhasebe kayıtları, defterleri ve ilgili belgeler incelenmiştir.\n\n` +
    `• Beyannamelerin yasal süresi içinde verildiği tespit edilmiştir.\n\n` +
    `• Hesaplama ve muhasebe kayıtları, yasal düzenlemelere uygun bulunmuştur.\n\n` +
    `Tam tasdik raporu, 3568 sayılı Kanun ve ilgili yönetmelik hükümleri çerçevesinde tanzim edilmiştir.`;

  ws4.mergeCells(`A${r4}:B${r4 + 8}`);
  const concCell = ws4.getCell(`A${r4}`);
  concCell.value = concText;
  concCell.font  = { size: 10, italic: true };
  concCell.alignment = { horizontal: "left", vertical: "top", wrapText: true, indent: 1 };
  concCell.fill   = solidFill(GRAY_LT);
  concCell.border = {
    top: { style: "thin" }, left: { style: "thin" },
    bottom: { style: "thin" }, right: { style: "thin" },
  };
  ws4.getRow(r4).height = 150;
  r4 += 10;

  sectionHeader(ws4, r4, "İmza ve Onay", 2);
  r4++;

  const sigFields: Array<[string, number]> = [
    ["YMM Adı Soyadı", 20],
    ["YMM Sicil No",   20],
    ["Tarih",          20],
    ["Mühür / İmza",   60],
  ];
  for (const [f, h] of sigFields) {
    const row = ws4.getRow(r4);
    const lc = row.getCell(1);
    lc.value = f; lc.fill = solidFill(LIGHT_BLUE);
    lc.font = { bold: true, size: 10 };
    lc.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    row.getCell(2).fill = solidFill(WHITE);
    applyBorders(row, 2);
    row.height = h;
    r4++;
  }

  // ── SHEET 5 — V. TUTARLILIK ──────────────────────────────────────────────
  const tutarlilik = hesaplaTutarlilik(validWithNames.length === 1 ? validWithNames[0] : validWithNames);
  tutarlilikSayfasiEkle(wb, tutarlilik);

  const raw = await wb.xlsx.writeBuffer();
  return new Uint8Array(Buffer.from(raw));
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
    const results: any[] = [];
    for (const file of files) {
      const extracted = await extractFromFile(openai, file, basePrompt);
      results.push(extracted);
    }

    const excelBuffer = await buildTamTasdikExcel(results, files.map(f => f.name));
    const filename = `tam-tasdik-ozet-${new Date().toISOString().slice(0, 10)}.xlsx`;

    return new NextResponse(excelBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    console.error("[tam-tasdik] Hata:", err?.status, err?.code, err?.message);
    return NextResponse.json(
      { error: "Rapor oluşturulurken hata: " + (err?.message ?? "Bilinmeyen hata") },
      { status: err?.status ?? 500 },
    );
  }
}
