/**
 * GET /api/expenses/export?scope=accounting|all — "Excel'e Aktar" (Form Özeti + Harcama Detayı).
 *   Filtreler liste ucuyla AYNI: q, status, dateFrom, dateTo, department, ownerId, view.
 *   Yetki: Muhasebe/Admin (403). Erişilemeyen sekme 404. Satırlar ayrıca merkezi
 *   görünürlük filtresinden geçer — yetki dışındaki form export'a girmez.
 */
import { NextRequest, NextResponse } from "next/server";
import { withExpenseContext } from "@/lib/expense/http";
import { listExpenseFormsForExport, loadExpenseTabAccess, type ExpenseListScope } from "@/lib/expense/data";
import { buildExpenseExportWorkbook } from "@/lib/expense/excel";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return withExpenseContext(async ({ actor, scope }) => {
    const sp = new URL(req.url).searchParams;
    const access = await loadExpenseTabAccess(actor, scope);
    const forms = await listExpenseFormsForExport(actor, scope, access, (sp.get("scope") ?? "accounting") as ExpenseListScope, {
      q: sp.get("q"),
      status: sp.get("status"),
      dateFrom: sp.get("dateFrom"),
      dateTo: sp.get("dateTo"),
      department: sp.get("department"),
      ownerId: sp.get("ownerId"),
      view: sp.get("view"),
    });
    const buffer = await buildExpenseExportWorkbook(forms);
    const today = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="harcama-formlari-${today}.xlsx"`,
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "private, no-store",
      },
    });
  });
}
