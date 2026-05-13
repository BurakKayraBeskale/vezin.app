import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const userId = (session.user as any).id as string;
  const role = (session.user as any).role as string;
  const department = (session.user as any).department as string;

  const isAdmin = role === "ADMIN";
  const isMuhasebe = department === "MUHASEBE";
  const isManager = role === "MANAGER";

  let whereClause: object = { userId };
  if (isAdmin || isMuhasebe) whereClause = {};
  else if (isManager) whereClause = { user: { department } };

  const requests = await prisma.leaveRequest.findMany({
    where: whereClause,
    include: {
      user: { select: { id: true, name: true, email: true, department: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Admin, muhasebe ve manager düz array alır; çalışanlar balance ile birlikte alır
  if (isAdmin || isMuhasebe || isManager) {
    return NextResponse.json(requests);
  }

  const balance = await prisma.leaveBalance.findUnique({
    where: { userId_year: { userId, year: new Date().getFullYear() } },
  });

  return NextResponse.json({ requests, balance });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const userId = (session.user as any).id as string;

  const { startDate, endDate, type, note } = await req.json();

  if (!startDate || !endDate || !type) {
    return NextResponse.json({ error: "Başlangıç, bitiş tarihi ve izin türü gerekli" }, { status: 400 });
  }

  const validTypes = ["ANNUAL", "EXCUSE", "UNPAID"];
  if (!validTypes.includes(type)) {
    return NextResponse.json({ error: "Geçersiz izin türü" }, { status: 400 });
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (end < start) {
    return NextResponse.json({ error: "Bitiş tarihi başlangıçtan önce olamaz" }, { status: 400 });
  }

  // İş günü hesapla (Pzt-Cum)
  let days = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) days++;
    cur.setDate(cur.getDate() + 1);
  }
  if (days === 0) {
    return NextResponse.json({ error: "Seçilen aralıkta iş günü bulunmuyor" }, { status: 400 });
  }

  // Yıllık izin için bakiye kontrol/oluştur
  if (type === "ANNUAL") {
    const year = start.getFullYear();
    const balance = await prisma.leaveBalance.upsert({
      where: { userId_year: { userId, year } },
      create: { userId, year, totalDays: 14, usedDays: 0, remainingDays: 14 },
      update: {},
    });
    if (balance.remainingDays < days) {
      return NextResponse.json(
        { error: `Yeterli yıllık izin bakiyesi yok. Kalan: ${balance.remainingDays} gün` },
        { status: 400 }
      );
    }
  }

  const request = await prisma.leaveRequest.create({
    data: {
      userId,
      startDate: start,
      endDate: end,
      days,
      type,
      note: note?.trim() || null,
      status: "PENDING",
    },
    include: { user: { select: { id: true, name: true, email: true, department: true } } },
  });

  return NextResponse.json(request, { status: 201 });
}
