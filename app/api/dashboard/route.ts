import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getVisibleProjectIds, buildTaskVisibilityWhere } from "@/lib/task-visibility";

function weekBounds(weeksAgo: number) {
  const now = new Date();
  const day = now.getDay(); // 0=Sun,1=Mon,...
  const diffToMonday = (day === 0 ? -6 : 1 - day);
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday - weeksAgo * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 7);
  return { start: monday, end: sunday };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const userId = (session.user as any).id as string;
  const userRole = (session.user as any).role as "ADMIN" | "MANAGER" | "EMPLOYEE";
  const canViewAllProjects = (session.user as any).canViewAllProjects as boolean ?? false;
  const overseesDepartment = (session.user as any).overseesDepartment as string | null ?? null;

  const now = new Date();
  const thisWeekStart = weekBounds(0).start;
  const { start: lastStart, end: lastEnd } = weekBounds(1);

  // Görünürlük filtresi (tasksByStatus, overdueList, weeklyData için)
  const projectIds = await getVisibleProjectIds({ id: userId, role: userRole, canViewAllProjects, overseesDepartment });
  const visibilityWhere = buildTaskVisibilityWhere(projectIds);

  // Metrik kartlar: sadece o kullanıcıya atanan görevler
  const myTasks = { assignedToId: userId };

  const [
    openTasks,
    completedThisWeek,
    overdueTasks,
    activeUsers,
    completedLastWeek,
    overdueLastWeek,
    tasksByStatus,
  ] = await Promise.all([
    prisma.task.count({
      where: { ...myTasks, status: { not: "DONE" } },
    }),
    prisma.task.count({
      where: { ...myTasks, status: "DONE", updatedAt: { gte: thisWeekStart } },
    }),
    prisma.task.count({
      where: { ...myTasks, dueDate: { lt: now }, status: { not: "DONE" } },
    }),
    // Aktif Kullanıcılar: sadece admin için hesaplanır
    userRole === "ADMIN"
      ? prisma.user.count({
          where: {
            assignedTasks: { some: { status: { in: ["IN_PROGRESS", "REVIEW"] } } },
          },
        })
      : Promise.resolve(0),
    prisma.task.count({
      where: { ...myTasks, status: "DONE", updatedAt: { gte: lastStart, lt: lastEnd } },
    }),
    prisma.task.count({
      where: { ...myTasks, dueDate: { lt: lastEnd }, status: { not: "DONE" }, createdAt: { lt: lastEnd } },
    }),
    prisma.task.groupBy({
      by: ["status"],
      where: visibilityWhere as any,
      _count: { id: true },
    }),
  ]);

  const statusMap = Object.fromEntries(
    tasksByStatus.map((s) => [s.status, s._count.id])
  );

  // Performans grafiği filtresi: görünürlük filtresiyle aynı
  const weeklyFilter = visibilityWhere;

  const weeklyData = await Promise.all(
    Array.from({ length: 7 }, async (_, i) => {
      const weeksAgo = 6 - i; // oldest first
      const { start, end } = weekBounds(weeksAgo);

      const wf = weeklyFilter as any;
      const [acilan, kapanan, geciken] = await Promise.all([
        prisma.task.count({
          where: { ...wf, createdAt: { gte: start, lt: end } },
        }),
        prisma.task.count({
          where: { ...wf, status: "DONE", updatedAt: { gte: start, lt: end } },
        }),
        prisma.task.count({
          where: { ...wf, dueDate: { gte: start, lt: end }, status: { not: "DONE" } },
        }),
      ]);

      const label = weeksAgo === 0 ? "Bu Hafta" : `H-${weeksAgo}`;
      return { week: label, acilan, kapanan, geciken };
    })
  );

  // Geciken görevler listesi (PDF için) — görünürlük filtresine tabi
  const overdueList = await prisma.task.findMany({
    where: { ...(visibilityWhere as any), dueDate: { lt: now }, status: { not: "DONE" } },
    select: { id: true, title: true, dueDate: true, assignedTo: { select: { name: true } }, priority: true },
    orderBy: { dueDate: "asc" },
    take: 15,
  });

  return NextResponse.json({
    openTasks,
    completedThisWeek,
    overdueTasks,
    activeUsers,
    completedLastWeek,
    overdueLastWeek,
    tasksByStatus: {
      todo: statusMap["TODO"] ?? 0,
      inProgress: statusMap["IN_PROGRESS"] ?? 0,
      review: statusMap["REVIEW"] ?? 0,
      done: statusMap["DONE"] ?? 0,
    },
    weeklyData,
    overdueList,
  });
}
