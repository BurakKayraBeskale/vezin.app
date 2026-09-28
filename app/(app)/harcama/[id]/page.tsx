import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getExpenseDetail, loadExpenseActor, loadExpenseActorScope } from "@/lib/expense/data";
import { ExpenseError } from "@/lib/expense/validation";
import ExpenseDetailView from "@/components/expense/ExpenseDetailView";
import type { ExpenseDetailDTO } from "@/components/expense/types";

export const dynamic = "force-dynamic";

/** /harcama/[id] — form detayı. Görme yetkisi yoksa 404 (canViewExpenseForm). */
export default async function HarcamaDetayPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const actor = await loadExpenseActor((session.user as { id: string }).id);
  if (!actor || actor.status !== "ACTIVE") redirect("/login");
  const scope = await loadExpenseActorScope(actor);

  let detail;
  try {
    detail = await getExpenseDetail(params.id, actor, scope);
  } catch (e) {
    if (e instanceof ExpenseError && e.status === 404) notFound();
    throw e;
  }
  // Date → ISO metin (client bileşeni API yanıtıyla aynı şekli alır)
  const initial: ExpenseDetailDTO = JSON.parse(JSON.stringify(detail));

  return (
    <div className="max-w-7xl mx-auto">
      <ExpenseDetailView initial={initial} />
    </div>
  );
}
