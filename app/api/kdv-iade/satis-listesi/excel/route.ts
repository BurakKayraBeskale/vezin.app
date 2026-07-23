import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { SatisInvoice } from "../route";
import { BYPASS_AUTH_ROLES } from "@/lib/auth-bypass";

export const dynamic = "force-dynamic";

// ── Helpers ────────────────────────────────────────────────────────────────

function solidFill(argb: string) {
  return { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb } };
}

const C = {
  ORANGE:    "FFF57C28",
  ORANGE_LT: "FFFFF3E8",
  NAVY:      "FF1E2235",
  GRAY_LT:   "FFF0F0F0",
  WHITE:     "FFFFFFFF",
  BLUE_LT:   "FFD6E4F0",   // İhraç kayıtlı satırı
  YELLOW_LT: "FFFFFDE7",   // KDV İstisnası satırı
  NUM_FMT:   '#,##0.00',
};

// ── Sütun tanımları ────────────────────────────────────────────────────────

const SPACER_WIDTH = 3;

const COLUMNS = [
  { header: "Sıra No",                                                    width: 7  },
  { header: "Satış Faturasının Tarihi",                                   width: 14 },
  { header: "Satış Faturasının Serisi",                                   width: 12 },
  { header: "Satış Faturasının Sıra No'su",                              width: 16 },
  { header: "Alıcının Adı-Soyadı / Ünvanı",                             width: 36 },
  { header: "Alıcının Vergi Kimlik Numarası / TC Kimlik Numarası",       width: 22 },
  { header: "Satılan Mal ve/veya Hizmetin Cinsi",                        width: 30 },
  { header: "Satılan Mal ve/veya Hizmetin Miktarı",                      width: 14 },
  { header: "Satılan Mal ve/veya Hizmetin KDV Hariç Tutarı",            width: 20 },
  { header: "KDV'si",                                                     width: 16 },
  { header: "Tür",                                                        width: 18 },
  { header: "Kaynak",                                                     width: 12 },
];

const TOTAL_COLS  = 1 + COLUMNS.length; // A(spacer) + 12
const LAST_COL_LTR = String.fromCharCode(64 + TOTAL_COLS); // M

// ── Excel oluşturucu ───────────────────────────────────────────────────────

async function buildExcel(invoices: SatisInvoice[]): Promise<Uint8Array> {
  const ExcelJS = require("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = "Vezin";

  const ws = wb.addWorksheet("Satış Fatura Listesi");
  ws.pageSetup = {
    paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, orientation: "landscape",
  };

  ws.columns = [
    { width: SPACER_WIDTH },
    ...COLUMNS.map(col => ({ width: col.width })),
  ];

  // ── Satır 1: boş ─────────────────────────────────────────────────────────
  ws.getRow(1).height = 6;

  // ── Satır 2: Belge başlığı ────────────────────────────────────────────────
  ws.mergeCells(`B2:${LAST_COL_LTR}2`);
  const titleCell = ws.getCell("B2");
  titleCell.value     = "SATIŞ FATURA LİSTESİ";
  titleCell.fill      = solidFill(C.NAVY);
  titleCell.font      = { bold: true, size: 14, color: { argb: C.WHITE } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(2).height = 32;

  // ── Satır 3: açıklama / renk kodu ────────────────────────────────────────
  ws.mergeCells(`B3:${LAST_COL_LTR}3`);
  const legendCell = ws.getCell("B3");
  legendCell.value     = "Renk:  Normal (beyaz/açık turuncu)   |   İhraç Kayıtlı (mavi)   |   KDV İstisnası (sarı)";
  legendCell.fill      = solidFill("FFF8F8F8");
  legendCell.font      = { italic: true, size: 8, color: { argb: "FF666666" } };
  legendCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(3).height  = 14;

  // ── Satır 4: Başlık satırı ────────────────────────────────────────────────
  const hRow = ws.getRow(4);
  hRow.height = 52;

  COLUMNS.forEach((col, i) => {
    const c = hRow.getCell(i + 2); // B=2 den başlar
    c.value     = col.header;
    c.fill      = solidFill(C.ORANGE);
    c.font      = { bold: true, size: 9, color: { argb: C.WHITE } };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.border    = {
      top: { style: "thin" }, left: { style: "thin" },
      bottom: { style: "medium" }, right: { style: "thin" },
    };
  });

  // ── Satır 5+: veri ────────────────────────────────────────────────────────
  let dataRowNum    = 5;
  let siraNo        = 0;
  let totalKdvHaric = 0;
  let totalKdv      = 0;

  function rowBg(tur: SatisInvoice["tur"], isEven: boolean): string {
    if (tur === "İhraç Kayıtlı") return C.BLUE_LT;
    if (tur === "KDV İstisnası") return C.YELLOW_LT;
    return isEven ? C.ORANGE_LT : C.WHITE;
  }

  function addDataRow(
    sira: number,
    tarih: string, seri: string, invSiraNo: string,
    aliciUnvan: string, vergiNo: string,
    cins: string, miktar: string,
    kdvHaric: number, kdv: number,
    tur: string,
    isEven: boolean,
    turEnum: SatisInvoice["tur"],
    sourceFile: string,
  ) {
    const row    = ws.getRow(dataRowNum);
    const bg     = rowBg(turEnum, isEven);
    const kaynak = sourceFile === "pdf-ai" ? "PDF (AI)" : sourceFile === "excel-import" ? "Excel" : "XML";

    const vals = [
      sira, tarih, seri, invSiraNo,
      aliciUnvan, vergiNo,
      cins, miktar,
      kdvHaric, kdv,
      tur, kaynak,
    ];

    vals.forEach((v, i) => {
      const c = row.getCell(i + 2); // B=2
      c.value  = v;
      c.fill   = solidFill(bg);
      c.font   = { size: 9 };
      c.border = {
        top: { style: "hair" }, left: { style: "thin" },
        bottom: { style: "hair" }, right: { style: "thin" },
      };
      if (i === 8 || i === 9) {
        c.numFmt    = C.NUM_FMT;
        c.alignment = { horizontal: "right", vertical: "middle" };
      } else if (i === 0) {
        c.alignment = { horizontal: "center", vertical: "middle" };
      } else if (i === 11) { // Kaynak
        c.alignment = { horizontal: "center", vertical: "middle" };
        if (kaynak === "PDF (AI)") c.font = { size: 9, color: { argb: "FF7C3AED" } };
      } else {
        c.alignment = { horizontal: "left", vertical: "middle" };
      }
    });

    row.height = 16;
    dataRowNum++;
  }

  for (const inv of invoices) {
    siraNo++;
    const isEven  = siraNo % 2 === 0;
    const cinsAll = [...new Set(inv.satirlar.map(l => l.cins).filter(Boolean))].join(", ") || "—";
    const miktarAll = inv.satirlar.length === 1
      ? `${inv.satirlar[0].miktar}${inv.satirlar[0].birim ? " " + inv.satirlar[0].birim : ""}`
      : `${inv.satirlar.length} kalem`;

    addDataRow(
      siraNo, inv.tarihFmt, inv.seri, inv.siraNo,
      inv.aliciUnvan, inv.aliciVergiNo,
      cinsAll, miktarAll,
      inv.kdvHaricTutar, inv.kdvTutari,
      inv.tur, isEven, inv.tur, inv.sourceFile,
    );
    totalKdvHaric += inv.kdvHaricTutar;
    totalKdv      += inv.kdvTutari;
  }

  // ── TOPLAM satırı ─────────────────────────────────────────────────────────
  dataRowNum++; // boş ara satır
  const totRow = ws.getRow(dataRowNum);

  // B:I (col 2..9) birleştir → "TOPLAM"
  ws.mergeCells(`B${dataRowNum}:I${dataRowNum}`);

  function totCell(absColIdx: number, val: any, isNum = false, isLabel = false) {
    const c = totRow.getCell(absColIdx);
    c.value  = val;
    c.fill   = solidFill(C.GRAY_LT);
    c.font   = { bold: true, size: 10 };
    c.border = {
      top:    { style: "double" },
      left:   { style: "thin" },
      bottom: { style: "medium" },
      right:  { style: "thin" },
    };
    if (isNum) {
      c.numFmt    = C.NUM_FMT;
      c.alignment = { horizontal: "right", vertical: "middle" };
    } else if (isLabel) {
      c.alignment = { horizontal: "right", vertical: "middle", indent: 1 };
    } else {
      c.alignment = { horizontal: "left", vertical: "middle" };
    }
  }

  totCell(2,  "TOPLAM",       false, true); // B (merged başlangıcı)
  totCell(10, totalKdvHaric,  true);         // J = KDV Hariç
  totCell(11, totalKdv,       true);         // K = KDV
  for (let col = 12; col <= TOTAL_COLS; col++) totCell(col, "");

  totRow.height = 22;

  // ── Dondur: başlık satırı ─────────────────────────────────────────────────
  ws.views = [{ state: "frozen", ySplit: 4 }];

  const raw = await wb.xlsx.writeBuffer();
  return new Uint8Array(Buffer.from(raw));
}

// ── Route ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { role } = token as any;
  if (!BYPASS_AUTH_ROLES && role !== "ADMIN") return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const invoices: SatisInvoice[] = body.invoices ?? [];

  if (invoices.length === 0)
    return NextResponse.json({ error: "Veri bulunamadı" }, { status: 400 });

  try {
    const buf      = await buildExcel(invoices);
    const filename = `satis-fatura-listesi-${new Date().toISOString().slice(0, 10)}.xlsx`;

    return new NextResponse(buf as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    console.error("[satis-listesi/excel]", err);
    return NextResponse.json({ error: "Excel oluşturulamadı: " + (err?.message ?? "") }, { status: 500 });
  }
}
