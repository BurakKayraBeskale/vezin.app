/**
 * GET  /api/leave  — "Taleplerim": yalnızca oturum sahibinin KENDİ izin talepleri.
 * POST /api/leave  — yeni izin talebi (her aktif kullanıcı kendi adına).
 *
 * "Personel İzin Durumu" (onaylayıcı/ADMIN görünümü) için ayrı uç:
 *   GET /api/leave/team, GET /api/leave/team/[userId]
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isGunuSayisi, isValidLeaveType, leaveInclude } from "@/lib/leave";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  const userId = (session.user as any).id as string;

  const requests = await prisma.leaveRequest.findMany({
    where: { userId },
    include: leaveInclude,
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(requests);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  const userId = (session.user as any).id as string;

  const body = await req.json().catch(() => ({}));
  const { startDate, endDate, type, note } = body;

  if (!startDate || !endDate || !type) {
    return NextResponse.json({ error: "Başlangıç, bitiş tarihi ve izin türü gerekli" }, { status: 400 });
  }
  if (!isValidLeaveType(type)) {
    return NextResponse.json({ error: "Geçersiz izin türü" }, { status: 400 });
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return NextResponse.json({ error: "Geçersiz tarih" }, { status: 400 });
  }
  if (end < start) {
    return NextResponse.json({ error: "Bitiş tarihi başlangıçtan önce olamaz" }, { status: 400 });
  }

  // İş günü (Cmt-Paz hariç) — tek doğru kaynak lib/leave.ts → isGunuSayisi
  const days = isGunuSayisi(start, end);
  if (days === 0) {
    return NextResponse.json({ error: "Seçilen aralıkta iş günü bulunmuyor" }, { status: 400 });
  }

  // Bu tur: bakiye kontrolü/düşümü YOK — talep her zaman PENDING olarak oluşur.
  const created = await prisma.leaveRequest.create({
    data: {
      userId,
      startDate: start,
      endDate: end,
      days,
      type,
      note: typeof note === "string" ? note.trim() || null : null,
      status: "PENDING",
    },
    include: leaveInclude,
  });

  return NextResponse.json(created, { status: 201 });
}
