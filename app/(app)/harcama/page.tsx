import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { loadExpenseActor, loadExpenseActorScope, loadExpenseTabAccess } from "@/lib/expense/data";
import ExpenseScreen from "@/components/expense/ExpenseScreen";

export const dynamic = "force-dynamic";

/**
 * /harcama — Personel Harcama Formu. Sekmeler yetkiye göre (getExpenseTabAccess);
 * gerçek sınır API'dedir (/api/expenses — yetkisiz sekme 404).
 */
export default async function HarcamaPage({
  searchParams,
}: {
  searchParams?: { tab?: string; status?: string; ownerId?: string; view?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const actor = await loadExpenseActor((session.user as { id: string }).id);
  if (!actor || actor.status !== "ACTIVE") redirect("/login");
  const scope = await loadExpenseActorScope(actor);
  const access = await loadExpenseTabAccess(actor, scope);

  return (
    <div className="max-w-7xl mx-auto">
      <ExpenseScreen
        access={access}
        initialTab={searchParams?.tab}
        initialFilters={{ status: searchParams?.status, ownerId: searchParams?.ownerId, view: searchParams?.view }}
      />
    </div>
  );
}
