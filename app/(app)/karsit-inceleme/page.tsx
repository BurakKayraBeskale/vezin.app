import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import KarsitIncelemePanel from "@/components/KarsitIncelemePanel";
import { BYPASS_AUTH_ROLES } from "@/lib/auth-bypass";

export default async function KarsitIncelemePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { role, department } = session.user as any;
  const isAllowed =
    role === "ADMIN" ||
    department === "YEMINLI_MALI_MUSAVIR" ||
    department === "MUHASEBE";
  if (!isAllowed) redirect("/");

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Karşıt İnceleme</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Dijital Vergi Dairesi için tutanak hazırlama ve 30 günlük cevap takibi
        </p>
      </div>
      <KarsitIncelemePanel />
    </div>
  );
}
