/**
 * GET /api/leave/team/[userId] — bir kişinin izin geçmişi + hak dökümü.
 *
 * Görebilenler: kendisi (herkes kendi özetini görebilir — /izin-durumu #2),
 * kapsamındaki onaylayıcılar (getLeaveOverviewScope), ADMIN. Başkası → 404.
 * Yıl filtresi (?year=) yalnızca izin GEÇMİŞİ listesini (requests) süzer,
 * varsayılan içinde bulunulan yıl. Bakiye (toplam hak / kullanılan / kalan)
 * BİRİKMİŞTİR ve yıldan bağımsızdır — kullanılan gün devir
 * (carryUsedDays) ile uygulama içi kullanım ayrı alanlarda döner.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLeaveOverviewScope } from "@/lib/access";
import { hesaplaIzinHakki, hizmetSuresiMetni, izinBakiyesi, kullanilanIzinWhere, leaveInclude } from "@/lib/leave";

export async function GET(req: NextRequest, { params }: { params: { userId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  const currentUserId = (session.user as any).id as string;
  const role = (session.user as any).role as string;
  const email = session.user.email ?? null;

  const target = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { id: true, name: true, department: true, hireDate: true, carryUsedDays: true },
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

  const uygulamaKullanilan = await prisma.leaveRequest.aggregate({
    where: { userId: target.id, ...kullanilanIzinWhere },
    _sum: { days: true },
  });

  const hak = hesaplaIzinHakki(target.hireDate);

  return NextResponse.json({
    user: { id: target.id, name: target.name, department: target.department, hireDate: target.hireDate },
    year,
    hizmetYili: hak.hizmetYili,
    hizmetSuresiMetni: hizmetSuresiMetni(target.hireDate),
    mesaj: hak.mesaj,
    ...izinBakiyesi(target.hireDate, target.carryUsedDays, uygulamaKullanilan._sum.days ?? 0),
    requests,
  });
}
