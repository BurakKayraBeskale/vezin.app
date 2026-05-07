import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const userId = (session.user as any).id as string;

  const [overdueCount, unreadPetitions, pendingLeave, unreadNotifications] = await Promise.all([
    prisma.task.count({
      where: { dueDate: { lt: new Date() }, status: { not: "DONE" } },
    }),
    session.user.role === "ADMIN"
      ? prisma.petition.count({ where: { isRead: false } })
      : Promise.resolve(0),
    session.user.role === "ADMIN"
      ? prisma.leaveRequest.count({ where: { status: "PENDING" } })
      : Promise.resolve(0),
    (async () => {
      try {
        return await (prisma as any).notification.count({ where: { userId, isRead: false } });
      } catch {
        return 0;
      }
    })(),
  ]);

  return (
    <AppShell
      userName={session.user.name ?? ""}
      userEmail={session.user.email ?? ""}
      userRole={session.user.role}
      overdueCount={overdueCount}
      unreadPetitions={unreadPetitions}
      pendingLeave={pendingLeave}
      unreadNotifications={unreadNotifications}
    >
      {children}
    </AppShell>
  );
}
