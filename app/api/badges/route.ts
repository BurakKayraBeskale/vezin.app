import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getVisibleProjectIds, buildTaskVisibilityWhere } from "@/lib/task-visibility";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const userId = (session.user as any).id as string;
  const role = session.user.role as string;
  const department = (session.user as any).department as string;

  const canViewAllProjects = (session.user as any).canViewAllProjects as boolean ?? false;
  const overseesDepartment = (session.user as any).overseesDepartment as string | null ?? null;
  const projectIds = await getVisibleProjectIds({ id: userId, role, canViewAllProjects, overseesDepartment });
  const visibilityWhere = buildTaskVisibilityWhere(projectIds);

  const [overdueCount, unreadPetitions, pendingLeave, unreadNotifications] = await Promise.all([
    prisma.task.count({
      where: { ...(visibilityWhere as any), dueDate: { lt: new Date() }, status: { not: "DONE" } },
    }),
    role === "ADMIN"
      ? prisma.petition.count({ where: { isRead: false } })
      : Promise.resolve(0),
    role === "ADMIN"
      ? prisma.leaveRequest.count({ where: { status: "PENDING" } })
      : Promise.resolve(0),
    (async () => {
      try {
        return await prisma.notification.count({ where: { userId, isRead: false } });
      } catch {
        return 0;
      }
    })(),
  ]);

  return NextResponse.json({ overdueCount, unreadPetitions, pendingLeave, unreadNotifications });
}
