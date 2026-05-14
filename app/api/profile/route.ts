import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const userId = (session.user as any).id as string;

  const [user, taskStats, leaveBalance] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, department: true, createdAt: true },
    }),
    prisma.task.groupBy({
      by: ["status"],
      where: { assignedToId: userId },
      _count: true,
    }),
    prisma.leaveBalance.findFirst({
      where: { userId, year: new Date().getFullYear() },
    }),
  ]);

  if (!user) return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });

  const now = new Date();
  const overdueTasks = await prisma.task.count({
    where: { assignedToId: userId, status: { not: "DONE" }, dueDate: { lt: now } },
  });

  const stats = {
    todo: 0, inProgress: 0, review: 0, done: 0, overdue: overdueTasks,
  };
  for (const g of taskStats) {
    if (g.status === "TODO")        stats.todo       = g._count;
    if (g.status === "IN_PROGRESS") stats.inProgress = g._count;
    if (g.status === "REVIEW")      stats.review     = g._count;
    if (g.status === "DONE")        stats.done       = g._count;
  }

  return NextResponse.json({ user, stats, leaveBalance });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const userId = (session.user as any).id as string;
  const body = await req.json();

  const data: Record<string, unknown> = {};

  if (body.name?.trim()) data.name = body.name.trim();

  if (body.email?.trim()) {
    const existing = await prisma.user.findFirst({
      where: { email: body.email.trim(), NOT: { id: userId } },
    });
    if (existing) return NextResponse.json({ error: "Bu e-posta başka bir hesapta kullanılıyor" }, { status: 400 });
    data.email = body.email.trim();
  }

  if (body.newPassword) {
    if (!body.currentPassword) return NextResponse.json({ error: "Mevcut şifre gerekli" }, { status: 400 });
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
    const valid = await bcrypt.compare(body.currentPassword, user.password);
    if (!valid) return NextResponse.json({ error: "Mevcut şifre hatalı" }, { status: 400 });
    data.password = await bcrypt.hash(body.newPassword, 10);
    data.mustChangePassword = false;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Güncellenecek alan yok" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
    select: { id: true, name: true, email: true, role: true, department: true },
  });

  return NextResponse.json(updated);
}
