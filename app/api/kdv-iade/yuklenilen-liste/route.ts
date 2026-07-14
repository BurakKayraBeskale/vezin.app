import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { ParsedInvoice } from "../indirilecek-liste/route";

export const dynamic = "force-dynamic";

// ── Helpers ────────────────────────────────────────────────────────────────

function solidFill(argb: string) {
  return { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb } };
}

const ORANGE    = "FFF57C28";
const DARK_BLUE = "FF1F3864";
const WHITE     = "FFFFFFFF";
const GRAY_LT   = "FFF5F5F5";
const NUM_FMT   = "#,##0.00";

// ── GİB column definitions ─────────────────────────────────────────────────

const COLUMNS_MANUEL = [
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
  { header: "Yüklenim Türü",                                              width: 20 },
  { header: "GGB Tescil No'su",                                           width: 16 },
];

const COLUMNS_ORAN = [
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
  { header: "Yüklenilen KDV\n(Orana Göre)",                              width: 18 },
  { header: "Yüklenim Türü",                                              width: 20 },
  { header: "GGB Tescil No'su",                                           width: 16 },
];

// ── Excel builder ──────────────────────────────────────────────────────────

async function buildExcel(
  invoices: ParsedInvoice[],
  method: "manuel" | "oran",
  yuklenimTuru: string,
  ratio?: number,           // 0–1, only for "oran"
  toplamHasilat?: number,
  iadeIslemTutari?: number,
): Promise<Uint8Array> {
  const ExcelJS = require("exceljs");
  const wb      = new ExcelJS.Workbook();
  wb.creator    = "Vezin";
  wb.lastModifiedBy = "Vezin";

  const COLS     = method === "oran" ? COLUMNS_ORAN : COLUMNS_MANUEL;
  const colCount = COLS.length;
  const lastCol  = String.fromCharCode(64 + colCount); // A=65

  const ws = wb.addWorksheet("Yüklenilen KDV Listesi");
  ws.pageSetup = {
    paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, orientation: "landscape",
  };

  ws.columns = COLS.map(c => ({ width: c.width }));

  // ── Row 1: Main title ──
  ws.mergeCells(`A1:${lastCol}1`);
  const titleCell = ws.getCell("A1");
  titleCell.value     = "GİB YÜKLENİLEN KDV LİSTESİ";
  titleCell.fill      = solidFill(ORANGE);
  titleCell.font      = { bold: true, size: 14, color: { argb: WHITE } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 30;

  // ── Row 2: Subtitle ──
  const today   = new Date().toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });
  const methStr = method === "oran"
    ? `Oranla Dağıtım (Oran: %${((ratio ?? 0) * 100).toFixed(4)})`
    : "Manuel Seçim";
  ws.mergeCells(`A2:${lastCol}2`);
  const subCell = ws.getCell("A2");
  subCell.value     = `Oluşturulma tarihi: ${today}   |   Toplam fatura: ${invoices.length}   |   ${methStr}`;
  subCell.fill      = solidFill(DARK_BLUE);
  subCell.font      = { size: 10, color: { argb: WHITE } };
  subCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(2).height = 18;

  // ── Row 3: Column headers ──
  const hRow = ws.getRow(3);
  hRow.height = 36;
  COLS.forEach((col, i) => {
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
  let totalKdvHaric    = 0;
  let totalKdv         = 0;
  let totalYuklenilen  = 0;

  function addRow(
    sira: number,
    tarih: string, seri: string, siraNoInv: string,
    saticiUnvan: string, vergiNo: string,
    cins: string, miktar: string,
    kdvHaric: number, kdv: number,
    yuklenilen: number | null,   // null for "manuel" (no separate column)
    tur: string,
    isEven: boolean,
  ) {
    const row = ws.getRow(dataRow);
    const bg  = isEven ? GRAY_LT : WHITE;

    const vals: any[] = [
      sira, tarih, seri, siraNoInv,
      saticiUnvan, vergiNo,
      cins, miktar,
      kdvHaric, kdv,
    ];

    if (method === "oran") {
      vals.push(yuklenilen ?? 0);
    }

    vals.push(tur, ""); // Yüklenim Türü, GGB Tescil No

    vals.forEach((v, i) => {
      const c = row.getCell(i + 1);
      c.value  = v;
      c.fill   = solidFill(bg);
      c.font   = { size: 9 };
      c.border = {
        top: { style: "hair" }, left: { style: "thin" },
        bottom: { style: "hair" }, right: { style: "thin" },
      };
      const isKdvHaricCol    = i === 8;
      const isKdvCol         = i === 9;
      const isYuklenilenCol  = method === "oran" && i === 10;
      if (isKdvHaricCol || isKdvCol || isYuklenilenCol) {
        c.numFmt    = NUM_FMT;
        c.alignment = { horizontal: "right", vertical: "middle" };
      } else if (i === 0) {
        c.alignment = { horizontal: "center", vertical: "middle" };
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
    const tur    = yuklenimTuru || "Doğrudan yüklenim";

    // Always merge (one row per invoice) for yüklenilen list
    const cinsAll = [...new Set(inv.satirlar.map(l => l.cins).filter(Boolean))].join(", ") || "—";
    const miktarAll = inv.satirlar.length === 1
      ? `${inv.satirlar[0].miktar}${inv.satirlar[0].birim ? " " + inv.satirlar[0].birim : ""}`
      : `${inv.satirlar.length} kalem`;

    const yuklenilen = method === "oran" ? inv.kdvTutari * (ratio ?? 0) : null;

    addRow(
      siraNo, inv.tarihFmt, inv.seri, inv.siraNo,
      inv.saticiUnvan, inv.saticiVergiNo,
      cinsAll, miktarAll,
      inv.kdvHaricTutar, inv.kdvTutari,
      yuklenilen,
      tur,
      isEven,
    );

    totalKdvHaric   += inv.kdvHaricTutar;
    totalKdv        += inv.kdvTutari;
    if (yuklenilen !== null) totalYuklenilen += yuklenilen;
  }

  // ── Totals row ────────────────────────────────────────────────────────────
  const summaryColCount = method === "oran" ? 8 : 8; // A–H merged
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

  if (method === "oran") {
    const totYuk = totRow.getCell(11);
    totYuk.value     = totalYuklenilen;
    totYuk.numFmt    = NUM_FMT;
    totYuk.fill      = solidFill(ORANGE);
    totYuk.font      = { bold: true, size: 10, color: { argb: WHITE } };
    totYuk.alignment = { horizontal: "right", vertical: "middle" };
    totYuk.border    = { top: { style: "medium" }, left: { style: "thin" }, bottom: { style: "medium" }, right: { style: "thin" } };
    // remaining cols
    [12, 13].forEach(col => {
      const c = totRow.getCell(col);
      c.fill   = solidFill(ORANGE);
      c.border = { top: { style: "medium" }, left: { style: "thin" }, bottom: { style: "medium" }, right: col === 13 ? { style: "medium" } : { style: "thin" } };
    });
  } else {
    [11, 12].forEach(col => {
      const c = totRow.getCell(col);
      c.fill   = solidFill(ORANGE);
      c.border = { top: { style: "medium" }, left: { style: "thin" }, bottom: { style: "medium" }, right: col === 12 ? { style: "medium" } : { style: "thin" } };
    });
  }
  ws.getRow(dataRow).height = 20;
  dataRow++;

  // ── Oran summary section (method=oran only) ────────────────────────────
  if (method === "oran" && ratio !== undefined) {
    dataRow++; // blank row
    const summaryData = [
      ["Toplam Hasılat",        toplamHasilat ?? 0],
      ["İade İşlem Tutarı",     iadeIslemTutari ?? 0],
      ["Kullanılan Oran",       `%${((ratio) * 100).toFixed(4)}`],
      ["Toplam Yüklenilen KDV", totalYuklenilen],
    ];

    for (const [label, val] of summaryData) {
      const r = ws.getRow(dataRow);
      ws.mergeCells(`A${dataRow}:H${dataRow}`);
      const lc = r.getCell(1);
      lc.value     = label;
      lc.font      = { bold: true, size: 9 };
      lc.alignment = { horizontal: "right", vertical: "middle", indent: 1 };
      lc.fill      = solidFill("FFF5F5F5");
      lc.border    = { top: { style: "hair" }, left: { style: "thin" }, bottom: { style: "hair" }, right: { style: "thin" } };

      const vc = r.getCell(9);
      if (typeof val === "number") {
        vc.value  = val;
        vc.numFmt = NUM_FMT;
      } else {
        vc.value = val;
      }
      vc.font      = { size: 9 };
      vc.alignment = { horizontal: "right", vertical: "middle" };
      vc.fill      = solidFill("FFF5F5F5");
      vc.border    = { top: { style: "hair" }, left: { style: "thin" }, bottom: { style: "hair" }, right: { style: "thin" } };

      // Fill remaining cells in summary row
      for (let col = 10; col <= colCount; col++) {
        const c = r.getCell(col);
        c.fill   = solidFill("FFF5F5F5");
        c.border = { top: { style: "hair" }, left: { style: "thin" }, bottom: { style: "hair" }, right: col === colCount ? { style: "thin" } : { style: "hair" } };
      }
      r.height = 15;
      dataRow++;
    }
  }

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
  const method: "manuel" | "oran" = body.method ?? "manuel";
  const yuklenimTuru: string      = body.yuklenimTuru ?? "Doğrudan yüklenim";
  const toplamHasilat: number     = body.toplamHasilat ?? 0;
  const iadeIslemTutari: number   = body.iadeIslemTutari ?? 0;

  let ratio: number | undefined;
  if (method === "oran") {
    if (!toplamHasilat || toplamHasilat === 0)
      return NextResponse.json({ error: "Toplam hasılat sıfır olamaz" }, { status: 400 });
    ratio = iadeIslemTutari / toplamHasilat;
  }

  if (invoices.length === 0)
    return NextResponse.json({ error: "Veri bulunamadı" }, { status: 400 });

  try {
    const buf      = await buildExcel(invoices, method, yuklenimTuru, ratio, toplamHasilat, iadeIslemTutari);
    const filename = `yuklenilen-kdv-listesi-${new Date().toISOString().slice(0, 10)}.xlsx`;

    return new NextResponse(buf as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    console.error("[kdv-iade/yuklenilen-liste]", err);
    return NextResponse.json({ error: "Excel oluşturulamadı: " + (err?.message ?? "") }, { status: 500 });
  }
}
