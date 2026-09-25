import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { getPerformanceScope } from "@/lib/access";
import { PERFORMANS_BASLANGIC } from "@/lib/performance";

export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const scope = getPerformanceScope({
    role: (token as any).role as string,
    email: ((token as any).email as string) ?? "",
  });
  if (!scope) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });

  const { userId } = params;

  // Hedef kullanıcı: performans listesinde görünür olmalı
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, department: true, showInPerformance: true },
  });

  if (!target || !target.showInPerformance) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }

  // Kapsam kontrolü — server tarafında
  if (scope !== "ALL") {
    const requiredDept =
      scope === "BAGIMSIZ_DENETIM" ? "BAGIMSIZ_DENETIM" : "YEMINLI_MALI_MUSAVIR";
    if (target.department !== requiredDept) {
      return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
    }
  }

  // Tarih aralığı — varsayılan son 12 ay
  const url = new URL(req.url);
  const now = new Date();

  const defaultFrom = new Date(now);
  defaultFrom.setFullYear(defaultFrom.getFullYear() - 1);

  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");
  // Tarih stringleri (YYYY-MM-DD) UTC olarak yorumlanır
  const from = fromParam ? new Date(fromParam) : defaultFrom;
  const to = toParam ? new Date(toParam + "T23:59:59.999Z") : now;

  // Süresi dolmak üzere: şimdiden 7 gün sonrasına kadar
  const upcomingEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Bu kullanıcıya atanmış, dueDate'i olan tüm görevler
  const tasks = await prisma.task.findMany({
    where: {
      dueDate: { not: null, gte: PERFORMANS_BASLANGIC },
      OR: [
        { assignedToId: userId },
        { assignees: { some: { userId } } },
      ],
    },
    select: {
      id: true,
      title: true,
      status: true,
      dueDate: true,
      completedAt: true,
      project: { select: { name: true } },
    },
    orderBy: { dueDate: "desc" },
  });

  type TaskRow = (typeof tasks)[number];

  const onTime: TaskRow[] = [];
  const late: TaskRow[] = [];
  const upcoming: TaskRow[] = [];

  for (const task of tasks) {
    if (!task.dueDate) continue;

    // Süresi dolmak üzere: açık + önümüzdeki 7 gün içinde
    if (task.status !== "DONE" && task.dueDate >= now && task.dueDate <= upcomingEnd) {
      upcoming.push(task);
      continue;
    }

    // Tarih aralığı filtresi (zamanında / geciken grupları için)
    if (task.dueDate < from || task.dueDate > to) continue;

    if (task.status === "DONE") {
      if (task.completedAt && task.completedAt <= task.dueDate) {
        onTime.push(task);
      } else {
        late.push(task);
      }
    } else if (task.dueDate < now) {
      // DONE değil + süresi geçmiş → gecikmiş
      late.push(task);
    }
    // DONE değil + dueDate >= now → açık gelecek görev, gruba dahil edilmez
  }

  const total = onTime.length + late.length;
  const pct = total > 0 ? Math.round((onTime.length / total) * 100) : null;

  return NextResponse.json({
    userId: target.id,
    userName: target.name,
    from: from.toISOString(),
    to: to.toISOString(),
    pct,
    onTimeCount: onTime.length,
    lateCount: late.length,
    onTime,
    late,
    upcoming,
  });
}
