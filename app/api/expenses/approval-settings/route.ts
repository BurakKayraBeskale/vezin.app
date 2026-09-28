/**
 * GET /api/expenses/approval-settings — departman → onaycı ayarları (yalnız ADMIN, aksi 404).
 *     Departman listesi User.department'taki mevcut değerlerden dinamik üretilir.
 * PUT /api/expenses/approval-settings — { department, approverIds } (yalnız ADMIN, aksi 403).
 *     Onaycılar yalnız o departmanın aktif kullanıcılarından seçilebilir. Açık formlar etkilenmez.
 */
import { NextRequest, NextResponse } from "next/server";
import { withExpenseContext } from "@/lib/expense/http";
import { getApprovalSettings, setDepartmentApprovers } from "@/lib/expense/data";
import { canManageExpenseApprovalSettings } from "@/lib/expense/permissions";
import { ExpenseError } from "@/lib/expense/validation";

export async function GET() {
  return withExpenseContext(async ({ actor }) => {
    if (!canManageExpenseApprovalSettings(actor)) throw new ExpenseError(404, "Bulunamadı");
    return NextResponse.json({ departments: await getApprovalSettings() });
  });
}

export async function PUT(req: NextRequest) {
  return withExpenseContext(async ({ actor }) => {
    if (!canManageExpenseApprovalSettings(actor)) throw new ExpenseError(403, "Onay ayarlarını yalnızca Admin değiştirebilir");
    const body = await req.json().catch(() => ({}));
    await setDepartmentApprovers(actor, body?.department, body?.approverIds);
    return NextResponse.json({ departments: await getApprovalSettings() });
  });
}
