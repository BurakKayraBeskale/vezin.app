import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { ParsedInvoice } from "../indirilecek-liste/route";
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
  NUM_FMT:   '#,##0.00',
};

// ── Sütun tanımları ────────────────────────────────────────────────────────

const SPACER_WIDTH = 3;

const COLS_MANUEL = [
  { header: "Sıra No",                                                   width: 7  },
  { header: "Alış Faturasının Tarihi",                                   width: 14 },
  { header: "Alış Faturasının Serisi",                                   width: 12 },
  { header: "Alış Faturasının Sıra No'su",                              width: 16 },
  { header: "Satıcının Adı-Soyadı / Ünvanı",                            width: 36 },
  { header: "Satıcının Vergi Kimlik Numarası / TC Kimlik Numarası",      width: 22 },
  { header: "Alınan Mal ve/veya Hizmetin Cinsi",                        width: 30 },
  { header: "Alınan Mal ve/veya Hizmetin Miktarı",                      width: 14 },
  { header: "Alınan Mal ve/veya Hizmetin KDV Hariç Tutarı",             width: 20 },
  { header: "KDV'si",                                                    width: 16 },
  { header: "Yüklenim Türü",                                             width: 20 },
  { header: "GGB Tescil No'su",                                          width: 16 },
  { header: "Kaynak",                                                    width: 12 },
];

const COLS_ORAN = [
  { header: "Sıra No",                                                   width: 7  },
  { header: "Alış Faturasının Tarihi",                                   width: 14 },
  { header: "Alış Faturasının Serisi",                                   width: 12 },
  { header: "Alış Faturasının Sıra No'su",                              width: 16 },
  { header: "Satıcının Adı-Soyadı / Ünvanı",                            width: 36 },
  { header: "Satıcının Vergi Kimlik Numarası / TC Kimlik Numarası",      width: 22 },
  { header: "Alınan Mal ve/veya Hizmetin Cinsi",                        width: 30 },
  { header: "Alınan Mal ve/veya Hizmetin Miktarı",                      width: 14 },
  { header: "Alınan Mal ve/veya Hizmetin KDV Hariç Tutarı",             width: 20 },
  { header: "KDV'si",                                                    width: 16 },
  { header: "Yüklenilen KDV\n(Orana Göre)",                             width: 18 },
  { header: "Yüklenim Türü",                                             width: 20 },
  { header: "GGB Tescil No'su",                                          width: 16 },
  { header: "Kaynak",                                                    width: 12 },
];

// ── Excel oluşturucu ───────────────────────────────────────────────────────

async function buildExcel(
  invoices: ParsedInvoice[],
  method: "manuel" | "oran",
  yuklenimTuru: string,
  ratio?: number,
  toplamHasilat?: number,
  iadeIslemTutari?: number,
): Promise<Uint8Array> {
  const ExcelJS = require("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = "Vezin";

  const COLS     = method === "oran" ? COLS_ORAN : COLS_MANUEL;
  const colCount = COLS.length;
  const lastColIdx  = 1 + colCount; // A=1 spacer, son sütun indexi
  const lastColLtr  = String.fromCharCode(64 + lastColIdx);

  const ws = wb.addWorksheet("Yüklenilen KDV Listesi");
  ws.pageSetup = {
    paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, orientation: "landscape",
  };

  // A: spacer, B…son: veri
  ws.columns = [
    { width: SPACER_WIDTH },
    ...COLS.map(col => ({ width: col.width })),
  ];

  // ── Satır 1: boş ─────────────────────────────────────────────────────────
  ws.getRow(1).height = 6;

  // ── Satır 2: Belge başlığı ────────────────────────────────────────────────
  const methStr = method === "oran"
    ? `YÜKLENİLEN KDV LİSTESİ — Oranla Dağıtım (%${((ratio ?? 0) * 100).toFixed(4)})`
    : "YÜKLENİLEN KDV LİSTESİ";

  ws.mergeCells(`B2:${lastColLtr}2`);
  const titleCell = ws.getCell("B2");
  titleCell.value     = methStr;
  titleCell.fill      = solidFill(C.NAVY);
  titleCell.font      = { bold: true, size: 14, color: { argb: C.WHITE } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(2).height = 32;

  // ── Satır 3: boş ayraç ───────────────────────────────────────────────────
  ws.getRow(3).height = 6;

  // ── Satır 4: Başlık satırı ────────────────────────────────────────────────
  const hRow = ws.getRow(4);
  hRow.height = 52;

  COLS.forEach((col, i) => {
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
  let dataRowNum   = 5;
  let siraNo       = 0;
  let totalKdvHaric    = 0;
  let totalKdv         = 0;
  let totalYuklenilen  = 0;

  function addDataRow(
    sira: number,
    tarih: string, seri: string, invSiraNo: string,
    saticiUnvan: string, vergiNo: string,
    cins: string, miktar: string,
    kdvHaric: number, kdv: number,
    yuklenilen: number | null,
    tur: string,
    isEven: boolean,
    sourceFile: string,
  ) {
    const row = ws.getRow(dataRowNum);
    const bg  = isEven ? C.ORANGE_LT : C.WHITE;
    const kaynak = sourceFile === "pdf-ai" ? "PDF (AI)" : sourceFile === "excel-import" ? "Excel" : "XML";

    const vals: any[] = [
      sira, tarih, seri, invSiraNo,
      saticiUnvan, vergiNo,
      cins, miktar,
      kdvHaric, kdv,
    ];
    if (method === "oran") vals.push(yuklenilen ?? 0);
    vals.push(tur, "", kaynak);

    vals.forEach((v, i) => {
      const c = row.getCell(i + 2); // B=2
      c.value  = v;
      c.fill   = solidFill(bg);
      c.font   = { size: 9 };
      c.border = {
        top: { style: "hair" }, left: { style: "thin" },
        bottom: { style: "hair" }, right: { style: "thin" },
      };
      const isKdvHaric   = i === 8;
      const isKdv        = i === 9;
      const isYuklCol    = method === "oran" && i === 10;
      if (isKdvHaric || isKdv || isYuklCol) {
        c.numFmt    = C.NUM_FMT;
        c.alignment = { horizontal: "right", vertical: "middle" };
      } else if (i === 0) {
        c.alignment = { horizontal: "center", vertical: "middle" };
      } else if (i === vals.length - 1) { // Kaynak
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
    const isEven    = siraNo % 2 === 0;
    const tur       = yuklenimTuru || "Doğrudan yüklenim";
    const cinsAll   = [...new Set(inv.satirlar.map(l => l.cins).filter(Boolean))].join(", ") || "—";
    const miktarAll = inv.satirlar.length === 1
      ? `${inv.satirlar[0].miktar}${inv.satirlar[0].birim ? " " + inv.satirlar[0].birim : ""}`
      : `${inv.satirlar.length} kalem`;
    const yuklenilen = method === "oran" ? inv.kdvTutari * (ratio ?? 0) : null;

    addDataRow(
      siraNo, inv.tarihFmt, inv.seri, inv.siraNo,
      inv.saticiUnvan, inv.saticiVergiNo,
      cinsAll, miktarAll,
      inv.kdvHaricTutar, inv.kdvTutari,
      yuklenilen, tur, isEven, inv.sourceFile,
    );

    totalKdvHaric  += inv.kdvHaricTutar;
    totalKdv       += inv.kdvTutari;
    if (yuklenilen !== null) totalYuklenilen += yuklenilen;
  }

  // ── TOPLAM satırı ─────────────────────────────────────────────────────────
  dataRowNum++; // boş ara satır
  const totRow = ws.getRow(dataRowNum);

  // TOPLAM etiketi: B - Miktar sütunu arası birleştir (8 sütun = B..I, yani col 2..9)
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

  // B(2)..I(9) birleşik → "TOPLAM"
  totCell(2, "TOPLAM", false, true);
  totCell(10, totalKdvHaric, true); // J = KDV Hariç
  totCell(11, totalKdv, true);       // K = KDV
  if (method === "oran") {
    totCell(12, totalYuklenilen, true); // L = Yüklenilen
    for (let col = 13; col <= lastColIdx; col++) totCell(col, "");
  } else {
    for (let col = 12; col <= lastColIdx; col++) totCell(col, "");
  }

  totRow.height = 22;

  // ── Oran özet bloğu ────────────────────────────────────────────────────────
  if (method === "oran" && ratio !== undefined) {
    dataRowNum += 2;
    const summaryData: [string, any][] = [
      ["Toplam Hasılat",        toplamHasilat ?? 0],
      ["İade İşlem Tutarı",     iadeIslemTutari ?? 0],
      ["Kullanılan Oran",       `%${((ratio) * 100).toFixed(4)}`],
      ["Toplam Yüklenilen KDV", totalYuklenilen],
    ];

    for (const [label, val] of summaryData) {
      const r = ws.getRow(dataRowNum);
      ws.mergeCells(`B${dataRowNum}:I${dataRowNum}`);
      const lc = r.getCell(2);
      lc.value     = label;
      lc.font      = { bold: true, size: 9 };
      lc.alignment = { horizontal: "right", vertical: "middle", indent: 1 };
      lc.fill      = solidFill("FFF5F5F5");
      lc.border    = { top: { style: "hair" }, left: { style: "thin" }, bottom: { style: "hair" }, right: { style: "thin" } };

      const vc = r.getCell(10);
      if (typeof val === "number") { vc.value = val; vc.numFmt = C.NUM_FMT; }
      else vc.value = val;
      vc.font      = { size: 9 };
      vc.alignment = { horizontal: "right", vertical: "middle" };
      vc.fill      = solidFill("FFF5F5F5");
      vc.border    = { top: { style: "hair" }, left: { style: "thin" }, bottom: { style: "hair" }, right: { style: "thin" } };

      for (let col = 11; col <= lastColIdx; col++) {
        const c = r.getCell(col);
        c.fill   = solidFill("FFF5F5F5");
        c.border = { top: { style: "hair" }, left: { style: "thin" }, bottom: { style: "hair" }, right: { style: "thin" } };
      }
      r.height = 16;
      dataRowNum++;
    }
  }

  ws.views = [{ state: "frozen", ySplit: 4 }];

  const raw = await wb.xlsx.writeBuffer();
  return new Uint8Array(Buffer.from(raw));
}

// ── Route ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  // DEBUG — gerçek token değerlerini logla (karşılaştırma tamamlanınca kaldır)
  const { email: _dbgEmail } = token as any;
  console.log('[auth] user:', _dbgEmail, '| role:', (token as any).role, '| dept:', (token as any).department, '| api:', req.nextUrl?.pathname ?? req.url);
  const { role } = token as any;
  if (!BYPASS_AUTH_ROLES && role !== "ADMIN") return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });

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
