import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getLeaveViewScope } from "@/lib/access";
import LeaveScreen from "@/components/leave/LeaveScreen";

export const dynamic = "force-dynamic";

export default async function LeavePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const user = session.user as any;
  const scope = getLeaveViewScope({ role: user.role, email: user.email ?? "" });
  const isApprover = scope === "ALL" || scope.length > 0;

  return (
    <div className="max-w-5xl mx-auto">
      <LeaveScreen
        isApprover={isApprover}
        currentUserId={user.id}
        currentUserRole={user.role}
        currentUserEmail={user.email ?? null}
      />
    </div>
  );
}
