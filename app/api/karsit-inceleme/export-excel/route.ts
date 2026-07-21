import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export const dynamic = "force-dynamic";

interface KarsitFatura {
  id: string;
  seri: string;
  siraNo: string;
  tarihFmt: string;
  tarihIso: string;
  unvan: string;
  vergiNo: string;
  cins: string;
  miktar: string;
  kdvHaricTutar: number;
  kdvOrani: number;
  kdvTutari: number;
  toplam: number;
  sourceFile: string;
}

function solidFill(argb: string) {
  return { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb } };
}

const ORANGE    = "FFF57C28";
const DARK_BLUE = "FF1F3864";
const WHITE     = "FFFFFFFF";
const GRAY_LT   = "FFF5F5F5";
const NUM_FMT   = "#,##0.00";

const COLUMNS = [
  { header: "Sıra No",                   width: 8  },
  { header: "Fatura Tarihi",             width: 14 },
  { header: "Seri",                      width: 8  },
  { header: "Sıra No",                   width: 16 },
  { header: "Düzenleyenin Unvanı",       width: 40 },
  { header: "VKN/TCKN",                  width: 18 },
  { header: "Mal/Hizmet Cinsi",          width: 35 },
  { header: "Miktar",                    width: 12 },
  { header: "KDV Hariç Tutar",           width: 18 },
  { header: "KDV Oranı (%)",             width: 12 },
  { header: "KDV Tutarı",                width: 16 },
  { header: "Toplam Tutar",              width: 16 },
];

async function buildExcel(
  faturalar: KarsitFatura[],
  meta: { mukellefUnvan: string; mukellefVkn: string; donemBas: string; donemBit: string; konu: string }
): Promise<Uint8Array> {
  const ExcelJS = require("exceljs");
  const wb      = new ExcelJS.Workbook();
  wb.creator    = "Vezin";

  const ws = wb.addWorksheet("Karşıt İnceleme");
  ws.pageSetup = {
    paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, orientation: "landscape",
  };

  ws.columns = COLUMNS.map(c => ({ width: c.width }));

  const colCount = COLUMNS.length;
  const lastCol  = String.fromCharCode(64 + colCount); // "L" for 12 cols

  // ── Row 1: Main title ──
  ws.mergeCells(`A1:${lastCol}1`);
  const titleCell = ws.getCell("A1");
  const konuLabel = meta.konu === "TAM_TASDIK" ? "Tam Tasdik" : "KDV İadesi";
  titleCell.value     = `KARŞIT İNCELEME LİSTESİ — ${konuLabel}`;
  titleCell.fill      = solidFill(ORANGE);
  titleCell.font      = { bold: true, size: 14, color: { argb: WHITE } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 30;

  // ── Row 2: Subtitle ──
  ws.mergeCells(`A2:${lastCol}2`);
  const subCell = ws.getCell("A2");
  subCell.value     = `${meta.mukellefUnvan}  |  VKN: ${meta.mukellefVkn}  |  Dönem: ${meta.donemBas} – ${meta.donemBit}  |  Toplam fatura: ${faturalar.length}`;
  subCell.fill      = solidFill(DARK_BLUE);
  subCell.font      = { size: 10, color: { argb: WHITE } };
  subCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(2).height = 18;

  // ── Row 3: Column headers ──
  const hRow = ws.getRow(3);
  hRow.height = 28;
  COLUMNS.forEach((col, i) => {
    const c = hRow.getCell(i + 1);
    c.value     = col.header;
    c.fill      = solidFill(ORANGE);
    c.font      = { bold: true, size: 9, color: { argb: WHITE } };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.border    = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "medium" }, right: { style: "thin" } };
  });

  // ── Data rows ──
  let dataRow = 4;
  let totalKdvHaric = 0;
  let totalKdv      = 0;
  let totalToplam   = 0;

  faturalar.forEach((f, idx) => {
    const isEven = idx % 2 === 0;
    const bg     = isEven ? GRAY_LT : WHITE;
    const row    = ws.getRow(dataRow);
    row.height   = 15;

    const vals = [
      idx + 1,
      f.tarihFmt,
      f.seri,
      f.siraNo,
      f.unvan,
      f.vergiNo,
      f.cins,
      f.miktar,
      f.kdvHaricTutar,
      f.kdvOrani,
      f.kdvTutari,
      f.toplam,
    ];

    vals.forEach((v, i) => {
      const c  = row.getCell(i + 1);
      c.value  = v;
      c.fill   = solidFill(bg);
      c.font   = { size: 9 };
      c.border = {
        top: { style: "hair" }, left: { style: "thin" },
        bottom: { style: "hair" }, right: { style: "thin" },
      };

      if ([8, 10, 11].includes(i)) {
        c.numFmt    = NUM_FMT;
        c.alignment = { horizontal: "right", vertical: "middle" };
      } else if (i === 9) {
        c.alignment = { horizontal: "center", vertical: "middle" };
      } else if (i === 0) {
        c.alignment = { horizontal: "center", vertical: "middle" };
      } else {
        c.alignment = { horizontal: "left", vertical: "middle" };
      }
    });

    totalKdvHaric += f.kdvHaricTutar;
    totalKdv      += f.kdvTutari;
    totalToplam   += f.toplam;
    dataRow++;
  });

  // ── Totals row ──
  const totRow = ws.getRow(dataRow);
  ws.mergeCells(`A${dataRow}:H${dataRow}`);
  const totLabel = totRow.getCell(1);
  totLabel.value     = "TOPLAM";
  totLabel.fill      = solidFill(ORANGE);
  totLabel.font      = { bold: true, size: 10, color: { argb: WHITE } };
  totLabel.alignment = { horizontal: "right", vertical: "middle", indent: 1 };
  totLabel.border    = { top: { style: "medium" }, left: { style: "medium" }, bottom: { style: "medium" }, right: { style: "thin" } };

  function totCell(col: number, val: number) {
    const c = totRow.getCell(col);
    c.value     = val;
    c.numFmt    = NUM_FMT;
    c.fill      = solidFill(ORANGE);
    c.font      = { bold: true, size: 10, color: { argb: WHITE } };
    c.alignment = { horizontal: "right", vertical: "middle" };
    c.border    = { top: { style: "medium" }, left: { style: "thin" }, bottom: { style: "medium" }, right: { style: "thin" } };
  }

  // Skip KDV Oranı col (10), fill rest
  totCell(9, totalKdvHaric);
  const kdvOraniCell = totRow.getCell(10);
  kdvOraniCell.fill   = solidFill(ORANGE);
  kdvOraniCell.border = { top: { style: "medium" }, left: { style: "thin" }, bottom: { style: "medium" }, right: { style: "thin" } };
  totCell(11, totalKdv);
  totCell(12, totalToplam);
  totRow.getCell(12).border = { top: { style: "medium" }, left: { style: "thin" }, bottom: { style: "medium" }, right: { style: "medium" } };
  ws.getRow(dataRow).height = 20;

  ws.views = [{ state: "frozen", ySplit: 3 }];

  const raw = await wb.xlsx.writeBuffer();
  return new Uint8Array(Buffer.from(raw));
}

// ── Route ─────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { role, department } = token as any;
  if (role !== "ADMIN" && department !== "YEMINLI_MALI_MUSAVIR" && department !== "MUHASEBE") {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }

  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 }); }

  const { faturalar = [], mukellefUnvan = "", mukellefVkn = "", donemBas = "", donemBit = "", konu = "KDV_IADE" } = body;

  if (faturalar.length === 0)
    return NextResponse.json({ error: "Fatura listesi boş" }, { status: 400 });

  try {
    const buf      = await buildExcel(faturalar, { mukellefUnvan, mukellefVkn, donemBas, donemBit, konu });
    const filename = `karsit-inceleme-${mukellefVkn}-${donemBas.replace("/", "")}-${donemBit.replace("/", "")}.xlsx`;

    return new NextResponse(buf as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    console.error("[karsit-inceleme/export-excel]", err);
    return NextResponse.json({ error: "Excel oluşturulamadı: " + (err?.message ?? "") }, { status: 500 });
  }
}
