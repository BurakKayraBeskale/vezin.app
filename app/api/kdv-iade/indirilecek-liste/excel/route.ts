import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { ParsedInvoice } from "../route";

export const dynamic = "force-dynamic";

// ── Helpers ────────────────────────────────────────────────────────────────

function solidFill(argb: string) {
  return { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb } };
}

const ORANGE    = "FFF57C28";
const DARK_BLUE = "FF1F3864";
const WHITE     = "FFFFFFFF";
const GRAY_LT   = "FFF5F5F5";
const GRAY_MED  = "FFE8E8E8";
const NUM_FMT   = "#,##0.00";

// ── GİB column definitions ─────────────────────────────────────────────────

const GIB_COLUMNS = [
  { header: "Sıra No",                                                    width: 8  },
  { header: "Alış Faturasının Tarihi",                                    width: 16 },
  { header: "Alış Faturasının Serisi",                                    width: 12 },
  { header: "Alış Faturasının Sıra No'su",                               width: 18 },
  { header: "Satıcının Adı Soyadı / Unvanı",                             width: 40 },
  { header: "Satıcının Vergi Kimlik / TC Kimlik Numarası",               width: 25 },
  { header: "Alınan Mal ve/veya Hizmetin Cinsi",                         width: 35 },
  { header: "Alınan Mal ve/veya Hizmetin Miktarı",                       width: 14 },
  { header: "Alınan Mal ve/veya Hizmetin KDV Hariç Tutarı",             width: 22 },
  { header: "KDV'si",                                                     width: 16 },
  { header: "GGB Tescil No'su",                                           width: 16 },
  { header: "Belgenin İndirim Hakkının\nKullanıldığı KDV Dönemi",        width: 20 },
  { header: "Kaynak",                                                      width: 12 },
];

// ── Excel builder ──────────────────────────────────────────────────────────

async function buildExcel(invoices: ParsedInvoice[], merge: boolean): Promise<Uint8Array> {
  const ExcelJS  = require("exceljs");
  const wb       = new ExcelJS.Workbook();
  wb.creator     = "Vezin";
  wb.lastModifiedBy = "Vezin";

  const ws = wb.addWorksheet("İndirilecek KDV Listesi");
  ws.pageSetup = {
    paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, orientation: "landscape",
  };

  // Column widths
  ws.columns = GIB_COLUMNS.map(c => ({ width: c.width }));

  // ── Row 1: Main title ──
  ws.mergeCells("A1:M1");
  const titleCell = ws.getCell("A1");
  titleCell.value     = "GİB İNDİRİLECEK KDV LİSTESİ";
  titleCell.fill      = solidFill(ORANGE);
  titleCell.font      = { bold: true, size: 14, color: { argb: WHITE } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 30;

  // ── Row 2: Subtitle ──
  const today = new Date().toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });
  ws.mergeCells("A2:M2");
  const subCell = ws.getCell("A2");
  subCell.value     = `Oluşturulma tarihi: ${today}   |   Toplam fatura: ${invoices.length}   |   ${merge ? "Birleştirilmiş görünüm" : "Kalem bazında görünüm"}`;
  subCell.fill      = solidFill(DARK_BLUE);
  subCell.font      = { size: 10, color: { argb: WHITE } };
  subCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(2).height = 18;

  // ── Row 3: Column headers ──
  const hRow = ws.getRow(3);
  hRow.height = 36;
  GIB_COLUMNS.forEach((col, i) => {
    const c = hRow.getCell(i + 1);
    c.value     = col.header;
    c.fill      = solidFill(ORANGE);
    c.font      = { bold: true, size: 9, color: { argb: WHITE } };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.border    = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "medium" }, right: { style: "thin" } };
  });

  // ── Data rows ──────────────────────────────────────────────────────────────
  let dataRow = 4;
  let siraNo  = 0;

  let totalKdvHaric = 0;
  let totalKdv      = 0;

  function addRow(
    sira: number,
    tarih: string, seri: string, siraNoInv: string,
    saticiUnvan: string, vergiNo: string,
    cins: string, miktar: string,
    kdvHaric: number, kdv: number,
    donemi: string,
    isEven: boolean,
    sourceFile: string,
  ) {
    const row = ws.getRow(dataRow);
    const bg  = isEven ? GRAY_LT : WHITE;

    const kaynak = sourceFile === "pdf-ai" ? "PDF (AI)" : sourceFile === "excel-import" ? "Excel" : "XML";

    const vals = [
      sira, tarih, seri, siraNoInv,
      saticiUnvan, vergiNo,
      cins, miktar,
      kdvHaric, kdv,
      "",         // GGB Tescil No — boş
      donemi,
      kaynak,
    ];

    vals.forEach((v, i) => {
      const c = row.getCell(i + 1);
      c.value     = v;
      c.fill      = solidFill(bg);
      c.font      = { size: 9 };
      c.border    = {
        top: { style: "hair" }, left: { style: "thin" },
        bottom: { style: "hair" }, right: { style: "thin" },
      };
      // Number formatting
      if (i === 8 || i === 9) { // KDV Hariç Tutar, KDV
        c.numFmt    = NUM_FMT;
        c.alignment = { horizontal: "right", vertical: "middle" };
      } else if (i === 0) {
        c.alignment = { horizontal: "center", vertical: "middle" };
      } else if (i === 12) { // Kaynak
        c.alignment = { horizontal: "center", vertical: "middle" };
        if (vals[12] === "PDF (AI)") {
          c.font = { size: 9, color: { argb: "FF7C3AED" } };
        }
      } else {
        c.alignment = { horizontal: "left", vertical: "middle", wrapText: false };
      }
    });

    row.height = 15;
    dataRow++;
  }

  for (const inv of invoices) {
    siraNo++;
    const isEven = siraNo % 2 === 0;

    if (merge) {
      // ── Birleştir: one row per invoice ──
      const cinsAll = [...new Set(inv.satirlar.map(l => l.cins).filter(Boolean))].join(", ") || "—";
      const miktarAll = inv.satirlar.length === 1
        ? `${inv.satirlar[0].miktar}${inv.satirlar[0].birim ? " " + inv.satirlar[0].birim : ""}`
        : `${inv.satirlar.length} kalem`;

      addRow(
        siraNo, inv.tarihFmt, inv.seri, inv.siraNo,
        inv.saticiUnvan, inv.saticiVergiNo,
        cinsAll, miktarAll,
        inv.kdvHaricTutar, inv.kdvTutari,
        inv.donemi,
        isEven,
        inv.sourceFile,
      );
      totalKdvHaric += inv.kdvHaricTutar;
      totalKdv      += inv.kdvTutari;

    } else {
      // ── Kalem bazında: one row per line ──
      const lines = inv.satirlar.length > 0 ? inv.satirlar : [{
        cins: "—", miktar: 1, birim: "", kdvHaricTutar: inv.kdvHaricTutar,
        kdvOrani: inv.kdvOrani, kdvTutari: inv.kdvTutari,
      }];

      lines.forEach((line, li) => {
        const miktarStr = `${line.miktar}${line.birim ? " " + line.birim : ""}`;
        addRow(
          li === 0 ? siraNo : 0,  // Only show sıra no on first line of invoice
          inv.tarihFmt, inv.seri, inv.siraNo,
          inv.saticiUnvan, inv.saticiVergiNo,
          line.cins || "—", miktarStr,
          line.kdvHaricTutar, line.kdvTutari,
          inv.donemi,
          isEven,
          inv.sourceFile,
        );
        totalKdvHaric += line.kdvHaricTutar;
        totalKdv      += line.kdvTutari;
      });
    }
  }

  // ── Totals row ────────────────────────────────────────────────────────────
  const totRow = ws.getRow(dataRow);
  ws.mergeCells(`A${dataRow}:H${dataRow}`);
  const totLabel = totRow.getCell(1);
  totLabel.value     = "TOPLAM";
  totLabel.fill      = solidFill(ORANGE);
  totLabel.font      = { bold: true, size: 10, color: { argb: WHITE } };
  totLabel.alignment = { horizontal: "right", vertical: "middle", indent: 1 };
  totLabel.border    = { top: { style: "medium" }, left: { style: "medium" }, bottom: { style: "medium" }, right: { style: "thin" } };

  const totKdvHaric = totRow.getCell(9);
  totKdvHaric.value     = totalKdvHaric;
  totKdvHaric.numFmt    = NUM_FMT;
  totKdvHaric.fill      = solidFill(ORANGE);
  totKdvHaric.font      = { bold: true, size: 10, color: { argb: WHITE } };
  totKdvHaric.alignment = { horizontal: "right", vertical: "middle" };
  totKdvHaric.border    = { top: { style: "medium" }, left: { style: "thin" }, bottom: { style: "medium" }, right: { style: "thin" } };

  const totKdv = totRow.getCell(10);
  totKdv.value     = totalKdv;
  totKdv.numFmt    = NUM_FMT;
  totKdv.fill      = solidFill(ORANGE);
  totKdv.font      = { bold: true, size: 10, color: { argb: WHITE } };
  totKdv.alignment = { horizontal: "right", vertical: "middle" };
  totKdv.border    = { top: { style: "medium" }, left: { style: "thin" }, bottom: { style: "medium" }, right: { style: "thin" } };

  [11, 12, 13].forEach(col => {
    const c = totRow.getCell(col);
    c.fill   = solidFill(ORANGE);
    c.border = { top: { style: "medium" }, left: { style: "thin" }, bottom: { style: "medium" }, right: col === 13 ? { style: "medium" } : { style: "thin" } };
  });
  ws.getRow(dataRow).height = 20;

  // ── Freeze header rows ──
  ws.views = [{ state: "frozen", ySplit: 3 }];

  const raw = await wb.xlsx.writeBuffer();
  return new Uint8Array(Buffer.from(raw));
}

// ── Route ─────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { role } = token as any;
  if (role !== "ADMIN") return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const invoices: ParsedInvoice[] = body.invoices ?? [];
  const merge: boolean            = body.merge     ?? true;

  if (invoices.length === 0)
    return NextResponse.json({ error: "Veri bulunamadı" }, { status: 400 });

  try {
    const buf      = await buildExcel(invoices, merge);
    const filename = `indirilecek-kdv-listesi-${new Date().toISOString().slice(0, 10)}.xlsx`;

    return new NextResponse(buf as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    console.error("[kdv-iade/excel]", err);
    return NextResponse.json({ error: "Excel oluşturulamadı: " + (err?.message ?? "") }, { status: 500 });
  }
}
