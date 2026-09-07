import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { getPerformanceScope } from "@/lib/access";

function deptWhere(
  scope: "ALL" | "BAGIMSIZ_DENETIM" | "YEMINLI_MALI_MUSAVIR"
): { department: string } | undefined {
  if (scope === "ALL") return undefined;
  if (scope === "BAGIMSIZ_DENETIM") return { department: "BAGIMSIZ_DENETIM" };
  return { department: "YEMINLI_MALI_MUSAVIR" };
}

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const scope = getPerformanceScope({
    role: (token as any).role as string,
    email: ((token as any).email as string) ?? "",
  });

  if (!scope) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });

  const now = new Date();
  const userFilter = deptWhere(scope);

  // Scope dahilindeki atanabilir personel
  const scopeUsers = await prisma.user.findMany({
    where: { ...userFilter, canBeAssignedTasks: true },
    select: { id: true, name: true, email: true, department: true },
    orderBy: { name: "asc" },
  });

  if (scopeUsers.length === 0) return NextResponse.json([]);

  const scopeUserIds = scopeUsers.map((u) => u.id);

  // Bu kullanıcılara atanmış, dueDate'i olan tüm görevler
  const tasks = await prisma.task.findMany({
    where: {
      dueDate: { not: null },
      OR: [
        { assignedToId: { in: scopeUserIds } },
        { assignees: { some: { userId: { in: scopeUserIds } } } },
      ],
    },
    select: {
      id: true,
      status: true,
      dueDate: true,
      completedAt: true,
      assignedToId: true,
      assignees: { select: { userId: true } },
    },
  });

  // Kullanıcı başına sayaçlar
  const stats: Record<string, { onTime: number; late: number }> = {};
  for (const uid of scopeUserIds) stats[uid] = { onTime: 0, late: 0 };

  for (const task of tasks) {
    if (!task.dueDate) continue;

    // Bu göreve atanmış scope içindeki kullanıcılar
    const taskUsers = new Set<string>();
    if (task.assignedToId && stats[task.assignedToId]) taskUsers.add(task.assignedToId);
    for (const { userId } of task.assignees) {
      if (stats[userId]) taskUsers.add(userId);
    }

    for (const uid of taskUsers) {
      if (task.status === "DONE") {
        // completedAt <= dueDate → zamanında
        if (task.completedAt && task.completedAt <= task.dueDate) {
          stats[uid].onTime++;
        } else {
          stats[uid].late++;
        }
      } else if (task.dueDate < now) {
        // DONE değil ve süresi geçmiş → gecikmiş
        stats[uid].late++;
      }
      // DONE değil + dueDate >= now → henüz bitmemiş açık görev, hesaba katılmaz
    }
  }

  const result = scopeUsers.map((u) => {
    const { onTime, late } = stats[u.id];
    const total = onTime + late;
    const pct = total > 0 ? Math.round((onTime / total) * 100) : null;
    return { id: u.id, name: u.name, email: u.email, department: u.department, onTime, late, total, pct };
  });

  return NextResponse.json(result);
}
