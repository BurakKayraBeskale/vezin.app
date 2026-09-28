/**
 * POST /api/expenses/[id]/document — harcama belgesi (tek PDF) yükler/değiştirir.
 * Yalnız form sahibi, yalnız Taslak/Düzeltme Bekliyor. Yalnız PDF (uzantı + %PDF- imzası).
 * Önceki PDF silinmez, pasiflenir (replacedAt).
 */
import { NextRequest, NextResponse } from "next/server";
import { withExpenseContext } from "@/lib/expense/http";
import { getExpenseDetail } from "@/lib/expense/data";
import { uploadExpenseDocument } from "@/lib/expense/workflow";
import { ExpenseError } from "@/lib/expense/validation";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withExpenseContext(async ({ actor, scope }) => {
    const formData = await req.formData().catch(() => null);
    const file = formData?.get("file");
    if (!file || typeof file === "string") throw new ExpenseError(400, "Dosya bulunamadı");
    const buffer = Buffer.from(await file.arrayBuffer());
    await uploadExpenseDocument(actor, scope, params.id, { name: file.name, type: file.type, buffer });
    return NextResponse.json(await getExpenseDetail(params.id, actor, scope), { status: 201 });
  });
}
