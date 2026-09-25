/**
 * GET /api/leave/team — "Personel İzin Durumu" (/izin-durumu) personel listesi:
 * yalnızca getLeaveOverviewScope kapsamındaki kullanıcılar (ADMIN, İsmail Koş,
 * Murat Özgür, Ebubekir Öztürk, Ahmet Oruç). Diğer herkes → 404.
 *
 * Kapsamındaki her AKTİF kullanıcı için: hizmet yılı, hak edilen gün
 * (lib/leave.ts → hesaplaIzinHakki), bu yıl kullanılan gün (onaylanmış
 * YILLIK izinlerin toplamı), kalan (yalnızca bilgi).
 *
 * showInLeaveOverview=false olan kullanıcılar (ör. İsmail Koş) bu listede
 * görünmez — showInPerformance'tan bağımsız, ayrı bir bayrak. Bu, kendi
 * özet kartını görmesini (GET /api/leave/team/[userId], isOwner bypass),
 * getLeaveOverviewScope kapsamını veya onaylayıcı yetkisini ETKİLEMEZ.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLeaveOverviewScope } from "@/lib/access";
import { hesaplaIzinHakki, hizmetSuresiMetni } from "@/lib/leave";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  const role = (session.user as any).role as string;
  const email = session.user.email ?? null;

  const scope = getLeaveOverviewScope({ role, email });
  if (scope === null) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }

  const yearParam = Number(new URL(req.url).searchParams.get("year"));
  const year = Number.isInteger(yearParam) && yearParam > 1900 ? yearParam : new Date().getFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
  const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

  const userWhere: Record<string, unknown> = { status: "ACTIVE", showInLeaveOverview: true };
  if (scope !== "ALL") userWhere.department = scope;

  const users = await prisma.user.findMany({
    where: userWhere,
    select: { id: true, name: true, department: true, hireDate: true },
    orderBy: { name: "asc" },
  });

  const userIds = users.map((u) => u.id);
  const approvedAnnual = userIds.length
    ? await prisma.leaveRequest.findMany({
        where: {
          userId: { in: userIds },
          status: "APPROVED",
          type: "ANNUAL",
          startDate: { gte: yearStart, lte: yearEnd },
          deletedAt: null,
        },
        select: { userId: true, days: true },
      })
    : [];

  const usedByUser = new Map<string, number>();
  for (const r of approvedAnnual) usedByUser.set(r.userId, (usedByUser.get(r.userId) ?? 0) + r.days);

  const result = users.map((u) => {
    const hak = hesaplaIzinHakki(u.hireDate);
    const kullanilanGun = usedByUser.get(u.id) ?? 0;
    return {
      id: u.id,
      name: u.name,
      department: u.department,
      hireDate: u.hireDate,
      hizmetYili: hak.hizmetYili,
      hizmetSuresiMetni: hizmetSuresiMetni(u.hireDate),
      hakEdilenGun: hak.hakEdilenGun,
      mesaj: hak.mesaj,
      kullanilanGun,
      kalanGun: hak.hakEdilenGun !== null ? hak.hakEdilenGun - kullanilanGun : null,
    };
  });

  return NextResponse.json({ year, users: result });
}
