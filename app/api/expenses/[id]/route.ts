/**
 * GET    /api/expenses/[id] — form detayı (+ UI yetki bayrakları). Görme yetkisi yoksa 404.
 * PATCH  /api/expenses/[id] — içerik güncelleme: yalnız sahibi, yalnız Taslak/Düzeltme Bekliyor.
 *        Toplam/net istemciden alınmaz, sunucu hesaplar.
 * DELETE /api/expenses/[id] — taslak kalıcı silme (hiç gönderilmemişse).
 */
import { NextRequest, NextResponse } from "next/server";
import { withExpenseContext } from "@/lib/expense/http";
import { getExpenseDetail } from "@/lib/expense/data";
import { deleteExpenseDraft, updateExpenseDraft } from "@/lib/expense/workflow";
import { parseExpenseDraftInput } from "@/lib/expense/validation";

type Params = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: Params) {
  return withExpenseContext(async ({ actor, scope }) => NextResponse.json(await getExpenseDetail(params.id, actor, scope)));
}

export async function PATCH(req: NextRequest, { params }: Params) {
  return withExpenseContext(async ({ actor, scope }) => {
    const input = parseExpenseDraftInput(await req.json().catch(() => null));
    await updateExpenseDraft(actor, scope, params.id, input);
    return NextResponse.json(await getExpenseDetail(params.id, actor, scope));
  });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  return withExpenseContext(async ({ actor, scope }) => {
    await deleteExpenseDraft(actor, scope, params.id);
    return NextResponse.json({ ok: true });
  });
}
