import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";

const taskInclude = {
  assignedTo: { select: { id: true, name: true, email: true } },
  createdBy: { select: { id: true, name: true } },
  files: { include: { uploadedBy: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" as const } },
  feedbacks: { include: { fromUser: { select: { id: true, name: true, role: true } } }, orderBy: { createdAt: "asc" as const } },
  logs: { include: { user: { select: { id: true, name: true } } }, orderBy: { timestamp: "asc" as const } },
};

async function getSession(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  return token;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const token = await getSession(req);
  if (!token) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const task = await prisma.task.findUnique({
    where: { id: params.id },
    include: taskInclude,
  });

  if (!task) return NextResponse.json({ error: "Görev bulunamadı" }, { status: 404 });
  return NextResponse.json(task);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = await getSession(req);
    if (!token) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

    const body = await req.json();
    const isAdmin = token.role === "ADMIN";
    const userId = token.id as string;

    // Fetch current status before update (needed for log)
    const current = await prisma.task.findUnique({
      where: { id: params.id },
      select: { status: true },
    });
    if (!current) return NextResponse.json({ error: "Görev bulunamadı" }, { status: 404 });

    const allowed: Record<string, unknown> = {};
    if (body.status !== undefined) allowed.status = body.status;

    const prevAssignedToId = current
      ? await prisma.task.findUnique({ where: { id: params.id }, select: { assignedToId: true } }).then((t) => t?.assignedToId)
      : null;

    if (isAdmin) {
      if (body.title !== undefined) allowed.title = body.title;
      if (body.description !== undefined) allowed.description = body.description;
      if (body.priority !== undefined) allowed.priority = body.priority;
      if (body.assignedToId !== undefined) allowed.assignedToId = body.assignedToId || null;
      if (body.dueDate !== undefined) allowed.dueDate = body.dueDate ? new Date(body.dueDate) : null;
      if (body.isRecurring !== undefined) allowed.isRecurring = body.isRecurring;
      if (body.recurringType !== undefined) allowed.recurringType = body.recurringType || null;
      if (body.recurringDay !== undefined) allowed.recurringDay = body.recurringDay ?? null;
      if (body.nextOccurrence !== undefined) allowed.nextOccurrence = body.nextOccurrence ? new Date(body.nextOccurrence) : null;
    }

    const task = await prisma.task.update({
      where: { id: params.id },
      data: allowed,
      include: taskInclude,
    });

    // Log status changes — failure here must NOT roll back the status update
    if (body.status !== undefined && body.status !== current.status) {
      const fromStatus = current.status;
      const toStatus = body.status as string;

      let action = "STATUS_CHANGED";
      let durationMinutes: number | null = null;

      if (toStatus === "IN_PROGRESS") {
        action = "STARTED";
      } else if (toStatus === "DONE") {
        action = "COMPLETED";
        const startLog = await prisma.taskLog.findFirst({
          where: { taskId: params.id, action: "STARTED" },
          orderBy: { timestamp: "desc" },
        });
        if (startLog) {
          durationMinutes = Math.round((Date.now() - startLog.timestamp.getTime()) / 60000);
        }
      }

      try {
        await prisma.taskLog.create({
          data: {
            taskId: params.id,
            userId,
            action,
            fromStatus,
            toStatus,
            durationMinutes,
          },
        });
      } catch {
        // Log kaydı başarısız olsa bile status güncellemesi geçerliydi — görevi döndür
        return NextResponse.json(task);
      }

      // Re-fetch with updated logs
      const taskWithLogs = await prisma.task.findUnique({
        where: { id: params.id },
        include: taskInclude,
      });
      return NextResponse.json(taskWithLogs ?? task);
    }

    // Bildirim: atanan kişi değiştiyse
    const newAssignedToId = (allowed as any).assignedToId;
    if (
      newAssignedToId !== undefined &&
      newAssignedToId !== prevAssignedToId &&
      newAssignedToId &&
      newAssignedToId !== userId
    ) {
      try {
        await (prisma as any).notification.create({
          data: {
            userId: newAssignedToId,
            type: "TASK_ASSIGNED",
            message: `"${task.title}" görevi size atandı.`,
            relatedId: task.id,
          },
        });
      } catch { /* bildirim hatası görevi etkilemesin */ }
    }

    return NextResponse.json(task);
  } catch (err) {
    console.error("PATCH /api/tasks/[id] error:", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const token = await getSession(req);
  if (!token) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  if (token.role !== "ADMIN") return NextResponse.json({ error: "Sadece admin" }, { status: 403 });

  await prisma.task.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
