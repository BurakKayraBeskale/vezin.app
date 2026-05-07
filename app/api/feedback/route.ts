import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const { taskId, message } = await req.json();
  if (!taskId || !message?.trim()) {
    return NextResponse.json({ error: "Görev ID ve mesaj gerekli" }, { status: 400 });
  }

  const feedback = await prisma.feedback.create({
    data: {
      taskId,
      fromUserId: session.user.id,
      message: message.trim(),
    },
    include: {
      fromUser: { select: { id: true, name: true, role: true } },
    },
  });

  // Bildirim: göreve yorum geldi (görev sahibine)
  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { assignedToId: true, createdById: true, title: true },
    });
    if (task) {
      const notifyId = task.assignedToId ?? task.createdById;
      if (notifyId && notifyId !== session.user.id) {
        await (prisma as any).notification.create({
          data: {
            userId: notifyId,
            type: "FEEDBACK_RECEIVED",
            message: `"${task.title}" görevine yeni bir yorum eklendi.`,
            relatedId: taskId,
          },
        });
      }
    }
  } catch { /* bildirim hatası yorumu etkilemesin */ }

  return NextResponse.json(feedback, { status: 201 });
}
