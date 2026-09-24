import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getLeaveOverviewScope } from "@/lib/access";
import LeaveOverviewScreen from "@/components/leave/LeaveOverviewScreen";

export const dynamic = "force-dynamic";

/**
 * /izin-durumu — "Personel İzin Durumu". Tüm aktif kullanıcılar açabilir ve
 * kendi izin özetini görür; personel listesi bölümü yalnızca
 * getLeaveOverviewScope kapsamındakilere render edilir (gerçek sınır
 * API'de — /api/leave/team, /api/leave/team/[userId] — server WHERE'de).
 */
export default async function IzinDurumuPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const role = (session.user as any).role as string;
  const userId = (session.user as any).id as string;
  const email = session.user.email ?? null;

  const hasOverviewAccess = getLeaveOverviewScope({ role, email }) !== null;

  return (
    <div className="max-w-5xl mx-auto">
      <LeaveOverviewScreen
        currentUserId={userId}
        currentUserRole={role}
        currentUserEmail={email}
        hasOverviewAccess={hasOverviewAccess}
      />
    </div>
  );
}
