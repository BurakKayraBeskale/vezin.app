import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { loadExpenseActor } from "@/lib/expense/data";
import ExpenseEditor from "@/components/expense/ExpenseEditor";

export const dynamic = "force-dynamic";

/** /harcama/yeni — yeni harcama formu. Taslak ilk kayıtta oluşur, Form No o an atanır. */
export default async function YeniHarcamaPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const actor = await loadExpenseActor((session.user as { id: string }).id);
  if (!actor || actor.status !== "ACTIVE") redirect("/login");

  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-5">Yeni Harcama Formu</h1>
      <ExpenseEditor
        mode="create"
        header={{ formNo: null, ownerName: actor.name, department: actor.department, title: actor.title, createdAt: null }}
      />
    </div>
  );
}
