import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildTaskVisibilityWhereForUser } from "@/lib/task-visibility";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));
  const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1));

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

  const userId = (session.user as any).id as string;
  const role = (session.user as any).role as string;
  const canViewAllProjects = (session.user as any).canViewAllProjects as boolean ?? false;
  const overseesDepartment = (session.user as any).overseesDepartment as string | null ?? null;

  // Görünürlük filtresi — takvim de aynı kapsamı kullanır
  const visibilityWhere = buildTaskVisibilityWhereForUser({ id: userId, role, canViewAllProjects, overseesDepartment });

  // Takvim: görünürlük kapsamındaki görevler + o aya ait vade tarihi
  const tasks = await prisma.task.findMany({
    where: {
      ...(visibilityWhere as any),
      dueDate: { gte: monthStart, lte: monthEnd },
    },
    select: {
      id: true,
      title: true,
      status: true,
      dueDate: true,
    },
  });

  // Approved leaves overlapping this month
  const leaves = await prisma.leaveRequest.findMany({
    where: {
      status: "APPROVED",
      startDate: { lte: monthEnd },
      endDate: { gte: monthStart },
    },
    select: {
      startDate: true,
      endDate: true,
      user: { select: { name: true } },
    },
  });

  // Build tasksByDay: "YYYY-MM-DD" -> [{title, status}]
  const tasksByDay: Record<string, { title: string; status: string }[]> = {};
  for (const t of tasks) {
    if (!t.dueDate) continue;
    const key = t.dueDate.toISOString().slice(0, 10);
    if (!tasksByDay[key]) tasksByDay[key] = [];
    tasksByDay[key].push({ title: t.title, status: t.status });
  }

  // Build leavesByDay: "YYYY-MM-DD" -> [userName]
  const leavesByDay: Record<string, string[]> = {};
  for (const l of leaves) {
    const cur = new Date(l.startDate);
    const end = new Date(l.endDate);
    while (cur <= end) {
      if (cur >= monthStart && cur <= monthEnd) {
        const key = cur.toISOString().slice(0, 10);
        if (!leavesByDay[key]) leavesByDay[key] = [];
        leavesByDay[key].push(l.user.name);
      }
      cur.setDate(cur.getDate() + 1);
    }
  }

  return NextResponse.json({ tasksByDay, leavesByDay });
}
