/**
 * POST /api/expenses/[id]/actions — iş akışı aksiyonları (tümü lib/expense/workflow.ts):
 *
 *   submit               { }                                  Taslak → onaya / Düzeltme → yeniden gönder
 *   dept-approve         { roundId }                          departman onayı
 *   dept-reject          { roundId, note }                    departman reddi (note zorunlu)
 *   accounting-approve   { version }                          muhasebe onayı
 *   accounting-reject    { version, note }                    muhasebe reddi (note zorunlu)
 *   mark-paid            { version, transactionDate?, note? } Ödendi
 *   mark-refund-received { version, transactionDate?, note? } İade Alındı
 *   cancel               { version? }                         Formu İptal Et (sahibi, Düzeltme Bekliyor)
 *   revert-settlement    { version, reason }                  kapanışı geri al (Admin)
 *   replace-approver     { approvalId, newApproverId }        pasif onaycıyı değiştir (Admin)
 *
 * Yanıt: güncel form detayı. 403 yetkisiz işlem, 404 görünmez form, 409 stale/çakışma.
 */
import { NextRequest, NextResponse } from "next/server";
import { withExpenseContext } from "@/lib/expense/http";
import { getExpenseDetail } from "@/lib/expense/data";
import { prisma } from "@/lib/prisma";
import {
  approveAccountingExpense,
  approveDepartmentExpense,
  cancelExpenseForm,
  markExpensePaid,
  markRefundReceived,
  rejectAccountingExpense,
  rejectDepartmentExpense,
  replaceExpenseApprover,
  resubmitExpenseForm,
  revertSettlement,
  submitExpenseForm,
} from "@/lib/expense/workflow";
import { ExpenseError } from "@/lib/expense/validation";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withExpenseContext(async ({ actor, scope }) => {
    const body = await req.json().catch(() => ({}));
    const id = params.id;

    switch (body?.action) {
      case "submit": {
        const current = await prisma.expenseForm.findUnique({ where: { id }, select: { status: true } });
        if (current?.status === "REVISION") await resubmitExpenseForm(actor, scope, id);
        else await submitExpenseForm(actor, scope, id);
        break;
      }
      case "dept-approve":
        await approveDepartmentExpense(actor, scope, id, body.roundId);
        break;
      case "dept-reject":
        await rejectDepartmentExpense(actor, scope, id, body.roundId, body.note);
        break;
      case "accounting-approve":
        await approveAccountingExpense(actor, scope, id, body.version);
        break;
      case "accounting-reject":
        await rejectAccountingExpense(actor, scope, id, body.version, body.note);
        break;
      case "mark-paid":
        await markExpensePaid(actor, scope, id, body);
        break;
      case "mark-refund-received":
        await markRefundReceived(actor, scope, id, body);
        break;
      case "cancel":
        await cancelExpenseForm(actor, scope, id, body.version);
        break;
      case "revert-settlement":
        await revertSettlement(actor, scope, id, body.version, body.reason);
        break;
      case "replace-approver":
        await replaceExpenseApprover(actor, scope, id, body.approvalId, body.newApproverId);
        break;
      default:
        throw new ExpenseError(400, "Geçersiz aksiyon");
    }

    return NextResponse.json(await getExpenseDetail(id, actor, scope));
  });
}
