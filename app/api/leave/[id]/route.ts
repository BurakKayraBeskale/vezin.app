import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const role = (session.user as any).role as string;
  const department = (session.user as any).department as string;

  const isAdmin = role === "ADMIN";
  const isMuhasebe = department === "MUHASEBE";

  if (!isAdmin && !isMuhasebe) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }

  const { status } = await req.json();
  if (!["APPROVED", "REJECTED"].includes(status)) {
    return NextResponse.json({ error: "Geçersiz durum" }, { status: 400 });
  }

  const existing = await prisma.leaveRequest.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  if (existing.status !== "PENDING") {
    return NextResponse.json({ error: "Zaten işlem görmüş" }, { status: 400 });
  }

  const updated = await prisma.leaveRequest.update({
    where: { id: params.id },
    data: { status, reviewedBy: session.user.name },
    include: { user: { select: { id: true, name: true, email: true, department: true } } },
  });

  // Onaylandıysa ve yıllık izinse bakiyeyi güncelle
  if (status === "APPROVED" && existing.type === "ANNUAL") {
    const year = existing.startDate.getFullYear();
    await prisma.leaveBalance.updateMany({
      where: { userId: existing.userId, year },
      data: {
        usedDays: { increment: existing.days },
        remainingDays: { decrement: existing.days },
      },
    });
  }

  // Bildirim gönder
  try {
    const statusLabel = status === "APPROVED" ? "onaylandı" : "reddedildi";
    await prisma.notification.create({
      data: {
        userId: existing.userId,
        type: status === "APPROVED" ? "LEAVE_APPROVED" : "LEAVE_REJECTED",
        message: `İzin talebiniz ${statusLabel}.`,
        relatedId: existing.id,
      },
    });
  } catch { /* bildirim hatası işlemi etkilemesin */ }

  return NextResponse.json(updated);
}
