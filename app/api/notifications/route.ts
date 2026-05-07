import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function notifModel() {
  const m = (prisma as any).notification;
  if (!m) throw new Error("Notification modeli henüz oluşturulmadı — prisma generate çalıştırın");
  return m;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const userId = (session.user as any).id as string;

  try {
    const nm = notifModel();
    const [notifications, unreadCount] = await Promise.all([
      nm.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 60 }),
      nm.count({ where: { userId, isRead: false } }),
    ]);
    return NextResponse.json({ notifications, unreadCount });
  } catch {
    return NextResponse.json({ notifications: [], unreadCount: 0 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const userId = (session.user as any).id as string;
  const body = await req.json();

  try {
    const nm = notifModel();
    if (body.markAll) {
      await nm.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
    } else if (body.id) {
      await nm.updateMany({ where: { id: body.id, userId }, data: { isRead: true } });
    }
  } catch { /* model henüz yok, sessizce geç */ }

  return NextResponse.json({ ok: true });
}
