import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { tutarlilikSayfasiEkle } from "@/lib/tutarlilik-skoru";
import { BYPASS_AUTH_ROLES } from "@/lib/auth-bypass";

export const dynamic = "force-dynamic";

// ── Types (mirrored from parent route) ────────────────────────────────────

interface Extraction {
  dosya_adi: string;
  belge_turu: string;
  mukellef: { unvan?: string; vergi_kimlik_no?: string; vergi_dairesi?: string } | string;
  donem: string;
  veriler: Array<{ alan: string; deger: string; birim?: string }>;
  failed?: boolean;
  failedReason?: string;
}

interface CheckResult {
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

function solidFill(argb: string) {
  return { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb } };
}

function getMukellef(mk: Extraction["mukellef"]) {
  if (!mk) return { unvan: "", vergiNo: "", daire: "" };
  if (typeof mk === "string") return { unvan: mk, vergiNo: "", daire: "" };
  return {
    unvan:   safeStr(mk.unvan),
    vergiNo: safeStr(mk.vergi_kimlik_no),
    daire:   safeStr(mk.vergi_dairesi),
  };
}

// ── Color palette ──────────────────────────────────────────────────────────

const C = {
  ORANGE:    "FFF57C28",
  ORANGE_LT: "FFFFF3E8",
  DARK_BLUE: "FF1F3864",
  LT_BLUE:   "FFD9E1F2",
  WHITE:     "FFFFFFFF",
  GRAY_LT:   "FFF5F5F5",
  GRAY_MED:  "FFE8E8E8",
  RED:       "FFFFE0E0",
  RED_DARK:  "FFC00000",
  GREEN:     "FFE2EFDA",
  GREEN_DRK: "FF375623",
  YELLOW:    "FFFFF2CC",
  YELLOW_DRK:"FF7F6000",
  NUM_FMT:   "#,##0.00",
};

// ── Excel builder ──────────────────────────────────────────────────────────

async function buildExcel(extractions: Extraction[], checks: CheckResult[], failedCount: number, successCount: number, tutarlilik?: any): Promise<Uint8Array> {
  const ExcelJS = require("exceljs");
  const wb = new ExcelJS.Workbook();

  const today = new Date().toLocaleDateString("tr-TR", {
    day: "2-digit", month: "long", year: "numeric",
  });

  // Mükellef from first extraction
  const first     = extractions[0];
  const mukellef  = getMukellef(first?.mukellef);
  const periods   = extractions.map(e => safeStr(e.donem)).filter(Boolean);
  const donemAlt  = periods.length > 1 ? `${periods[periods.length - 1]} – ${periods[0]}` : periods[0] ?? "";

  const uyariCount = checks.filter(c => c.status === "UYARI").length;
  const uygunCount = checks.filter(c => c.status === "UYGUN").length;
  const bilgiCount = checks.filter(c => c.status === "BİLGİ").length;

  function statusFill(status: string) {
    if (status === "UYARI") return solidFill(C.RED);
    if (status === "UYGUN") return solidFill(C.GREEN);
    return solidFill(C.YELLOW);
  }
  function statusFontColor(status: string) {
    if (status === "UYARI") return C.RED_DARK;
    if (status === "UYGUN") return C.GREEN_DRK;
    return C.YELLOW_DRK;
  }

  function applyBorders(row: any, cols: number, style: "thin" | "hair" = "thin") {
    for (let i = 1; i <= cols; i++) {
      row.getCell(i).border = {
        top: { style }, left: { style }, bottom: { style }, right: { style },
      };
    }
  }

  function mainHeader(ws: any, title: string, cols: number) {
    const ec = String.fromCharCode(64 + cols);
    ws.mergeCells(`A1:${ec}1`);
    const c = ws.getCell("A1");
    c.value = "BEYANNAME ÇAPRAZ KONTROL RAPORU";
    c.fill  = solidFill(C.ORANGE);
    c.font  = { bold: true, size: 14, color: { argb: C.WHITE } };
    c.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(1).height = 32;

    ws.mergeCells(`A2:${ec}2`);
    const c2 = ws.getCell("A2");
    c2.value = title;
    c2.fill  = solidFill(C.DARK_BLUE);
    c2.font  = { bold: true, size: 11, color: { argb: C.WHITE } };
    c2.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(2).height = 20;

    ws.getRow(3).height = 6;
  }

  function secHeader(ws: any, row: number, text: string, cols: number) {
    const ec = String.fromCharCode(64 + cols);
    ws.mergeCells(`A${row}:${ec}${row}`);
    const c = ws.getCell(`A${row}`);
    c.value = text; c.fill = solidFill(C.DARK_BLUE);
    c.font  = { bold: true, size: 10, color: { argb: C.WHITE } };
    c.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    ws.getRow(row).height = 20;
  }

  // ── SHEET 1 — ÖZET ────────────────────────────────────────────────────────
  const ws1 = wb.addWorksheet("ÖZET");
  ws1.pageSetup = { paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, orientation: "portrait" };
  ws1.columns  = [{ width: 34 }, { width: 52 }];
  mainHeader(ws1, "ÖZET", 2);

  // Mükellef bilgileri
  secHeader(ws1, 4, "Mükellef Bilgileri", 2);
  let r1 = 5;
  const infoRows: [string, string][] = [
    ["Mükellef Unvanı",           mukellef.unvan   || "—"],
    ["Vergi Dairesi",             mukellef.daire   || "—"],
    ["Vergi Kimlik No",           mukellef.vergiNo || "—"],
    ["İnceleme Dönemi",           donemAlt         || "—"],
    ["Rapor Tarihi",              today],
    ["Yüklenen Beyanname Sayısı", String(extractions.length)],
    ["Başarıyla Okunan",          String(successCount)],
    ["Okunamayan (Hata)",         String(failedCount)],
  ];
  for (const [label, value] of infoRows) {
    const row = ws1.getRow(r1);
    const lc  = row.getCell(1);
    lc.value = label; lc.fill = solidFill(C.LT_BLUE);
    lc.font  = { bold: true, size: 10 };
    lc.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    const vc  = row.getCell(2);
    vc.value = value; vc.fill = solidFill(C.WHITE);
    vc.font  = { size: 10 }; vc.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    applyBorders(row, 2);
    row.height = 19;
    r1++;
  }

  r1 += 2;

  // Okunamayan dosyalar — kırmızı hata satırları
  const failedExtractions = extractions.filter(e => e.failed);
  if (failedExtractions.length > 0) {
    secHeader(ws1, r1, `HATA: ${failedExtractions.length} Dosyadan Veri Çıkarılamadı`, 2);
    r1++;
    for (const fe of failedExtractions) {
      const row = ws1.getRow(r1);
      const lc  = row.getCell(1);
      lc.value = fe.dosya_adi; lc.fill = solidFill(C.RED);
      lc.font  = { bold: true, size: 10, color: { argb: C.RED_DARK } };
      lc.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
      const vc  = row.getCell(2);
      vc.value = fe.failedReason ?? "Veri çıkarılamadı"; vc.fill = solidFill(C.RED);
      vc.font  = { size: 10, color: { argb: C.RED_DARK } };
      vc.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
      applyBorders(row, 2);
      row.height = 19;
      r1++;
    }
    r1 += 2;
  }

  // Kontrol özeti sayıları
  secHeader(ws1, r1, "Kontrol Özeti", 2);
  r1++;
  const ozetRows: [string, string, string][] = [
    ["Toplam Kontrol Sayısı",  String(checks.length), C.LT_BLUE],
    ["Uyarı",                  String(uyariCount),    C.RED],
    ["Uygun",                  String(uygunCount),    C.GREEN],
    ["Bilgi Notu",             String(bilgiCount),    C.YELLOW],
  ];
  for (const [label, value, bg] of ozetRows) {
    const row = ws1.getRow(r1);
    const lc  = row.getCell(1);
    lc.value = label; lc.fill = solidFill(bg);
    lc.font  = { bold: true, size: 10 };
    lc.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    const vc  = row.getCell(2);
    vc.value = value; vc.fill = solidFill(bg);
    vc.font  = { bold: true, size: 11 };
    vc.alignment = { horizontal: "center", vertical: "middle" };
    applyBorders(row, 2);
    row.height = 19;
    r1++;
  }

  r1 += 2;

  // Yüklenen beyannameler
  secHeader(ws1, r1, "Yüklenen Beyannameler", 2);
  r1++;
  const bh = ws1.getRow(r1);
  ["Dönem", "Beyanname Türü"].forEach((h, i) => {
    const c = bh.getCell(i + 1);
    c.value = h; c.fill = solidFill(C.GRAY_MED);
    c.font  = { bold: true, size: 10 };
    c.alignment = { horizontal: "center" };
  });
  applyBorders(bh, 2);
  ws1.getRow(r1).height = 19;
  r1++;
  for (const ext of extractions) {
    const row = ws1.getRow(r1);
    row.getCell(1).value = safeStr(ext.donem) || "—";
    row.getCell(2).value = safeStr(ext.belge_turu) || "—";
    row.getCell(1).alignment = { horizontal: "center" };
    row.getCell(2).alignment = { horizontal: "left", indent: 1 };
    row.getCell(1).fill = solidFill(r1 % 2 === 0 ? C.GRAY_LT : C.WHITE);
    row.getCell(2).fill = solidFill(r1 % 2 === 0 ? C.GRAY_LT : C.WHITE);
    applyBorders(row, 2, "hair");
    row.height = 18;
    r1++;
  }

  r1 += 2;

  // Kontrol sonuçları (colored)
  secHeader(ws1, r1, "Kontrol Sonuçları", 2);
  r1++;
  for (const check of checks) {
    const bg = statusFill(check.status);
    const fc = statusFontColor(check.status);

    const row = ws1.getRow(r1);
    const c1  = row.getCell(1);
    c1.value = `[${check.status}] ${check.name}`;
    c1.fill  = bg; c1.font = { bold: true, size: 10, color: { argb: fc } };
    c1.alignment = { horizontal: "left", vertical: "middle", wrapText: true, indent: 1 };

    const c2 = row.getCell(2);
    c2.value = check.detail; c2.fill = bg;
    c2.font  = { size: 10, color: { argb: fc } };
    c2.alignment = { horizontal: "left", vertical: "middle", wrapText: true, indent: 1 };

    applyBorders(row, 2, "hair");
    row.height = 24;
    r1++;
  }

  // ── Tutarlılık Skoru bloğu (ÖZET sayfasında) ─────────────────────────────
  if (tutarlilik && !tutarlilik.hesaplanamadi) {
    r1 += 2;
    secHeader(ws1, r1, "Tutarlılık Skoru", 2);
    r1++;

    const { skor, riskEtiketi, risk, kontroller: tk } = tutarlilik;
    const [scoreBg, scoreFg] =
      risk === "DUSUK_RISK"         ? [C.GREEN,  C.GREEN_DRK]  :
      risk === "GOZDEN_GECIRILMELI" ? [C.YELLOW, C.YELLOW_DRK] :
                                      [C.RED,    C.RED_DARK];

    const scoreRow = ws1.getRow(r1);
    const sc1 = scoreRow.getCell(1);
    sc1.value = skor;
    sc1.fill  = solidFill(scoreBg);
    sc1.font  = { bold: true, size: 22, color: { argb: scoreFg } };
    sc1.alignment = { horizontal: "center", vertical: "middle" };
    const sc2 = scoreRow.getCell(2);
    sc2.value = `${riskEtiketi} — 100 üzerinden ${skor} puan`;
    sc2.fill  = solidFill(scoreBg);
    sc2.font  = { bold: true, size: 12, color: { argb: scoreFg } };
    sc2.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    applyBorders(scoreRow, 2);
    ws1.getRow(r1).height = 36;
    r1++;

    const gectiS     = tk.filter((k: any) => k.durum === "GECTI").length;
    const basarisizS = tk.filter((k: any) => k.durum === "BASARISIZ").length;
    const bilgiS     = tk.filter((k: any) => k.durum === "BILGI").length;

    for (const [label, value, bg] of [
      ["Geçen Kontrol", String(gectiS),     C.GREEN]  as const,
      ["Sorun Tespit",  String(basarisizS), C.RED]    as const,
      ["Bilgi Notu",    String(bilgiS),     C.YELLOW] as const,
    ]) {
      const row = ws1.getRow(r1);
      const lc  = row.getCell(1);
      lc.value = label; lc.fill = solidFill(bg);
      lc.font  = { bold: true, size: 10 };
      lc.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
      const vc  = row.getCell(2);
      vc.value = value; vc.fill = solidFill(bg);
      vc.font  = { bold: true, size: 11 };
      vc.alignment = { horizontal: "center", vertical: "middle" };
      applyBorders(row, 2);
      row.height = 18;
      r1++;
    }
  }

  // ── SHEET 2 — KONTROL DETAYI ──────────────────────────────────────────────
  const ws2 = wb.addWorksheet("KONTROL DETAYI");
  ws2.pageSetup = { paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, orientation: "landscape" };
  const hasTutarlilik = tutarlilik && !tutarlilik.hesaplanamadi;
  const tutarlilikMap: Map<string, any> = hasTutarlilik
    ? new Map(tutarlilik.kontroller.map((k: any) => [k.ad, k]))
    : new Map();
  const colCount2 = hasTutarlilik ? 9 : 7;
  ws2.columns = [
    { width: 36 }, // Kontrol Adı
    { width: 36 }, // Açıklama
    { width: 18 }, // Değer 1
    { width: 18 }, // Değer 2
    { width: 14 }, // Fark
    { width: 10 }, // Fark %
    { width: 10 }, // Sonuç
    ...(hasTutarlilik ? [{ width: 10 }, { width: 52 }] : []),
  ];
  mainHeader(ws2, "KONTROL DETAYI", colCount2);

  const colHeaders2 = [
    "Kontrol Adı", "Açıklama", "Değer 1", "Değer 2", "Fark (₺)", "Fark %", "Sonuç",
    ...(hasTutarlilik ? ["Puan Etkisi", "Neden Önemli"] : []),
  ];
  const chRow2 = ws2.getRow(4);
  colHeaders2.forEach((h, i) => {
    const c = chRow2.getCell(i + 1);
    c.value = h; c.fill = solidFill(C.GRAY_MED);
    c.font  = { bold: true, size: 10 };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.border = {
      top: { style: "medium" }, left: { style: "thin" },
      bottom: { style: "medium" }, right: { style: "thin" },
    };
  });
  ws2.getRow(4).height = 28;

  let r2 = 5;

  // Önce başarısız çıkarım satırları (kırmızı, kontrollerin başına)
  for (const fe of extractions.filter(e => e.failed)) {
    const row = ws2.getRow(r2);
    row.getCell(1).value = "ÇIKARIM BAŞARISIZ";
    row.getCell(2).value = `${fe.dosya_adi}: ${fe.failedReason ?? "Veri çıkarılamadı"}`;
    row.getCell(7).value = "HATA";
    for (let i = 1; i <= colCount2; i++) {
      row.getCell(i).fill = solidFill(C.RED);
      row.getCell(i).font = { size: 10, color: { argb: C.RED_DARK }, bold: i === 1 || i === 7 };
      row.getCell(i).alignment = {
        horizontal: i >= 3 && i <= 6 ? "right" : (i === 7 ? "center" : "left"),
        vertical: "middle", wrapText: i <= 2 || i === 9, indent: i <= 2 ? 1 : 0,
      };
      row.getCell(i).border = {
        top: { style: "hair" }, left: { style: "thin" },
        bottom: { style: "hair" }, right: { style: "thin" },
      };
    }
    row.height = 22;
    r2++;
  }

  for (const check of checks) {
    const bg = statusFill(check.status);
    const fc = statusFontColor(check.status);
    const row = ws2.getRow(r2);
    const skorKontrol = tutarlilikMap.get(check.name);

    row.getCell(1).value = check.name;
    row.getCell(2).value = check.detail;
    row.getCell(3).value = check.value1 ?? null;
    row.getCell(4).value = check.value2 ?? null;
    row.getCell(5).value = check.diff   ?? null;
    row.getCell(6).value = check.diffPercent != null ? (check.diffPercent / 100) : null;
    row.getCell(7).value = check.status;
    if (hasTutarlilik) {
      row.getCell(8).value = skorKontrol?.etki !== 0 ? (skorKontrol?.etki ?? null) : null;
      row.getCell(9).value = skorKontrol?.aciklamaDetay ?? skorKontrol?.aciklama ?? null;
    }

    [3, 4, 5].forEach(i => { if (row.getCell(i).value != null) row.getCell(i).numFmt = C.NUM_FMT; });
    if (row.getCell(6).value != null) row.getCell(6).numFmt = "0.0%";

    for (let i = 1; i <= colCount2; i++) {
      row.getCell(i).fill = bg;
      row.getCell(i).font = { size: 10, color: { argb: i === 7 ? fc : "FF000000" }, bold: i === 7 };
      row.getCell(i).alignment = {
        horizontal: i >= 3 && i <= 6 ? "right" : (i === 7 || i === 8 ? "center" : "left"),
        vertical: "middle",
        wrapText: i <= 2 || i === 9,
        indent: i <= 2 || i === 9 ? 1 : 0,
      };
      row.getCell(i).border = {
        top: { style: "hair" }, left: { style: "thin" },
        bottom: { style: "hair" }, right: { style: "thin" },
      };
    }
    row.height = hasTutarlilik && skorKontrol?.aciklamaDetay ? 40 : 22;
    r2++;
  }

  // ── SHEET 3 — BEYANNAME VERİLERİ ─────────────────────────────────────────
  const ws3 = wb.addWorksheet("BEYANNAME VERİLERİ");
  ws3.pageSetup = { paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, orientation: "portrait" };
  ws3.columns = [{ width: 20 }, { width: 44 }, { width: 20 }, { width: 10 }];
  mainHeader(ws3, "BEYANNAME VERİLERİ (Denetim İzi)", 4);

  const colHeaders3 = ["Dönem / Tür", "Alan", "Değer", "Birim"];
  const chRow3 = ws3.getRow(4);
  colHeaders3.forEach((h, i) => {
    const c = chRow3.getCell(i + 1);
    c.value = h; c.fill = solidFill(C.GRAY_MED);
    c.font  = { bold: true, size: 10 };
    c.alignment = { horizontal: "center", vertical: "middle" };
    c.border = {
      top: { style: "medium" }, left: { style: "thin" },
      bottom: { style: "medium" }, right: { style: "thin" },
    };
  });
  ws3.getRow(4).height = 22;

  let r3 = 5;
  for (const ext of extractions) {
    const groupLabel = `${safeStr(ext.donem) || "?"} — ${safeStr(ext.belge_turu) || ext.dosya_adi}`;

    // Group header
    ws3.mergeCells(`A${r3}:D${r3}`);
    const gh = ws3.getCell(`A${r3}`);
    gh.value = groupLabel; gh.fill = solidFill(C.DARK_BLUE);
    gh.font  = { bold: true, size: 10, color: { argb: C.WHITE } };
    gh.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    ws3.getRow(r3).height = 20;
    r3++;

    const veriler = Array.isArray(ext.veriler) ? ext.veriler : [];
    if (veriler.length === 0) {
      ws3.mergeCells(`A${r3}:D${r3}`);
      ws3.getCell(`A${r3}`).value = "(Veri çıkarılamadı)";
      ws3.getCell(`A${r3}`).font = { italic: true, size: 9, color: { argb: "FF888888" } };
      ws3.getCell(`A${r3}`).alignment = { horizontal: "center" };
      r3++;
    } else {
      for (const v of veriler) {
        const row  = ws3.getRow(r3);
        const alan = safeStr((v as any).alan ?? (v as any).ad ?? "");
        const dStr = safeStr((v as any).deger ?? (v as any).tutar ?? "");
        const num  = toNum(dStr);
        const birim = safeStr(v.birim ?? "");

        row.getCell(1).value = ""; // grouped above
        row.getCell(2).value = alan;
        row.getCell(3).value = num !== 0 ? num : dStr;
        row.getCell(4).value = birim;

        if (typeof row.getCell(3).value === "number") row.getCell(3).numFmt = C.NUM_FMT;
        row.getCell(2).alignment = { horizontal: "left", indent: 2 };
        row.getCell(3).alignment = { horizontal: "right" };
        row.getCell(4).alignment = { horizontal: "center" };

        const bg = r3 % 2 === 0 ? C.GRAY_LT : C.WHITE;
        for (let i = 1; i <= 4; i++) {
          row.getCell(i).fill = solidFill(bg);
          row.getCell(i).border = {
            top: { style: "hair" }, left: { style: "thin" },
            bottom: { style: "hair" }, right: { style: "thin" },
          };
        }
        row.getCell(2).font = { size: 10 };
        row.getCell(3).font = { size: 10 };
        row.height = 18;
        r3++;
      }
    }
    r3++; // spacer between groups
  }

  if (tutarlilik) tutarlilikSayfasiEkle(wb, tutarlilik);

  const raw = await wb.xlsx.writeBuffer();
  return new Uint8Array(Buffer.from(raw));
}

// ── Route handler ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  // GEÇİCİ: tüm giriş yapmış kullanıcılara açık
  // TODO: Uncomment ederek Admin+YMM kısıtına geri dön
  // const { role, department } = token as any;
  // if (role !== "ADMIN" && department !== "YEMINLI_MALI_MUSAVIR") return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const extractions: Extraction[] = body.extractions  ?? [];
  const checks: CheckResult[]     = body.checks       ?? [];
  const failedCount: number       = body.failedCount  ?? extractions.filter((e: Extraction) => e.failed).length;
  const successCount: number      = body.successCount ?? extractions.filter((e: Extraction) => !e.failed).length;
  const tutarlilik                = body.tutarlilik   ?? null;

  if (extractions.length === 0)
    return NextResponse.json({ error: "Veri bulunamadı" }, { status: 400 });

  try {
    const buf      = await buildExcel(extractions, checks, failedCount, successCount, tutarlilik);
    const filename = `capraz-kontrol-${new Date().toISOString().slice(0, 10)}.xlsx`;

    return new NextResponse(buf as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    console.error("[capraz-kontrol/excel]", err);
    return NextResponse.json(
      { error: "Excel oluşturulamadı: " + (err?.message ?? "Bilinmeyen hata") },
      { status: 500 },
    );
  }
}
