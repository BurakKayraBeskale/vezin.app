import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  const now = new Date();
  const thisWeekStart = weekBounds(0).start;
  const { start: lastStart, end: lastEnd } = weekBounds(1);

  const [
    openTasks,
    completedThisWeek,
    overdueTasks,
    activeUsers,
    completedLastWeek,
    overdueLastWeek,
    tasksByStatus,
  ] = await Promise.all([
    prisma.task.count({ where: { status: { not: "DONE" } } }),
    prisma.task.count({
      where: { status: "DONE", updatedAt: { gte: thisWeekStart } },
    }),
    prisma.task.count({
      where: { dueDate: { lt: now }, status: { not: "DONE" } },
    }),
    prisma.user.count({
      where: {
        assignedTasks: { some: { status: { in: ["IN_PROGRESS", "REVIEW"] } } },
      },
    }),
    prisma.task.count({
      where: { status: "DONE", updatedAt: { gte: lastStart, lt: lastEnd } },
    }),
    prisma.task.count({
      where: { dueDate: { lt: lastEnd }, status: { not: "DONE" }, createdAt: { lt: lastEnd } },
    }),
    prisma.task.groupBy({
      by: ["status"],
      _count: { id: true },
    }),
  ]);

  const statusMap = Object.fromEntries(
    tasksByStatus.map((s) => [s.status, s._count.id])
  );

  // Last 7 weeks performance
  const weeklyData = await Promise.all(
    Array.from({ length: 7 }, async (_, i) => {
      const weeksAgo = 6 - i; // oldest first
      const { start, end } = weekBounds(weeksAgo);

      const [acilan, kapanan, geciken] = await Promise.all([
        prisma.task.count({ where: { createdAt: { gte: start, lt: end } } }),
        prisma.task.count({ where: { status: "DONE", updatedAt: { gte: start, lt: end } } }),
        prisma.task.count({
          where: { dueDate: { gte: start, lt: end }, status: { not: "DONE" } },
        }),
      ]);

      const label = weeksAgo === 0 ? "Bu Hafta" : `H-${weeksAgo}`;
      return { week: label, acilan, kapanan, geciken };
    })
  );

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
  });
}
