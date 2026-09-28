/**
 * GET  /api/expenses?scope=mine|approvals|accounting|all — liste (+ Formlarım özet kartları)
 *      Filtreler: q, status, dateFrom, dateTo (YYYY-MM-DD), department, ownerId, view=pending|all
 *      Yetkisiz sekme → 404. Her sorgu ayrıca merkezi görünürlük filtresinden geçer.
 * POST /api/expenses — yeni taslak (Form No sistem üretir).
 */
import { NextRequest, NextResponse } from "next/server";
import { withExpenseContext } from "@/lib/expense/http";
import { getExpenseDetail, getExpenseSummary, listExpenseForms, loadExpenseTabAccess, type ExpenseListScope } from "@/lib/expense/data";
import { createExpenseForm } from "@/lib/expense/workflow";
import { ExpenseError, parseExpenseDraftInput } from "@/lib/expense/validation";

const SCOPES: ExpenseListScope[] = ["mine", "approvals", "accounting", "all"];

export async function GET(req: NextRequest) {
  return withExpenseContext(async ({ actor, scope }) => {
    const sp = new URL(req.url).searchParams;
    const listScope = (sp.get("scope") ?? "mine") as ExpenseListScope;
    if (!SCOPES.includes(listScope)) throw new ExpenseError(400, "Geçersiz liste");
    const access = await loadExpenseTabAccess(actor, scope);
    const result = await listExpenseForms(actor, scope, access, listScope, {
      q: sp.get("q"),
      status: sp.get("status"),
      dateFrom: sp.get("dateFrom"),
      dateTo: sp.get("dateTo"),
      department: sp.get("department"),
      ownerId: sp.get("ownerId"),
      view: sp.get("view"),
    });
    const summary = listScope === "mine" ? await getExpenseSummary(actor.id) : null;
    return NextResponse.json({ ...result, summary });
  });
}

export async function POST(req: NextRequest) {
  return withExpenseContext(async ({ actor, scope }) => {
    const input = parseExpenseDraftInput(await req.json().catch(() => null));
    const id = await createExpenseForm(actor, input);
    return NextResponse.json(await getExpenseDetail(id, actor, scope), { status: 201 });
  });
}
