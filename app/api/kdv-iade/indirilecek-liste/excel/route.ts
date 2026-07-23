import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { ParsedInvoice } from "../route";
import { BYPASS_AUTH_ROLES } from "@/lib/auth-bypass";

export const dynamic = "force-dynamic";

// ── Helpers ────────────────────────────────────────────────────────────────

function solidFill(argb: string) {
  return { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb } };
}

const C = {
  ORANGE:     "FFF57C28",  // Vezin turuncu — başlık satırı dolgusu
  ORANGE_LT:  "FFFFF3E8",  // Açık turuncu — çift satır zebra
  NAVY:       "FF1E2235",  // Koyu lacivert — belge başlığı
  YELLOW_LT:  "FFFFFDE7",  // Açık sarı — tevkifatlı satır vurgusu
  GRAY_LT:    "FFF0F0F0",  // Açık gri — TOPLAM satırı dolgusu
  WHITE:      "FFFFFFFF",
  NUM_FMT:    '#,##0.00',
  DATE_FMT:   'DD.MM.YYYY',
};

// ── GİB 15 sütun tanımı (birebir resmi şablon sırası) ─────────────────────
// A sütunu boş bırakıldığından ws.columns[0] dar bir spacer, veriler B'den başlar.

const SPACER_WIDTH = 3;
const GIB_COLS = [
  { header: "Sıra No",                                                                                          width: 7  },
  { header: "Alış Faturasının Tarihi",                                                                          width: 14 },
  { header: "Alış Faturasının Serisi",                                                                          width: 12 },
  { header: "Alış Faturasının Sıra No'su",                                                                      width: 16 },
  { header: "Satıcının Adı-Soyadı / Ünvanı",                                                                    width: 36 },
  { header: "Satıcının Vergi Kimlik Numarası / TC Kimlik Numarası",                                             width: 22 },
  { header: "Alınan Mal ve/veya Hizmetin Cinsi",                                                               width: 30 },
  { header: "Alınan Mal ve/veya Hizmetin Miktarı",                                                             width: 14 },
  { header: "Alınan Mal ve/veya Hizmetin KDV Hariç Tutarı",                                                    width: 20 },
  { header: "KDV'si",                                                                                           width: 16 },
  { header: "Tevkifatlı Faturanın Tevkifata Tabi Olmayan Ve Bu Dönemde İndirilen Kdv Tutarı",                   width: 26 },
  { header: "2 Nolu Beyannamede Ödenen Kdv Tutarı",                                                             width: 22 },
  { header: "Toplam İndirilen KDV Tutarı",                                                                      width: 20 },
  { header: "GGB Tescil No'su (Alış İthalat İse)",                                                              width: 18 },
  { header: "Belgenin İndirim Hakkının Kullanıldığı KDV Dönemi",                                               width: 20 },
];

// Toplam sütun sayısı: 1 (spacer A) + 15 (GİB) = 16 → A..P
const TOTAL_COLS = 1 + GIB_COLS.length; // 16
function colLetter(idx: number) { return String.fromCharCode(64 + idx); } // 1→A, 2→B…
const LAST_COL = colLetter(TOTAL_COLS); // P

// GİB sütun indeksleri (1-tabanlı, A=1)
const IDX = {
  SIRA:      2,   // B
  TARIH:     3,   // C
  SERI:      4,   // D
  SIRA_NO:   5,   // E
  UNVAN:     6,   // F
  VERGI_NO:  7,   // G
  CINS:      8,   // H
  MIKTAR:    9,   // I  ← TOPLAM etiketi buraya
  KDV_HARIC: 10,  // J
  KDV:       11,  // K
  TEV1:      12,  // L  Tevkifata tabi olmayan
  TEV2:      13,  // M  2 Nolu Beyanname
  TOPLAM_KDV:14,  // N  Toplam İndirilen
  GGB:       15,  // O
  DONEM:     16,  // P
};

// ── Excel oluşturucu ───────────────────────────────────────────────────────

async function buildExcel(invoices: ParsedInvoice[], merge: boolean): Promise<Uint8Array> {
  const ExcelJS = require("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = "Vezin";

  const ws = wb.addWorksheet("İndirilecek KDV Listesi");
  ws.pageSetup = {
    paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, orientation: "landscape",
  };

  // Sütun genişlikleri: A (spacer) + 15 GİB sütun
  ws.columns = [
    { width: SPACER_WIDTH },               // A — boş
    ...GIB_COLS.map(col => ({ width: col.width })),
  ];

  // ── Satır 1: boş (GİB şablonunda da boş) ─────────────────────────────────
  ws.getRow(1).height = 6;

  // ── Satır 2: "İNDİRİLECEK KDV LİSTESİ" başlığı ──────────────────────────
  ws.mergeCells(`B2:${LAST_COL}2`);
  const titleCell = ws.getCell("B2");
  titleCell.value     = "İNDİRİLECEK KDV LİSTESİ";
  titleCell.fill      = solidFill(C.NAVY);
  titleCell.font      = { bold: true, size: 14, color: { argb: C.WHITE } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(2).height = 32;

  // ── Satır 3: boş ayraç ────────────────────────────────────────────────────
  ws.getRow(3).height = 6;

  // ── Satır 4: GİB başlık satırı ────────────────────────────────────────────
  const hRow = ws.getRow(4);
  hRow.height = 52; // Uzun başlıklar için yeterli yükseklik

  GIB_COLS.forEach((col, i) => {
    const colIdx = i + 2; // B=2 den başlar
    const c = hRow.getCell(colIdx);
    c.value     = col.header;
    c.fill      = solidFill(C.ORANGE);
    c.font      = { bold: true, size: 9, color: { argb: C.WHITE } };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.border    = {
      top:    { style: "thin" },
      left:   { style: "thin" },
      bottom: { style: "medium" },
      right:  { style: "thin" },
    };
  });

  // ── Satır 5+: veri satırları ───────────────────────────────────────────────
  let dataRowNum = 5;
  let siraNo     = 0;
  let totalKdvHaric = 0;
  let totalKdv      = 0;

  function addDataRow(
    sira: number,
    tarih: string, seri: string, invSiraNo: string,
    saticiUnvan: string, vergiNo: string,
    cins: string, miktar: string,
    kdvHaric: number, kdv: number,
    donemi: string,
    isTevkifatli: boolean,
    isEven: boolean,
  ) {
    const row = ws.getRow(dataRowNum);

    // Zebradeseni: tevkifatlı ise sarı, yoksa beyaz/açık turuncu
    const bg = isTevkifatli ? C.YELLOW_LT : (isEven ? C.ORANGE_LT : C.WHITE);

    const vals: { col: number; val: any; num?: boolean; center?: boolean }[] = [
      { col: IDX.SIRA,       val: sira,       center: true },
      { col: IDX.TARIH,      val: tarih },
      { col: IDX.SERI,       val: seri },
      { col: IDX.SIRA_NO,    val: invSiraNo },
      { col: IDX.UNVAN,      val: saticiUnvan },
      { col: IDX.VERGI_NO,   val: vergiNo },
      { col: IDX.CINS,       val: cins },
      { col: IDX.MIKTAR,     val: miktar },
      { col: IDX.KDV_HARIC,  val: kdvHaric,   num: true },
      { col: IDX.KDV,        val: kdv,         num: true },
      { col: IDX.TEV1,       val: 0,            num: true },
      { col: IDX.TEV2,       val: 0,            num: true },
      { col: IDX.TOPLAM_KDV, val: kdv,          num: true }, // Toplam İndirilen = KDV (basit durumda)
      { col: IDX.GGB,        val: "" },
      { col: IDX.DONEM,      val: donemi },
    ];

    for (const { col, val, num, center } of vals) {
      const c = row.getCell(col);
      c.value  = val === 0 && num ? 0 : val;
      c.fill   = solidFill(bg);
      c.font   = { size: 9 };
      c.border = {
        top:    { style: "hair" },
        left:   { style: "thin" },
        bottom: { style: "hair" },
        right:  { style: "thin" },
      };
      if (num) {
        c.numFmt    = C.NUM_FMT;
        c.alignment = { horizontal: "right", vertical: "middle" };
      } else if (center) {
        c.alignment = { horizontal: "center", vertical: "middle" };
      } else {
        c.alignment = { horizontal: "left", vertical: "middle" };
      }
    }

    row.height = 16;
    dataRowNum++;
  }

  for (const inv of invoices) {
    siraNo++;
    const isEven = siraNo % 2 === 0;
    const isTevkifatli = false; // ParsedInvoice'ta tevkifat bayrağı olmadığından varsayılan false

    if (merge) {
      const cinsAll = [...new Set(inv.satirlar.map(l => l.cins).filter(Boolean))].join(", ") || "—";
      const miktarAll = inv.satirlar.length === 1
        ? `${inv.satirlar[0].miktar}${inv.satirlar[0].birim ? " " + inv.satirlar[0].birim : ""}`
        : `${inv.satirlar.length} kalem`;

      addDataRow(
        siraNo, inv.tarihFmt, inv.seri, inv.siraNo,
        inv.saticiUnvan, inv.saticiVergiNo,
        cinsAll, miktarAll,
        inv.kdvHaricTutar, inv.kdvTutari,
        inv.donemi, isTevkifatli, isEven,
      );
      totalKdvHaric += inv.kdvHaricTutar;
      totalKdv      += inv.kdvTutari;
    } else {
      const lines = inv.satirlar.length > 0 ? inv.satirlar : [{
        cins: "—", miktar: 1, birim: "",
        kdvHaricTutar: inv.kdvHaricTutar, kdvOrani: inv.kdvOrani, kdvTutari: inv.kdvTutari,
      }];

      lines.forEach((line, li) => {
        const miktarStr = `${line.miktar}${line.birim ? " " + line.birim : ""}`;
        addDataRow(
          li === 0 ? siraNo : 0,
          inv.tarihFmt, inv.seri, inv.siraNo,
          inv.saticiUnvan, inv.saticiVergiNo,
          line.cins || "—", miktarStr,
          line.kdvHaricTutar, line.kdvTutari,
          inv.donemi, isTevkifatli, isEven,
        );
        totalKdvHaric += line.kdvHaricTutar;
        totalKdv      += line.kdvTutari;
      });
    }
  }

  // ── TOPLAM satırı ─────────────────────────────────────────────────────────
  // GİB şablonuna göre: "TOPLAM" etiketi Miktar sütununun altında,
  // B:I arası birleştirilmiş hücre (sağa hizalı); toplamlar J, K, L, M, N sütunlarında.
  dataRowNum++; // bir boş satır ara
  const totRow = ws.getRow(dataRowNum);

  function totCell(col: number, val: any, isNum = false, isLabel = false) {
    const c = totRow.getCell(col);
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

  // B:I birleştir → "TOPLAM"
  ws.mergeCells(`B${dataRowNum}:I${dataRowNum}`);
  totCell(IDX.SIRA, "TOPLAM", false, true); // IDX.SIRA = B = merged başlangıcı

  totCell(IDX.KDV_HARIC,  totalKdvHaric, true);
  totCell(IDX.KDV,        totalKdv,      true);
  totCell(IDX.TEV1,       0,             true);
  totCell(IDX.TEV2,       0,             true);
  totCell(IDX.TOPLAM_KDV, totalKdv,      true);
  totCell(IDX.GGB,        "");
  totCell(IDX.DONEM,      "");

  totRow.height = 22;

  // ── Dondur: satır 4 (başlık) donuk ────────────────────────────────────────
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
    console.error("[indirilecek-kdv/excel]", err);
    return NextResponse.json({ error: "Excel oluşturulamadı: " + (err?.message ?? "") }, { status: 500 });
  }
}
