/**
 * Personel Harcama Formu — API uçları için ortak oturum/hata sarmalayıcısı.
 * Aktör her istekte DB'den okunur; pasif/silinmiş kullanıcı 401 alır.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { loadExpenseActor, loadExpenseActorScope, type ExpenseActorFull } from "./data";
import type { ExpenseActorScope } from "./permissions";
import { ExpenseError } from "./validation";

export interface ExpenseRequestContext {
  actor: ExpenseActorFull;
  scope: ExpenseActorScope;
}

export async function withExpenseContext(
  handler: (ctx: ExpenseRequestContext) => Promise<NextResponse | Response>
): Promise<NextResponse | Response> {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const actor = await loadExpenseActor(userId);
  if (!actor || actor.status !== "ACTIVE") return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  const scope = await loadExpenseActorScope(actor);

  try {
    return await handler({ actor, scope });
  } catch (e) {
    if (e instanceof ExpenseError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
