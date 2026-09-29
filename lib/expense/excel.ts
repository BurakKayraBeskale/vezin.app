/**
 * Personel Harcama Formu — Excel export (YALNIZ sunucu, ExcelJS).
 *
 *   Sheet 1 "Form Özeti"      → form başına bir satır
 *   Sheet 2 "Harcama Detayı"  → harcama satırı başına bir satır
 *
 * Veri lib/expense/data.ts listExpenseFormsForExport'tan gelir (yetki + ekran filtreleri orada).
 */

import ExcelJS from "exceljs";
import { EXPENSE_STATUS_LABELS, expenseDepartmentLabel, type ExpenseStatus } from "./constants";
import type { ExpenseExportForm } from "./data";

const ORANGE = "FFF57C28";
const WHITE = "FFFFFFFF";
const NUM_FMT = "#,##0.00";
const DATE_FMT = "dd.mm.yyyy";

/** Zaman damgası → Türkiye takvim günü (UTC gece yarısı; Excel'de gün kaymaz). */
function istanbulDay(d: Date | null): Date | null {
  if (!d) return null;
  const tr = new Date(d.getTime() + 3 * 60 * 60 * 1000);
  return new Date(Date.UTC(tr.getUTCFullYear(), tr.getUTCMonth(), tr.getUTCDate()));
}

function statusLabel(status: string): string {
  return EXPENSE_STATUS_LABELS[status as ExpenseStatus] ?? status;
}

interface Column {
  header: string;
  width: number;
  kind?: "money" | "date";
}

function addSheet(wb: ExcelJS.Workbook, name: string, columns: Column[], rows: (string | number | Date | null)[][]) {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = columns.map((c) => ({ header: c.header, width: c.width }));

  const head = ws.getRow(1);
  head.height = 22;
  head.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ORANGE } };
    cell.font = { bold: true, color: { argb: WHITE } };
    cell.alignment = { vertical: "middle", wrapText: true };
  });

  for (const values of rows) {
    const row = ws.addRow(values);
    columns.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      if (c.kind === "money") cell.numFmt = NUM_FMT;
      if (c.kind === "date") cell.numFmt = DATE_FMT;
    });
  }
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  return ws;
}

export async function buildExpenseExportWorkbook(forms: ExpenseExportForm[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Vezin";
  wb.created = new Date();

  addSheet(
    wb,
    "Form Özeti",
    [
      { header: "Form No", width: 18 },
      { header: "Personel", width: 26 },
      { header: "Departman", width: 24 },
      { header: "Toplam Harcama", width: 16, kind: "money" },
      { header: "Nakit Avans", width: 14, kind: "money" },
      { header: "Net Tutar", width: 14, kind: "money" },
      { header: "Durum", width: 20 },
      { header: "Muhasebe Onay Tarihi", width: 18, kind: "date" },
      { header: "Ödeme/İade Tarihi", width: 18, kind: "date" },
    ],
    forms.map((f) => [
      f.formNo,
      f.ownerName,
      expenseDepartmentLabel(f.department),
      f.totalAmount,
      f.cashAdvance,
      f.netAmount,
      statusLabel(f.status),
      istanbulDay(f.accountingApprovedAt),
      f.settledAt,
    ])
  );

  addSheet(
    wb,
    "Harcama Detayı",
    [
      { header: "Form No", width: 18 },
      { header: "Personel", width: 26 },
      { header: "Departman", width: 24 },
      { header: "Harcama Tarihi", width: 14, kind: "date" },
      { header: "Harcama Konusu", width: 26 },
      { header: "Firma/Harcama Yeri", width: 26 },
      { header: "Açıklama", width: 40 },
      { header: "İlgili Müşteri/Proje", width: 26 },
      { header: "Tutar", width: 14, kind: "money" },
    ],
    forms.flatMap((f) =>
      f.items.map((i) => [
        f.formNo,
        f.ownerName,
        expenseDepartmentLabel(f.department),
        i.date,
        i.subject,
        i.vendor,
        i.description,
        i.clientProject ?? "",
        i.amount,
      ])
    )
  );

  return Buffer.from(await wb.xlsx.writeBuffer());
}
