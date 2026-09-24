/**
 * GET   /api/leave/[id] — tek talep (sahibi, kapsamındaki onaylayıcı veya ADMIN görür; aksi halde 404).
 * PATCH /api/leave/[id] — action: "approve" | "reject" | "cancel".
 *
 *   approve/reject → yalnızca canApproveLeave (lib/access.ts) true olan kullanıcı.
 *                     reject için reviewNote ZORUNLU. Yalnızca PENDING talep işlenebilir.
 *   cancel          → yalnızca talep sahibi, yalnızca kendi PENDING talebini.
 *
 * APPROVED/REJECTED/CANCELLED talep bir daha işlem göremez (section 5).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canApproveLeave, getLeaveViewScope } from "@/lib/access";
import { sendNotification } from "@/lib/notifications";
import { leaveInclude } from "@/lib/leave";

function canSeeRequest(
  user: { id: string; role: string; email?: string | null },
  request: { userId: string; userDepartment: string }
): boolean {
  if (request.userId === user.id) return true;
  const scope = getLeaveViewScope(user);
  if (scope === "ALL") return true;
  return scope.includes(request.userDepartment);
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  const userId = (session.user as any).id as string;
  const role = (session.user as any).role as string;
  const email = session.user.email ?? null;

  const request = await prisma.leaveRequest.findUnique({ where: { id: params.id }, include: leaveInclude });
  if (!request) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });

  if (!canSeeRequest({ id: userId, role, email }, { userId: request.userId, userDepartment: request.user.department })) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }

  return NextResponse.json(request);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  const userId = (session.user as any).id as string;
  const role = (session.user as any).role as string;
  const email = session.user.email ?? null;
  const userName = session.user.name ?? "";

  const existing = await prisma.leaveRequest.findUnique({
    where: { id: params.id },
    include: { user: { select: { department: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });

  const isOwner = existing.userId === userId;

  // NOT: GET'in aksine burada genel bir "görünürlük" ön-kapısı YOK — her aksiyon
  // kendi yetkisini kontrol eder (cancel→sahiplik, approve/reject→canApproveLeave)
  // ve yetkisizlikte 403 döner (#9: "yetkisiz işlem 403"). Örn. Ahmet Oruç bir YMM
  // talebini onaylamaya çalışırsa kapsamı dışında olduğu için 403 alır — kendi
  // kapsamındaki bir talebi "görüp görememesi" (404) ayrı bir sorudur (GET'te uygulanır).

  const body = await req.json().catch(() => ({}));
  const action = body.action as string | undefined;

  if (action === "cancel") {
    if (!isOwner) {
      return NextResponse.json({ error: "Yalnızca talep sahibi iptal edebilir" }, { status: 403 });
    }
    if (existing.status !== "PENDING") {
      return NextResponse.json({ error: "Yalnızca bekleyen talep iptal edilebilir" }, { status: 400 });
    }
    const updated = await prisma.leaveRequest.update({
      where: { id: params.id },
      data: { status: "CANCELLED" },
      include: leaveInclude,
    });
    return NextResponse.json(updated);
  }

  if (action === "approve" || action === "reject") {
    const canApprove = canApproveLeave(
      { id: userId, role, email },
      { userId: existing.userId, userDepartment: existing.user.department }
    );
    if (!canApprove) {
      return NextResponse.json({ error: "Bu talebi onaylama/reddetme yetkiniz yok" }, { status: 403 });
    }
    if (existing.status !== "PENDING") {
      return NextResponse.json({ error: "Yalnızca bekleyen talep işlem görebilir" }, { status: 400 });
    }
    const reviewNote = typeof body.reviewNote === "string" ? body.reviewNote.trim() : "";
    if (action === "reject" && !reviewNote) {
      return NextResponse.json({ error: "Reddetme gerekçesi zorunludur" }, { status: 400 });
    }

    const newStatus = action === "approve" ? "APPROVED" : "REJECTED";
    const updated = await prisma.leaveRequest.update({
      where: { id: params.id },
      data: {
        status: newStatus,
        reviewedBy: userName,
        reviewedAt: new Date(),
        reviewNote: reviewNote || null,
      },
      include: leaveInclude,
    });

    const statusLabel = action === "approve" ? "onaylandı" : "reddedildi";
    await sendNotification(
      existing.userId,
      action === "approve" ? "LEAVE_APPROVED" : "LEAVE_REJECTED",
      `İzin talebiniz ${statusLabel}.`,
      existing.id
    );

    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Geçersiz aksiyon" }, { status: 400 });
}
