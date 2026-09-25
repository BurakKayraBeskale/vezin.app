/**
 * GET /api/leave/team/[userId] — bir kişinin izin geçmişi + hak dökümü.
 *
 * Görebilenler: kendisi (herkes kendi özetini görebilir — /izin-durumu #2),
 * kapsamındaki onaylayıcılar (getLeaveOverviewScope), ADMIN. Başkası → 404.
 * Yıl filtresi (?year=), varsayılan içinde bulunulan yıl.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLeaveOverviewScope } from "@/lib/access";
import { hesaplaIzinHakki, hizmetSuresiMetni, leaveInclude } from "@/lib/leave";

export async function GET(req: NextRequest, { params }: { params: { userId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  const currentUserId = (session.user as any).id as string;
  const role = (session.user as any).role as string;
  const email = session.user.email ?? null;

  const target = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { id: true, name: true, department: true, hireDate: true },
  });
  if (!target) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });

  const isOwner = target.id === currentUserId;
  const scope = getLeaveOverviewScope({ role, email });
  const canSee = isOwner || scope === "ALL" || scope === target.department;
  if (!canSee) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });

  const yearParam = Number(new URL(req.url).searchParams.get("year"));
  const year = Number.isInteger(yearParam) && yearParam > 1900 ? yearParam : new Date().getFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
  const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

  const requests = await prisma.leaveRequest.findMany({
    where: { userId: target.id, startDate: { gte: yearStart, lte: yearEnd }, deletedAt: null },
    include: leaveInclude,
    orderBy: { startDate: "desc" },
  });

  const hak = hesaplaIzinHakki(target.hireDate);
  const kullanilanGun = requests
    .filter((r) => r.status === "APPROVED" && r.type === "ANNUAL")
    .reduce((sum, r) => sum + r.days, 0);

  return NextResponse.json({
    user: { id: target.id, name: target.name, department: target.department, hireDate: target.hireDate },
    year,
    hizmetYili: hak.hizmetYili,
    hizmetSuresiMetni: hizmetSuresiMetni(target.hireDate),
    hakEdilenGun: hak.hakEdilenGun,
    mesaj: hak.mesaj,
    kullanilanGun,
    kalanGun: hak.hakEdilenGun !== null ? hak.hakEdilenGun - kullanilanGun : null,
    requests,
  });
}
