import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

// ── Yardımcı fonksiyonlar ─────────────────────────────────────────────────────

function norm(s: string): string {
  return String(s ?? "")
    .toUpperCase()
    .replace(/İ/g, "I").replace(/Ş/g, "S").replace(/Ğ/g, "G")
    .replace(/Ü/g, "U").replace(/Ö/g, "O").replace(/Ç/g, "C")
    .trim();
}

function findCol(headers: string[], keywords: string[]): number {
  const normed = headers.map(norm);
  for (const kw of keywords) {
    const idx = normed.indexOf(norm(kw));
    if (idx !== -1) return idx;
  }
  for (const kw of keywords) {
    const idx = normed.findIndex((h) => h.includes(norm(kw)));
    if (idx !== -1) return idx;
  }
  return -1;
}

function get(row: any[], idx: number): any {
  return idx >= 0 ? (row[idx] ?? "") : "";
}

function toNum(val: any): number {
  if (val == null || val === "") return 0;
  if (typeof val === "number") return val;
  let s = String(val).trim().replace(/[₺$€£\s]/g, "");
  if (/\d+\.\d{3}[,]\d/.test(s) || /^\d+[,]\d{1,2}$/.test(s)) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    s = s.replace(/,/g, "");
  }
  return parseFloat(s) || 0;
}

type RowStatus = "eslesiyor" | "kdv_farki" | "sadece_firma1" | "sadece_firma2";

const STATUS_LABELS: Record<RowStatus, string> = {
  eslesiyor:     "Eşleşiyor",
  kdv_farki:    "KDV Farkı Var",
  sadece_firma1: "Sadece Firma 1",
  sadece_firma2: "Sadece Firma 2",
};

// ARGB renk kodları (ExcelJS formatı)
const FILL: Record<string, string> = {
  eslesiyor:     "FF90EE90", // yeşil
  kdv_farki:    "FFFFFF00", // sarı
  sadece_firma1: "FFFFB3B3", // pembe
  sadece_firma2: "FFB3FFB3", // açık yeşil
  header:        "FF003366", // koyu mavi
  summary_bg:    "FFD9E1F2", // açık mavi-gri
};

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }
  const { role, department } = token as any;
  if (role !== "ADMIN" && department !== "MUHASEBE") {
    return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek formatı" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Dosya bulunamadı" }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "Dosya boyutu 10MB'ı geçemez" }, { status: 400 });

  const isExcel =
    file.name.endsWith(".xlsx") || file.name.endsWith(".xls") ||
    file.type.includes("spreadsheet") || file.type.includes("ms-excel");
  if (!isExcel) {
    return NextResponse.json({ error: "Yalnızca Excel (.xlsx / .xls) dosyaları desteklenmektedir" }, { status: 400 });
  }

  try {
    const ExcelJS = require("exceljs");
    const buffer = Buffer.from(await file.arrayBuffer());

    const wbIn = new ExcelJS.Workbook();
    await wbIn.xlsx.load(buffer);

    if (wbIn.worksheets.length < 2) {
      return NextResponse.json(
        { error: "Excel dosyası en az 2 sayfa içermelidir (1. sayfa: Firma 1, 2. sayfa: Firma 2)" },
        { status: 400 }
      );
    }

    // ── Sheet okuma yardımcısı ─────────────────────────────────────────────────
    function readSheet(ws: any): { headers: string[]; rows: any[][] } {
      const allRows: any[][] = [];
      ws.eachRow((row: any) => {
        allRows.push(row.values.slice(1)); // index 0 boş, 1'den başla
      });
      if (allRows.length === 0) return { headers: [], rows: [] };
      const headers = allRows[0].map((c: any) => String(c ?? "").trim());
      const rows = allRows.slice(1).filter((r) => r.some((c: any) => String(c ?? "").trim() !== ""));
      return { headers, rows };
    }

    const f1 = readSheet(wbIn.worksheets[0]);
    const f2 = readSheet(wbIn.worksheets[1]);

    // ── Sütun tespiti ─────────────────────────────────────────────────────────
    const f1KeyIdx  = findCol(f1.headers, ["FATURA NO", "BELGE NO", "ETTN", "FATURA", "BELGE", "NO"]);
    const f2KeyIdx  = findCol(f2.headers, ["FATURA NO", "BELGE NO", "ETTN", "FATURA", "BELGE", "NO"]);
    const f1KdvIdx  = findCol(f1.headers, ["KDV TUTARI", "VERGI TUTARI", "KDV", "VERGI"]);
    const f2KdvIdx  = findCol(f2.headers, ["KDV TUTARI", "VERGI TUTARI", "KDV", "VERGI"]);
    const f1AcIdx   = findCol(f1.headers, ["ACIKLAMA", "UNVAN", "AD SOYAD", "AD"]);
    const f2AlicIdx = findCol(f2.headers, ["ALICI UNVANI", "ALICI", "UNVAN", "AD"]);
    const f1TurIdx  = findCol(f1.headers, ["FATURA TURU", "TUR", "BELGE TURU"]);
    const f2TurIdx  = findCol(f2.headers, ["FATURA TURU", "TUR", "BELGE TURU"]);
    const f1MalIdx  = findCol(f1.headers, ["MAL HIZMET TUTARI", "MAL/HIZMET", "MATRAH", "MAL HIZMET", "MAL"]);
    const f2MalIdx  = findCol(f2.headers, ["MAL HIZMET TUTARI", "MAL/HIZMET", "MATRAH", "MAL HIZMET", "MAL"]);
    const f1TopIdx  = findCol(f1.headers, ["GENEL TOPLAM", "FATURA TOPLAMI", "TOPLAM TUTAR", "TOPLAM", "TUTAR"]);
    const f2TopIdx  = findCol(f2.headers, ["GENEL TOPLAM", "FATURA TOPLAMI", "TOPLAM TUTAR", "TOPLAM", "TUTAR"]);

    // ── Karşılaştırma mantığı ─────────────────────────────────────────────────
    const f1Map = new Map<string, any[]>();
    for (const row of f1.rows) {
      const key = String(get(row, f1KeyIdx)).trim();
      if (key) f1Map.set(key, row);
    }
    const f2Map = new Map<string, any[]>();
    for (const row of f2.rows) {
      const key = String(get(row, f2KeyIdx)).trim();
      if (key) f2Map.set(key, row);
    }

    const allKeys = new Set([...Array.from(f1Map.keys()), ...Array.from(f2Map.keys())]);

    const compRows: Array<{
      key: string; f1Ac: string; f2Al: string; tur: string;
      f1Kdv: number; f2Kdv: number; mal: number; toplam: number;
      kdvFarki: number; durum: RowStatus;
    }> = [];

    for (const key of allKeys) {
      const r1 = f1Map.get(key);
      const r2 = f2Map.get(key);
      const f1Kdv    = r1 ? toNum(get(r1, f1KdvIdx)) : 0;
      const f2Kdv    = r2 ? toNum(get(r2, f2KdvIdx)) : 0;
      const kdvFarki = Math.abs(f1Kdv - f2Kdv);

      let durum: RowStatus;
      if (!r2)                durum = "sadece_firma1";
      else if (!r1)           durum = "sadece_firma2";
      else if (kdvFarki > 0.01) durum = "kdv_farki";
      else                    durum = "eslesiyor";

      compRows.push({
        key,
        f1Ac:   r1 ? String(get(r1, f1AcIdx))  : "",
        f2Al:   r2 ? String(get(r2, f2AlicIdx)) : "",
        tur:    r1 ? String(get(r1, f1TurIdx))  : (r2 ? String(get(r2, f2TurIdx)) : ""),
        f1Kdv, f2Kdv,
        mal:    r1 ? toNum(get(r1, f1MalIdx))  : (r2 ? toNum(get(r2, f2MalIdx))  : 0),
        toplam: r1 ? toNum(get(r1, f1TopIdx))  : (r2 ? toNum(get(r2, f2TopIdx))  : 0),
        kdvFarki,
        durum,
      });
    }

    const durumOrder: Record<RowStatus, number> = {
      eslesiyor: 0, kdv_farki: 1, sadece_firma1: 2, sadece_firma2: 3,
    };
    compRows.sort((a, b) => durumOrder[a.durum] - durumOrder[b.durum]);

    const totalCount   = compRows.length;
    const eslesenCount = compRows.filter((r) => r.durum === "eslesiyor").length;
    const kdvFCount    = compRows.filter((r) => r.durum === "kdv_farki").length;
    const sadece1Count = compRows.filter((r) => r.durum === "sadece_firma1").length;
    const sadece2Count = compRows.filter((r) => r.durum === "sadece_firma2").length;

    // ── ExcelJS yardımcıları ──────────────────────────────────────────────────
    function solidFill(argb: string) {
      return { type: "pattern", pattern: "solid", fgColor: { argb } } as const;
    }

    function applyRowFill(row: any, argb: string) {
      row.eachCell({ includeEmpty: true }, (cell: any) => {
        cell.fill = solidFill(argb);
      });
    }

    function setHeaderCell(cell: any, value: string) {
      cell.value = value;
      cell.fill = solidFill(FILL.header);
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    }

    // ── Karşılaştırma sayfası ──────────────────────────────────────────────────
    const wbOut = new ExcelJS.Workbook();

    // Mevcut sayfaları kopyala
    for (const wsIn of wbIn.worksheets) {
      const wsOut = wbOut.addWorksheet(wsIn.name);
      wsIn.eachRow((row: any, rowNum: number) => {
        const newRow = wsOut.getRow(rowNum);
        row.eachCell({ includeEmpty: true }, (cell: any, colNum: number) => {
          newRow.getCell(colNum).value = cell.value;
        });
        newRow.commit();
      });
    }

    // Karşılaştırma sayfası
    const ws = wbOut.addWorksheet("KARŞILAŞTIRMA");

    // Sütun genişlikleri
    ws.columns = [
      { width: 24 }, { width: 32 }, { width: 32 }, { width: 16 },
      { width: 16 }, { width: 16 }, { width: 18 }, { width: 18 }, { width: 14 }, { width: 20 },
    ];

    const COL = 10;

    // Satır 1: Büyük başlık
    const titleRow = ws.getRow(1);
    const titleCell = titleRow.getCell(1);
    titleCell.value = "FİRMA 1 - FİRMA 2 KARŞILAŞTIRMA RAPORU";
    titleCell.fill  = solidFill(FILL.header);
    titleCell.font  = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    ws.mergeCells(1, 1, 1, COL);
    titleRow.height = 28;
    titleRow.commit();

    // Satır 2: boş
    ws.getRow(2).commit();

    // Satır 3: Özet başlıkları
    const sumLblRow = ws.getRow(3);
    const summaryLabels = ["Toplam Kayıt", "Eşleşen", "KDV Farkı Var", "Sadece Firma 1", "Sadece Firma 2"];
    summaryLabels.forEach((lbl, i) => {
      const c = sumLblRow.getCell(i + 1);
      c.value = lbl;
      c.fill  = solidFill(FILL.summary_bg);
      c.font  = { bold: true, size: 10 };
      c.alignment = { horizontal: "center" };
    });
    sumLblRow.commit();

    // Satır 4: Özet değerler
    const sumValRow = ws.getRow(4);
    [totalCount, eslesenCount, kdvFCount, sadece1Count, sadece2Count].forEach((v, i) => {
      const c = sumValRow.getCell(i + 1);
      c.value = v;
      c.font  = { bold: true, size: 12 };
      c.alignment = { horizontal: "center" };
    });
    sumValRow.commit();

    // Satır 5: boş
    ws.getRow(5).commit();

    // Satır 6: Renk açıklaması
    const legendRow = ws.getRow(6);
    const legendItems: Array<{ label: string; argb: string }> = [
      { label: "Yeşil = Eşleşiyor",          argb: FILL.eslesiyor },
      { label: "Sarı = KDV Farkı Var",        argb: FILL.kdv_farki },
      { label: "Pembe = Sadece Firma 1",       argb: FILL.sadece_firma1 },
      { label: "Açık Yeşil = Sadece Firma 2",  argb: FILL.sadece_firma2 },
    ];
    legendItems.forEach((item, i) => {
      const c = legendRow.getCell(i * 2 + 1);
      c.value = item.label;
      c.fill  = solidFill(item.argb);
      c.font  = { bold: true, size: 9 };
      c.alignment = { horizontal: "center" };
      ws.mergeCells(6, i * 2 + 1, 6, i * 2 + 2);
    });
    legendRow.commit();

    // Satır 7: boş
    ws.getRow(7).commit();

    // Satır 8: Sütun başlıkları
    const headerRow = ws.getRow(8);
    headerRow.height = 32;
    const colHeaders = [
      "Belge No / Fatura No",
      "Firma 1 Açıklama",
      "Firma 2 Alıcı Ünvanı",
      "Fatura Türü",
      "Firma 1 KDV",
      "Firma 2 KDV",
      "Mal Hizmet Tutarı",
      "Fatura Toplamı",
      "KDV Farkı",
      "Durum",
    ];
    colHeaders.forEach((h, i) => setHeaderCell(headerRow.getCell(i + 1), h));
    headerRow.commit();

    // Veri satırları
    compRows.forEach((cr, idx) => {
      const row = ws.getRow(9 + idx);
      const argb = FILL[cr.durum];
      const numFmt = "#,##0.00";

      const setText = (colIdx: number, val: string, align = "left") => {
        const c = row.getCell(colIdx);
        c.value = val;
        c.fill  = solidFill(argb);
        c.alignment = { horizontal: align as any };
      };
      const setNum = (colIdx: number, val: number, isKdvFarki = false) => {
        const c = row.getCell(colIdx);
        c.value    = val;
        c.numFmt   = numFmt;
        c.fill     = solidFill(argb);
        c.alignment = { horizontal: "right" };
        if (isKdvFarki && val > 0.01) {
          c.font = { bold: true, color: { argb: "FFCC0000" } };
        }
      };

      setText(1,  cr.key);
      setText(2,  cr.f1Ac);
      setText(3,  cr.f2Al);
      setText(4,  cr.tur, "center");
      setNum(5,   cr.f1Kdv);
      setNum(6,   cr.f2Kdv);
      setNum(7,   cr.mal);
      setNum(8,   cr.toplam);
      setNum(9,   cr.kdvFarki, true);
      const statusCell = row.getCell(10);
      statusCell.value = STATUS_LABELS[cr.durum];
      statusCell.fill  = solidFill(argb);
      statusCell.font  = { bold: true };
      statusCell.alignment = { horizontal: "center" };

      row.commit();
    });

    // ── Çıktıyı buffer'a yaz ──────────────────────────────────────────────────
    const outBuf = await wbOut.xlsx.writeBuffer();

    return new NextResponse(outBuf as Buffer, {
      status: 200,
      headers: {
        "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="karsilastirma_raporu.xlsx"`,
      },
    });
  } catch (err: any) {
    console.error("[compare-excel]", err);
    return NextResponse.json(
      { error: "Karşılaştırma sırasında bir hata oluştu: " + (err.message ?? "Bilinmeyen hata") },
      { status: 500 }
    );
  }
}
