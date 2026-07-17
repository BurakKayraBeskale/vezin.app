import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export const dynamic = "force-dynamic";

// ── Inline types (avoids importing from lib) ──────────────────────────────

interface SkorKontrol {
  ad: string;
  aciklama: string;
  aciklamaDetay?: string;
  durum: "GECTI" | "BASARISIZ" | "BILGI";
  etki: number;
  agirlik: "kritik" | "orta" | "hafif";
  deger1?: number;
  deger1Etiket?: string;
  deger2?: number;
  deger2Etiket?: string;
  fark?: number;
  farkYuzde?: number;
}

interface TutarlilikSonuc {
  skor: number;
  risk: "DUSUK_RISK" | "GOZDEN_GECIRILMELI" | "YUKSEK_RISK";
  riskEtiketi: string;
  kontroller: SkorKontrol[];
  hesaplanamadi: boolean;
}

// ── Color palette ──────────────────────────────────────────────────────────

const ORANGE    = "FFF57C28";
const DARK_BLUE = "FF1F3864";
const WHITE     = "FFFFFFFF";
const GREEN_BG  = "FFE2EFDA";
const GREEN_FG  = "FF375623";
const YELLOW_BG = "FFFFF2CC";
const YELLOW_FG = "FF7F6000";
const RED_BG    = "FFFFE0E0";
const RED_FG    = "FFC00000";
const GRAY_LT   = "FFF5F5F5";

// ── Helpers ────────────────────────────────────────────────────────────────

function solidFill(argb: string) {
  return { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb } };
}

function applyBorders(row: any, cols: number, style: "thin" | "hair" | "medium" = "thin") {
  for (let i = 1; i <= cols; i++) {
    row.getCell(i).border = {
      top: { style }, left: { style }, bottom: { style }, right: { style },
    };
  }
}

function scoreBgFg(risk: TutarlilikSonuc["risk"] | null, hesaplanamadi: boolean): [string, string] {
  if (hesaplanamadi) return [GRAY_LT, "FF888888"];
  if (risk === "DUSUK_RISK")         return [GREEN_BG,  GREEN_FG];
  if (risk === "GOZDEN_GECIRILMELI") return [YELLOW_BG, YELLOW_FG];
  return [RED_BG, RED_FG];
}

function durumBgFg(durum: SkorKontrol["durum"]): [string, string] {
  if (durum === "GECTI")     return [GREEN_BG,  GREEN_FG];
  if (durum === "BASARISIZ") return [RED_BG,    RED_FG];
  return [YELLOW_BG, YELLOW_FG];
}

// ── Excel builder ──────────────────────────────────────────────────────────

async function buildExcel(tutarlilik: TutarlilikSonuc): Promise<Uint8Array> {
  const ExcelJS = require("exceljs");
  const wb = new ExcelJS.Workbook();

  const today = new Date().toLocaleDateString("tr-TR", {
    day: "2-digit", month: "long", year: "numeric",
  });

  const { skor, risk, riskEtiketi, kontroller, hesaplanamadi } = tutarlilik;
  const [scoreBg, scoreFg] = scoreBgFg(risk, hesaplanamadi);

  const gectiSayisi     = kontroller.filter(k => k.durum === "GECTI").length;
  const basarisizSayisi = kontroller.filter(k => k.durum === "BASARISIZ").length;
  const bilgiSayisi     = kontroller.filter(k => k.durum === "BILGI").length;
  const toplamKesinti   = kontroller.reduce((s, k) => s + Math.abs(Math.min(0, k.etki)), 0);

  // ── SHEET 1: Skor Özeti ──────────────────────────────────────────────────
  const ws1 = wb.addWorksheet("Skor Özeti");
  ws1.pageSetup = {
    paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, orientation: "portrait",
  };
  ws1.columns = [{ width: 30 }, { width: 22 }, { width: 18 }, { width: 46 }];

  // Row 1: Main title — merged A1:D1, orange bg, white bold 14pt centered
  ws1.mergeCells("A1:D1");
  const titleCell = ws1.getCell("A1");
  titleCell.value     = "VEZİN TUTARLILIK ANALİZ RAPORU";
  titleCell.fill      = solidFill(ORANGE);
  titleCell.font      = { bold: true, size: 14, color: { argb: WHITE } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws1.getRow(1).height = 34;

  // Row 2: Date — merged A2:D2
  ws1.mergeCells("A2:D2");
  const dateCell = ws1.getCell("A2");
  dateCell.value     = today;
  dateCell.fill      = solidFill(DARK_BLUE);
  dateCell.font      = { size: 10, color: { argb: WHITE } };
  dateCell.alignment = { horizontal: "center", vertical: "middle" };
  ws1.getRow(2).height = 18;

  // Row 3: spacer
  ws1.getRow(3).height = 8;

  // Row 4: Score (large, A4:B4) + Risk label (C4:D4)
  ws1.mergeCells("A4:B4");
  const scoreCell = ws1.getCell("A4");
  scoreCell.value     = hesaplanamadi ? "—" : skor;
  scoreCell.fill      = solidFill(scoreBg);
  scoreCell.font      = { bold: true, size: 28, color: { argb: scoreFg } };
  scoreCell.alignment = { horizontal: "center", vertical: "middle" };
  ws1.getRow(4).height = 54;

  ws1.mergeCells("C4:D4");
  const riskCell = ws1.getCell("C4");
  riskCell.value = hesaplanamadi
    ? "Skor Hesaplanamadı\n(Belge Okunamadı)"
    : `${riskEtiketi}\n(100 üzerinden ${skor} puan)`;
  riskCell.fill      = solidFill(scoreBg);
  riskCell.font      = { bold: true, size: 12, color: { argb: scoreFg } };
  riskCell.alignment = { horizontal: "left", vertical: "middle", wrapText: true, indent: 1 };

  // Row 5: Summary counts — merged A5:D5, dark blue
  ws1.mergeCells("A5:D5");
  const summaryCell = ws1.getCell("A5");
  summaryCell.value = hesaplanamadi
    ? "Kontroller değerlendirilemedi"
    : `${gectiSayisi} kontrol geçti  ·  ${basarisizSayisi} sorun  ·  ${bilgiSayisi} bilgi`;
  summaryCell.fill      = solidFill(DARK_BLUE);
  summaryCell.font      = { size: 10, color: { argb: WHITE } };
  summaryCell.alignment = { horizontal: "center", vertical: "middle" };
  ws1.getRow(5).height = 20;

  // Row 6: spacer
  ws1.getRow(6).height = 8;

  // Row 7: Table header
  const HEADERS = ["Kategori", "Açıklama", "Puan Etkisi", "Neden Önemli"];
  const hRow = ws1.getRow(7);
  hRow.height = 22;
  HEADERS.forEach((h, i) => {
    const c = hRow.getCell(i + 1);
    c.value     = h;
    c.fill      = solidFill(DARK_BLUE);
    c.font      = { bold: true, size: 10, color: { argb: WHITE } };
    c.alignment = { horizontal: "center", vertical: "middle" };
    c.border    = {
      top: { style: "medium" }, left: { style: "thin" },
      bottom: { style: "medium" }, right: { style: "thin" },
    };
  });

  // Rows 8+: Data rows per kontrol
  let dataRow = 8;
  for (const k of kontroller) {
    const [bg, fg] = durumBgFg(k.durum);
    const row = ws1.getRow(dataRow);

    row.getCell(1).value = k.ad;
    row.getCell(2).value = k.aciklama;
    row.getCell(3).value = k.etki !== 0 ? k.etki : (k.durum === "GECTI" ? "✓" : "–");
    row.getCell(4).value = k.aciklamaDetay ?? k.aciklama;

    for (let i = 1; i <= 4; i++) {
      const c = row.getCell(i);
      c.fill      = solidFill(bg);
      c.font      = { size: 9, color: { argb: i === 3 ? fg : "FF000000" }, bold: i === 3 };
      c.alignment = {
        horizontal: i === 3 ? "center" : "left",
        vertical: "middle",
        wrapText: i === 1 || i === 2 || i === 4,
        indent: i !== 3 ? 1 : 0,
      };
      c.border = {
        top: { style: "hair" }, left: { style: "thin" },
        bottom: { style: "hair" }, right: { style: "thin" },
      };
    }
    row.height = k.durum === "GECTI" ? 16 : 22;
    dataRow++;
  }

  // Totals row after data
  if (!hesaplanamadi && kontroller.length > 0) {
    const totRow = ws1.getRow(dataRow);
    totRow.height = 20;

    ws1.mergeCells(`A${dataRow}:B${dataRow}`);
    const totLabel = ws1.getCell(`A${dataRow}`);
    totLabel.value     = "Toplam Puan Kesintisi";
    totLabel.fill      = solidFill(DARK_BLUE);
    totLabel.font      = { bold: true, size: 10, color: { argb: WHITE } };
    totLabel.alignment = { horizontal: "right", vertical: "middle", indent: 1 };

    const totVal = ws1.getCell(`C${dataRow}`);
    totVal.value     = toplamKesinti > 0 ? -toplamKesinti : 0;
    totVal.fill      = solidFill(toplamKesinti > 0 ? RED_BG : GREEN_BG);
    totVal.font      = { bold: true, size: 10, color: { argb: toplamKesinti > 0 ? RED_FG : GREEN_FG } };
    totVal.alignment = { horizontal: "center", vertical: "middle" };

    ws1.mergeCells(`D${dataRow}:D${dataRow}`);
    const totNote = ws1.getCell(`D${dataRow}`);
    totNote.value     = `Nihai Skor: ${skor} / 100`;
    totNote.fill      = solidFill(DARK_BLUE);
    totNote.font      = { bold: true, size: 10, color: { argb: WHITE } };
    totNote.alignment = { horizontal: "left", vertical: "middle", indent: 1 };

    applyBorders(totRow, 4, "medium");
    dataRow++;
  }

  // Dipnot row
  dataRow += 1;
  ws1.mergeCells(`A${dataRow}:D${dataRow}`);
  const dipnot1 = ws1.getCell(`A${dataRow}`);
  dipnot1.value =
    "Vezin Tutarlılık Skoru resmî bir GİB değerlendirmesi değildir; iç kontrol amaçlıdır.";
  dipnot1.fill      = solidFill(GRAY_LT);
  dipnot1.font      = { italic: true, size: 8, color: { argb: "FF888888" } };
  dipnot1.alignment = { horizontal: "left", vertical: "middle", wrapText: true, indent: 1 };
  ws1.getRow(dataRow).height = 16;

  // ── SHEET 2: Puan Tablosu ────────────────────────────────────────────────
  const ws2 = wb.addWorksheet("Puan Tablosu");
  ws2.pageSetup = {
    paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, orientation: "portrait",
  };
  ws2.columns = [{ width: 18 }, { width: 16 }, { width: 54 }];

  // Title row
  ws2.mergeCells("A1:C1");
  const pt1 = ws2.getCell("A1");
  pt1.value     = "VEZİN TUTARLILIK SKORU — PUAN TABLOSU";
  pt1.fill      = solidFill(ORANGE);
  pt1.font      = { bold: true, size: 13, color: { argb: WHITE } };
  pt1.alignment = { horizontal: "center", vertical: "middle" };
  ws2.getRow(1).height = 30;

  // Subtitle row
  ws2.mergeCells("A2:C2");
  const pt2 = ws2.getCell("A2");
  pt2.value     = "Kontrol Ağırlıkları ve Puan Etkileri";
  pt2.fill      = solidFill(DARK_BLUE);
  pt2.font      = { bold: true, size: 10, color: { argb: WHITE } };
  pt2.alignment = { horizontal: "center", vertical: "middle" };
  ws2.getRow(2).height = 18;

  ws2.getRow(3).height = 8; // spacer

  // Weight table header
  const wHeaders = ["Ağırlık", "Puan Etkisi", "Kontrol Örnekleri"];
  const whRow = ws2.getRow(4);
  whRow.height = 22;
  wHeaders.forEach((h, i) => {
    const c = whRow.getCell(i + 1);
    c.value     = h;
    c.fill      = solidFill(DARK_BLUE);
    c.font      = { bold: true, size: 10, color: { argb: WHITE } };
    c.alignment = { horizontal: "center", vertical: "middle" };
    c.border    = {
      top: { style: "medium" }, left: { style: "thin" },
      bottom: { style: "medium" }, right: { style: "thin" },
    };
  });

  // Weight data rows
  const weightRows: Array<[string, string, string, string, string]> = [
    ["Kritik", "−15", "Matrah × KDV oranı tutarsızlığı, Ödenecek/Devreden çelişkisi", RED_BG, RED_FG],
    ["Orta",   "−10", "KDV toplamlar, Muhtasar↔SGK farkı, Vergi no tutarsızlığı",     YELLOW_BG, YELLOW_FG],
    ["Hafif",  "−5",  "VKN/TCKN format, Dönem format, Anormal tutar",                  GREEN_BG, GREEN_FG],
  ];

  let r2 = 5;
  for (const [agirlik, etki, ornekler, bg, fg] of weightRows) {
    const row = ws2.getRow(r2);
    row.height = 22;
    row.getCell(1).value = agirlik;
    row.getCell(2).value = etki;
    row.getCell(3).value = ornekler;

    for (let i = 1; i <= 3; i++) {
      const c = row.getCell(i);
      c.fill      = solidFill(bg);
      c.font      = { size: 10, color: { argb: fg }, bold: i <= 2 };
      c.alignment = {
        horizontal: i === 3 ? "left" : "center",
        vertical: "middle",
        wrapText: i === 3,
        indent: i === 3 ? 1 : 0,
      };
      c.border = {
        top: { style: "hair" }, left: { style: "thin" },
        bottom: { style: "hair" }, right: { style: "thin" },
      };
    }
    r2++;
  }

  r2 += 2; // spacer rows

  // Risk range table header
  ws2.mergeCells(`A${r2}:C${r2}`);
  const rHeader = ws2.getCell(`A${r2}`);
  rHeader.value     = "Risk Düzeyi Aralıkları";
  rHeader.fill      = solidFill(DARK_BLUE);
  rHeader.font      = { bold: true, size: 10, color: { argb: WHITE } };
  rHeader.alignment = { horizontal: "center", vertical: "middle" };
  ws2.getRow(r2).height = 20;
  r2++;

  const rangeHeaders = ["Skor Aralığı", "Risk Düzeyi", "Öneri"];
  const rhRow = ws2.getRow(r2);
  rhRow.height = 20;
  rangeHeaders.forEach((h, i) => {
    const c = rhRow.getCell(i + 1);
    c.value     = h;
    c.fill      = solidFill(DARK_BLUE);
    c.font      = { bold: true, size: 10, color: { argb: WHITE } };
    c.alignment = { horizontal: "center", vertical: "middle" };
    c.border    = {
      top: { style: "medium" }, left: { style: "thin" },
      bottom: { style: "medium" }, right: { style: "thin" },
    };
  });
  r2++;

  const rangeRows: Array<[string, string, string, string, string]> = [
    ["≥ 85",  "Düşük Risk",           "Sorun tespit edilmedi; rutin inceleme yeterli.",   GREEN_BG,  GREEN_FG],
    ["60–84", "Gözden Geçirilmeli",   "Bazı uyarılar mevcut; öncelikli gözden geçirin.", YELLOW_BG, YELLOW_FG],
    ["0–59",  "Yüksek Risk",          "Ciddi tutarsızlıklar; acil detaylı inceleme gerekli.", RED_BG, RED_FG],
  ];

  for (const [aralik, seviye, oneri, bg, fg] of rangeRows) {
    const row = ws2.getRow(r2);
    row.height = 22;
    row.getCell(1).value = aralik;
    row.getCell(2).value = seviye;
    row.getCell(3).value = oneri;

    for (let i = 1; i <= 3; i++) {
      const c = row.getCell(i);
      c.fill      = solidFill(bg);
      c.font      = { size: 10, color: { argb: fg }, bold: i <= 2 };
      c.alignment = {
        horizontal: i === 3 ? "left" : "center",
        vertical: "middle",
        wrapText: i === 3,
        indent: i === 3 ? 1 : 0,
      };
      c.border = {
        top: { style: "hair" }, left: { style: "thin" },
        bottom: { style: "hair" }, right: { style: "thin" },
      };
    }
    r2++;
  }

  // Dipnot
  r2 += 2;
  ws2.mergeCells(`A${r2}:C${r2}`);
  const dipnot2 = ws2.getCell(`A${r2}`);
  dipnot2.value =
    "Vezin Tutarlılık Skoru resmî bir GİB değerlendirmesi değildir; iç kontrol amaçlıdır.";
  dipnot2.fill      = solidFill(GRAY_LT);
  dipnot2.font      = { italic: true, size: 8, color: { argb: "FF888888" } };
  dipnot2.alignment = { horizontal: "left", vertical: "middle", wrapText: true, indent: 1 };
  ws2.getRow(r2).height = 16;

  const raw = await wb.xlsx.writeBuffer();
  return new Uint8Array(Buffer.from(raw));
}

// ── Route handler ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { role } = token as any;
  if (role !== "ADMIN") return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const tutarlilik: TutarlilikSonuc | null = body.tutarlilik ?? null;

  if (!tutarlilik) {
    return NextResponse.json({ error: "tutarlilik verisi bulunamadı" }, { status: 400 });
  }

  try {
    const buf      = await buildExcel(tutarlilik);
    const filename = `tutarlilik-analiz-${new Date().toISOString().slice(0, 10)}.xlsx`;

    return new NextResponse(buf as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    console.error("[tutarlilik/excel]", err);
    return NextResponse.json(
      { error: "Excel oluşturulamadı: " + (err?.message ?? "Bilinmeyen hata") },
      { status: 500 },
    );
  }
}
