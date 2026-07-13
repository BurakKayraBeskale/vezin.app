import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export const dynamic = "force-dynamic";

/** Herhangi bir değeri güvenli string'e çevirir */
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

function headerStyle(ws: any, cell: any, value: string) {
  cell.value = value;
  cell.fill  = solidFill("FF1F3864");
  cell.font  = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  cell.alignment = { horizontal: "left" as const, vertical: "middle" as const };
}

function labelStyle(cell: any, value: string) {
  cell.value = value;
  cell.fill  = solidFill("FFD9E1F2");
  cell.font  = { bold: true, size: 10 };
  cell.alignment = { horizontal: "left" as const };
}

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { role } = token as any;
  if (role !== "ADMIN") return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const result = body.result ?? {};

  try {
    const ExcelJS = require("exceljs");
    const wb = new ExcelJS.Workbook();

    // ── Mukellef bilgilerini normalize et ────────────────────────────────────
    const mk = result.mukellef;
    const mukellefUnvan   = typeof mk === "string" ? mk : safeStr(mk?.unvan);
    const mukellefVergiNo = typeof mk === "string" ? safeStr(result.vergi_no) : safeStr(mk?.vergi_kimlik_no ?? result.vergi_no);
    const mukellefDaire   = typeof mk === "string" ? "" : safeStr(mk?.vergi_dairesi);
    const belge_turu      = safeStr(result.belge_turu);
    const donem           = safeStr(result.donem);

    // ── Sheet 1: Özet ────────────────────────────────────────────────────────
    const wsOzet = wb.addWorksheet("Özet");
    wsOzet.columns = [{ width: 28 }, { width: 45 }];

    // Başlık
    wsOzet.mergeCells("A1:B1");
    const titleCell = wsOzet.getCell("A1");
    titleCell.value = `${belge_turu} — ÖZET`;
    titleCell.fill  = solidFill("FF003366");
    titleCell.font  = { bold: true, size: 13, color: { argb: "FFFFFFFF" } };
    titleCell.alignment = { horizontal: "center" };
    wsOzet.getRow(1).height = 26;

    // Mükellef bloğu
    const ozetInfo: Array<[string, string]> = [
      ["Belge Türü",    belge_turu],
      ["Mükellef",      mukellefUnvan],
      ["Vergi No",      mukellefVergiNo],
      ["Vergi Dairesi", mukellefDaire],
      ["Dönem",         donem],
    ].filter(([, v]) => v) as Array<[string, string]>;

    let row = 2;
    for (const [label, value] of ozetInfo) {
      const r = wsOzet.getRow(row);
      labelStyle(r.getCell(1), label);
      r.getCell(2).value = value;
      r.getCell(2).alignment = { horizontal: "left" };
      row++;
    }

    // Özet metin
    if (result.ozet && typeof result.ozet === "string") {
      row++;
      wsOzet.mergeCells(`A${row}:B${row}`);
      const ozetCell = wsOzet.getCell(`A${row}`);
      ozetCell.value = result.ozet;
      ozetCell.font  = { italic: true, size: 10 };
      ozetCell.alignment = { wrapText: true, horizontal: "left" };
      wsOzet.getRow(row).height = 40;
      row++;
    }

    // ozet_kalemler varsa
    const ozetKalemler: any[] = Array.isArray(result.ozet_kalemler) ? result.ozet_kalemler : [];
    if (ozetKalemler.length > 0) {
      row++;
      wsOzet.mergeCells(`A${row}:B${row}`);
      headerStyle(wb, wsOzet.getCell(`A${row}`), "ÖZET KALEMLER");
      row++;

      for (const k of ozetKalemler) {
        const r = wsOzet.getRow(row);
        r.getCell(1).value = safeStr(k.alan ?? k.ad ?? k.label ?? k.key ?? "");
        const numVal = toNum(k.deger ?? k.tutar ?? k.value ?? 0);
        r.getCell(2).value  = numVal || safeStr(k.deger ?? k.tutar ?? k.value ?? "");
        if (typeof r.getCell(2).value === "number") r.getCell(2).numFmt = "#,##0.00";
        row++;
      }
    }

    wsOzet.getColumn(1).eachCell((c: any) => { if (!c.fill?.fgColor) c.fill = solidFill("FFF5F5F5"); });

    // ── Sheet 2: Tüm Veriler ──────────────────────────────────────────────────
    const wsVeriler = wb.addWorksheet("Tüm Veriler");
    wsVeriler.columns = [{ width: 40 }, { width: 22 }, { width: 10 }];

    // Başlık satırı
    ["Alan", "Değer", "Birim"].forEach((h, i) => {
      const c = wsVeriler.getRow(1).getCell(i + 1);
      c.value = h;
      c.fill  = solidFill("FF003366");
      c.font  = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
      c.alignment = { horizontal: "center" };
    });

    const bolumler: any[] = Array.isArray(result.bolumler) ? result.bolumler : [];
    const veriler:  any[] = Array.isArray(result.veriler)  ? result.veriler  : [];

    let dataRow = 2;

    if (bolumler.length > 0) {
      // bolumler varsa: her bölüm başlığı + satirlar
      for (const bolum of bolumler) {
        const bolumAdi = safeStr(bolum.ad ?? bolum.baslik ?? bolum.name ?? "");
        if (bolumAdi) {
          wsVeriler.mergeCells(`A${dataRow}:C${dataRow}`);
          const bCell = wsVeriler.getCell(`A${dataRow}`);
          bCell.value = bolumAdi;
          bCell.fill  = solidFill("FFD9E1F2");
          bCell.font  = { bold: true, size: 10 };
          dataRow++;
        }
        const satirlar: any[] = Array.isArray(bolum.satirlar ?? bolum.veriler ?? bolum.rows)
          ? (bolum.satirlar ?? bolum.veriler ?? bolum.rows) : [];
        for (const satir of satirlar) {
          const r = wsVeriler.getRow(dataRow);
          r.getCell(1).value = safeStr(satir.alan ?? satir.ad ?? satir.label ?? satir.key ?? "");
          const dStr = safeStr(satir.deger ?? satir.tutar ?? satir.value ?? "");
          const num  = toNum(dStr);
          r.getCell(2).value  = num !== 0 ? num : dStr;
          if (typeof r.getCell(2).value === "number") r.getCell(2).numFmt = "#,##0.00";
          r.getCell(3).value = safeStr(satir.birim ?? "");
          if (dataRow % 2 === 0) {
            [1, 2, 3].forEach((c) => { r.getCell(c).fill = solidFill("FFF9F9F9"); });
          }
          dataRow++;
        }
      }
    } else if (veriler.length > 0) {
      // veriler dizisi varsa
      for (const v of veriler) {
        const r = wsVeriler.getRow(dataRow);
        r.getCell(1).value = safeStr(v.alan ?? v.ad ?? v.label ?? "");
        const dStr = safeStr(v.deger ?? v.tutar ?? v.value ?? "");
        const num  = toNum(dStr);
        r.getCell(2).value  = num !== 0 ? num : dStr;
        if (typeof r.getCell(2).value === "number") r.getCell(2).numFmt = "#,##0.00";
        r.getCell(3).value = safeStr(v.birim ?? "");
        if (dataRow % 2 === 0) {
          [1, 2, 3].forEach((c) => { r.getCell(c).fill = solidFill("FFF9F9F9"); });
        }
        dataRow++;
      }
    }

    // ── Sheet 3: Tevkifat (varsa) ─────────────────────────────────────────────
    const tevkifat: any[] = Array.isArray(result.tevkifat)
      ? result.tevkifat
      : result.tevkifat ? [result.tevkifat] : [];

    if (tevkifat.length > 0) {
      const wsTev = wb.addWorksheet("Tevkifat Detayları");
      wsTev.columns = [{ width: 35 }, { width: 20 }, { width: 20 }, { width: 15 }];

      // Başlık
      wsTev.mergeCells("A1:D1");
      const tevTitle = wsTev.getCell("A1");
      tevTitle.value = "TEVKİFAT DETAYLARI";
      tevTitle.fill  = solidFill("FF003366");
      tevTitle.font  = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
      tevTitle.alignment = { horizontal: "center" };

      let tevRow = 2;
      for (const t of tevkifat) {
        const r = wsTev.getRow(tevRow);
        const keys = Object.keys(t);
        keys.forEach((k, i) => {
          if (i < 4) r.getCell(i + 1).value = safeStr(t[k]);
        });
        tevRow++;
      }
    }

    // ── Çıktı ─────────────────────────────────────────────────────────────────
    const buf  = await wb.xlsx.writeBuffer();
    const safe = belge_turu.replace(/[^\w\s-]/g, "").trim() || "beyanname";

    return new NextResponse(Buffer.from(buf), {
      status: 200,
      headers: {
        "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${safe}.xlsx"`,
      },
    });
  } catch (err: any) {
    console.error("[beyanname/excel]", err);
    return NextResponse.json({ error: "Excel oluşturulamadı: " + (err.message ?? "Bilinmeyen hata") }, { status: 500 });
  }
}
