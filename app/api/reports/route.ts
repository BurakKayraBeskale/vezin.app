import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DEPT_LABELS: Record<string, string> = {
  OUTSOURCE:            "Outsource",
  BAGIMSIZ_DENETIM:     "Bağımsız Denetim",
  MUHASEBE:             "Muhasebe",
  YEMINLI_MALI_MUSAVIR: "YMM",
  ADMIN:                "Yönetim",
};

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const role = (session.user as any).role as string;
  if (role !== "ADMIN") return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") ?? "monthly"; // weekly | monthly

  const now = new Date();
  let since: Date;
  if (period === "weekly") {
    since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else {
    since = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const [tasks, users, leaveBalances, taskLogs] = await Promise.all([
    prisma.task.findMany({
      select: {
        id: true, status: true, dueDate: true,
        assignedTo: { select: { id: true, name: true, department: true } },
      },
    }),
    prisma.user.findMany({
      select: { id: true, name: true, department: true, role: true },
      orderBy: { name: "asc" },
    }),
    prisma.leaveBalance.findMany({
      where: { year: now.getFullYear() },
      include: { user: { select: { id: true, name: true, department: true } } },
    }),
    prisma.taskLog.findMany({
      where: { action: "COMPLETED", timestamp: { gte: since } },
      select: { taskId: true, userId: true, durationMinutes: true, timestamp: true },
    }),
  ]);

  // 1. Department task distribution
  const deptMap: Record<string, { dept: string; label: string; todo: number; inProgress: number; review: number; done: number; overdue: number }> = {};
  for (const task of tasks) {
    const dept = task.assignedTo?.department ?? "UNASSIGNED";
    if (!deptMap[dept]) {
      deptMap[dept] = { dept, label: DEPT_LABELS[dept] ?? dept, todo: 0, inProgress: 0, review: 0, done: 0, overdue: 0 };
    }
    if (task.status === "TODO")        deptMap[dept].todo++;
    if (task.status === "IN_PROGRESS") deptMap[dept].inProgress++;
    if (task.status === "REVIEW")      deptMap[dept].review++;
    if (task.status === "DONE")        deptMap[dept].done++;
    if (task.dueDate && new Date(task.dueDate) < now && task.status !== "DONE") deptMap[dept].overdue++;
  }
  const departmentStats = Object.values(deptMap);

  // 2. Person performance
  const personMap: Record<string, { userId: string; name: string; dept: string; todo: number; inProgress: number; review: number; done: number; overdue: number; completedThisPeriod: number; totalDurationMinutes: number; completedCount: number }> = {};
  for (const u of users) {
    personMap[u.id] = {
      userId: u.id, name: u.name, dept: DEPT_LABELS[u.department] ?? u.department,
      todo: 0, inProgress: 0, review: 0, done: 0, overdue: 0,
      completedThisPeriod: 0, totalDurationMinutes: 0, completedCount: 0,
    };
  }
  for (const task of tasks) {
    if (!task.assignedTo) continue;
    const p = personMap[task.assignedTo.id];
    if (!p) continue;
    if (task.status === "TODO")        p.todo++;
    if (task.status === "IN_PROGRESS") p.inProgress++;
    if (task.status === "REVIEW")      p.review++;
    if (task.status === "DONE")        p.done++;
    if (task.dueDate && new Date(task.dueDate) < now && task.status !== "DONE") p.overdue++;
  }
  for (const log of taskLogs) {
    const p = personMap[log.userId];
    if (!p) continue;
    p.completedThisPeriod++;
    if (log.durationMinutes) {
      p.totalDurationMinutes += log.durationMinutes;
      p.completedCount++;
    }
  }
  const personStats = Object.values(personMap)
    .filter((p) => p.todo + p.inProgress + p.review + p.done > 0 || p.completedThisPeriod > 0)
    .map((p) => ({
      ...p,
      avgDurationMinutes: p.completedCount > 0 ? Math.round(p.totalDurationMinutes / p.completedCount) : null,
    }));

  // 3. Leave stats
  const leaveStats = leaveBalances.map((b) => ({
    userId: b.userId,
    name: b.user.name,
    dept: DEPT_LABELS[b.user.department] ?? b.user.department,
    totalDays: b.totalDays,
    usedDays: b.usedDays,
    remainingDays: b.remainingDays,
    year: b.year,
  }));

  // 4. Weekly chart (last 7 weeks)
  const weeklyChart: { week: string; tamamlanan: number; ortalamaDk: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const weekStart = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    const logsInWeek = taskLogs.filter((l) => {
      const t = new Date(l.timestamp);
      return t >= weekStart && t < weekEnd;
    });
    const withDuration = logsInWeek.filter((l) => l.durationMinutes);
    const avgDk = withDuration.length > 0
      ? Math.round(withDuration.reduce((s, l) => s + (l.durationMinutes ?? 0), 0) / withDuration.length)
      : 0;
    weeklyChart.push({
      week: weekStart.toLocaleDateString("tr-TR", { day: "numeric", month: "short" }),
      tamamlanan: logsInWeek.length,
      ortalamaDk: avgDk,
    });
  }

  return NextResponse.json({ departmentStats, personStats, leaveStats, weeklyChart, period, since: since.toISOString() });
}
