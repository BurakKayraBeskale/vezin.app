import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

// ── Yardımcı fonksiyonlar ────────────────────────────────────────────────────

function norm(s: string): string {
  return String(s ?? "")
    .toUpperCase()
    .replace(/İ/g, "I").replace(/Ş/g, "S").replace(/Ğ/g, "G")
    .replace(/Ü/g, "U").replace(/Ö/g, "O").replace(/Ç/g, "C")
    .trim();
}

function findCol(headers: string[], keywords: string[]): number {
  const normed = headers.map(norm);
  // Önce tam eşleşme
  for (const kw of keywords) {
    const idx = normed.indexOf(norm(kw));
    if (idx !== -1) return idx;
  }
  // Sonra içerme
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
  // Türkçe format: 1.234,56
  if (/\d+\.\d{3}[,]\d/.test(s) || /^\d+[,]\d{1,2}$/.test(s)) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    s = s.replace(/,/g, "");
  }
  return parseFloat(s) || 0;
}

function parseSheet(data: any[][]): { headers: string[]; rows: any[][] } {
  if (data.length === 0) return { headers: [], rows: [] };
  const headers = data[0].map((c) => String(c ?? "").trim());
  const rows = data.slice(1).filter((r) => r.some((c) => String(c ?? "").trim() !== ""));
  return { headers, rows };
}

type RowStatus = "eslesiyor" | "kdv_farki" | "sadece_firma1" | "sadece_firma2";

const STATUS_LABELS: Record<RowStatus, string> = {
  eslesiyor:    "Eşleşiyor",
  kdv_farki:   "KDV Farkı Var",
  sadece_firma1: "Sadece Firma 1",
  sadece_firma2: "Sadece Firma 2",
};

const COLORS: Record<string, string> = {
  eslesiyor:    "C6EFCE", // yeşil
  kdv_farki:   "FFEB9C", // sarı
  sadece_firma1: "FFB6C1", // pembe
  sadece_firma2: "D9F0D3", // açık yeşil
  header:       "D9E1F2", // başlık satırı
  title_bg:     "1F3864", // koyu lacivert başlık arka plan
};

// ── POST handler ─────────────────────────────────────────────────────────────

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
  if (!file) {
    return NextResponse.json({ error: "Dosya bulunamadı" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Dosya boyutu 10MB'ı geçemez" }, { status: 400 });
  }
  const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls") ||
    file.type.includes("spreadsheet") || file.type.includes("ms-excel");
  if (!isExcel) {
    return NextResponse.json({ error: "Yalnızca Excel (.xlsx / .xls) dosyaları desteklenmektedir" }, { status: 400 });
  }

  try {
    const XLSX = await import("xlsx");
    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: "buffer", cellStyles: true });

    if (wb.SheetNames.length < 2) {
      return NextResponse.json(
        { error: "Excel dosyası en az 2 sayfa içermelidir (1. sayfa: Firma 1, 2. sayfa: Firma 2)" },
        { status: 400 }
      );
    }

    const raw1 = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" }) as any[][];
    const raw2 = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[1]], { header: 1, defval: "" }) as any[][];

    const f1 = parseSheet(raw1);
    const f2 = parseSheet(raw2);

    // Sütun tespiti
    const keyKeywords    = ["FATURA NO", "BELGE NO", "ETTN", "FATURA", "BELGE", "NO"];
    const kdvKeywords    = ["KDV TUTARI", "VERGI TUTARI", "KDV", "VERGI"];
    const aciklamaKw     = ["ACIKLAMA", "UNVAN", "AD SOYAD", "AD", "ÜNVAN"];
    const aliciKw        = ["ALICI UNVANI", "ALICI", "UNVAN", "AD"];
    const turKw          = ["FATURA TURU", "TUR", "BELGE TURU"];
    const malKw          = ["MAL HIZMET TUTARI", "MAL/HIZMET", "MATRAH", "MAL HIZMET", "MAL"];
    const toplamKw       = ["GENEL TOPLAM", "FATURA TOPLAMI", "TOPLAM TUTAR", "TOPLAM", "TUTAR"];

    const f1KeyIdx   = findCol(f1.headers, keyKeywords);
    const f2KeyIdx   = findCol(f2.headers, keyKeywords);
    const f1KdvIdx   = findCol(f1.headers, kdvKeywords);
    const f2KdvIdx   = findCol(f2.headers, kdvKeywords);
    const f1AcIdx    = findCol(f1.headers, aciklamaKw);
    const f2AlicIdx  = findCol(f2.headers, aliciKw);
    const f1TurIdx   = findCol(f1.headers, turKw);
    const f2TurIdx   = findCol(f2.headers, turKw);
    const f1MalIdx   = findCol(f1.headers, malKw);
    const f2MalIdx   = findCol(f2.headers, malKw);
    const f1TopIdx   = findCol(f1.headers, toplamKw);
    const f2TopIdx   = findCol(f2.headers, toplamKw);

    // Haritalar: key → row
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

    // Karşılaştırma satırları
    const compRows: Array<{
      key: string; f1Ac: string; f2Al: string; tur: string;
      f1Kdv: number; f2Kdv: number; mal: number; toplam: number;
      kdvFarki: number; durum: RowStatus;
    }> = [];

    for (const key of allKeys) {
      const r1 = f1Map.get(key);
      const r2 = f2Map.get(key);
      const f1Kdv = r1 ? toNum(get(r1, f1KdvIdx)) : 0;
      const f2Kdv = r2 ? toNum(get(r2, f2KdvIdx)) : 0;
      const kdvFarki = Math.abs(f1Kdv - f2Kdv);

      let durum: RowStatus;
      if (!r2)               durum = "sadece_firma1";
      else if (!r1)          durum = "sadece_firma2";
      else if (kdvFarki > 0.01) durum = "kdv_farki";
      else                   durum = "eslesiyor";

      compRows.push({
        key,
        f1Ac:    r1 ? String(get(r1, f1AcIdx))   : "",
        f2Al:    r2 ? String(get(r2, f2AlicIdx))  : "",
        tur:     r1 ? String(get(r1, f1TurIdx))   : (r2 ? String(get(r2, f2TurIdx)) : ""),
        f1Kdv, f2Kdv,
        mal:    r1 ? toNum(get(r1, f1MalIdx))  : (r2 ? toNum(get(r2, f2MalIdx))  : 0),
        toplam: r1 ? toNum(get(r1, f1TopIdx))  : (r2 ? toNum(get(r2, f2TopIdx))  : 0),
        kdvFarki,
        durum,
      });
    }

    // Sıralama: eşleşiyor → kdv farkı → sadece firma1 → sadece firma2
    const durumOrder: Record<RowStatus, number> = {
      eslesiyor: 0, kdv_farki: 1, sadece_firma1: 2, sadece_firma2: 3,
    };
    compRows.sort((a, b) => durumOrder[a.durum] - durumOrder[b.durum]);

    // İstatistikler
    const totalCount  = compRows.length;
    const eslesenCount = compRows.filter((r) => r.durum === "eslesiyor").length;
    const kdvFCount   = compRows.filter((r) => r.durum === "kdv_farki").length;
    const sadece1Count = compRows.filter((r) => r.durum === "sadece_firma1").length;
    const sadece2Count = compRows.filter((r) => r.durum === "sadece_firma2").length;

    // ── Karşılaştırma sayfası oluştur ────────────────────────────────────────
    const ws: any = {};
    const merges: any[] = [];
    let r = 0;
    const COL_COUNT = 10;

    const cell = (row: number, col: number, value: any, style: any) => {
      const ref = XLSX.utils.encode_cell({ r: row, c: col });
      ws[ref] = {
        v: value,
        t: typeof value === "number" ? "n" : "s",
        s: style,
      };
    };

    // Satır 0: Başlık
    cell(r, 0, "FİRMA 1 - FİRMA 2 KARŞILAŞTIRMA RAPORU", {
      font: { bold: true, sz: 14, color: { rgb: "FFFFFF" } },
      fill: { patternType: "solid", fgColor: { rgb: COLORS.title_bg } },
      alignment: { horizontal: "center", vertical: "center" },
    });
    merges.push({ s: { r, c: 0 }, e: { r, c: COL_COUNT - 1 } });
    r++;

    // Satır 1: boş
    r++;

    // Satır 2: Özet başlıkları
    const summaryLabels = ["Toplam Kayıt", "Eşleşen", "KDV Farkı Var", "Sadece Firma 1", "Sadece Firma 2"];
    const summaryValues = [totalCount, eslesenCount, kdvFCount, sadece1Count, sadece2Count];
    summaryLabels.forEach((lbl, i) => {
      cell(r, i, lbl, {
        font: { bold: true, sz: 10 },
        fill: { patternType: "solid", fgColor: { rgb: COLORS.header } },
        alignment: { horizontal: "center" },
        border: { bottom: { style: "thin", color: { rgb: "000000" } } },
      });
    });
    r++;

    // Satır 3: Özet değerler
    summaryValues.forEach((v, i) => {
      cell(r, i, v, {
        font: { bold: true, sz: 13 },
        alignment: { horizontal: "center" },
      });
    });
    r++;

    // Satır 4: boş
    r++;

    // Satır 5: Renk açıklaması
    const legend = [
      { label: "Yeşil = Eşleşiyor",          color: COLORS.eslesiyor },
      { label: "Sarı = KDV Farkı Var",        color: COLORS.kdv_farki },
      { label: "Pembe = Sadece Firma 1",       color: COLORS.sadece_firma1 },
      { label: "Açık Yeşil = Sadece Firma 2",  color: COLORS.sadece_firma2 },
    ];
    legend.forEach((item, i) => {
      cell(r, i * 2, item.label, {
        fill: { patternType: "solid", fgColor: { rgb: item.color } },
        font: { sz: 9, bold: true },
        alignment: { horizontal: "center" },
        border: { all: { style: "thin", color: { rgb: "CCCCCC" } } },
      });
      if (i * 2 + 1 < COL_COUNT) {
        cell(r, i * 2 + 1, "", {
          fill: { patternType: "solid", fgColor: { rgb: item.color } },
        });
        merges.push({ s: { r, c: i * 2 }, e: { r, c: i * 2 + 1 } });
      }
    });
    r++;

    // Satır 6: boş
    r++;

    // Satır 7: Sütun başlıkları
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
    colHeaders.forEach((h, i) => {
      cell(r, i, h, {
        font: { bold: true, sz: 10 },
        fill: { patternType: "solid", fgColor: { rgb: COLORS.header } },
        alignment: { horizontal: "center", wrapText: true },
        border: {
          bottom: { style: "medium", color: { rgb: "000000" } },
          top:    { style: "thin",   color: { rgb: "AAAAAA" } },
        },
      });
    });
    r++;

    // Veri satırları
    for (const cr of compRows) {
      const bg = COLORS[cr.durum];
      const base = (align = "left") => ({
        fill: { patternType: "solid", fgColor: { rgb: bg } },
        alignment: { horizontal: align },
      });
      const numFmt = (hasFark = false) => ({
        fill: { patternType: "solid", fgColor: { rgb: bg } },
        alignment: { horizontal: "right" },
        numFmt: "#,##0.00",
        font: hasFark && cr.kdvFarki > 0.01 ? { bold: true, color: { rgb: "CC0000" } } : undefined,
      });

      cell(r, 0, cr.key,   base());
      cell(r, 1, cr.f1Ac,  base());
      cell(r, 2, cr.f2Al,  base());
      cell(r, 3, cr.tur,   base("center"));
      cell(r, 4, cr.f1Kdv,  numFmt());
      cell(r, 5, cr.f2Kdv,  numFmt());
      cell(r, 6, cr.mal,    numFmt());
      cell(r, 7, cr.toplam, numFmt());
      cell(r, 8, cr.kdvFarki, numFmt(true));
      cell(r, 9, STATUS_LABELS[cr.durum], {
        fill: { patternType: "solid", fgColor: { rgb: bg } },
        font: { bold: true },
        alignment: { horizontal: "center" },
      });
      r++;
    }

    // Sütun genişlikleri
    ws["!cols"] = [
      { wch: 22 }, { wch: 32 }, { wch: 32 }, { wch: 16 },
      { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 18 },
    ];
    ws["!ref"]    = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: r - 1, c: COL_COUNT - 1 } });
    ws["!merges"] = merges;

    // Satır yükseklikleri (başlık ve özet)
    ws["!rows"] = [{ hpt: 28 }]; // başlık satırı yüksek

    // Sayfayı workbook'a ekle
    XLSX.utils.book_append_sheet(wb, ws, "KARŞILAŞTIRMA");

    const outBuf = XLSX.write(wb, { bookType: "xlsx", type: "buffer", cellStyles: true });

    return new NextResponse(outBuf, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
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
