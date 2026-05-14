import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";

const taskInclude = {
  assignedTo: { select: { id: true, name: true, email: true } },
  assignees: { include: { user: { select: { id: true, name: true, email: true } } } },
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

    // Fetch current task before update
    const current = await prisma.task.findUnique({
      where: { id: params.id },
      select: { status: true, assignedToId: true },
    });
    if (!current) return NextResponse.json({ error: "Görev bulunamadı" }, { status: 404 });

    const allowed: Record<string, unknown> = {};
    if (body.status !== undefined) allowed.status = body.status;

    if (isAdmin) {
      if (body.title !== undefined) allowed.title = body.title;
      if (body.description !== undefined) allowed.description = body.description;
      if (body.priority !== undefined) allowed.priority = body.priority;
      if (body.dueDate !== undefined) allowed.dueDate = body.dueDate ? new Date(body.dueDate) : null;
      if (body.isRecurring !== undefined) allowed.isRecurring = body.isRecurring;
      if (body.recurringType !== undefined) allowed.recurringType = body.recurringType || null;
      if (body.recurringDay !== undefined) allowed.recurringDay = body.recurringDay ?? null;
      if (body.nextOccurrence !== undefined) allowed.nextOccurrence = body.nextOccurrence ? new Date(body.nextOccurrence) : null;

      // Multi-assignee: assigneeIds takes precedence; fall back to single assignedToId
      if (Array.isArray(body.assigneeIds)) {
        const ids: string[] = body.assigneeIds.filter(Boolean);
        allowed.assignedToId = ids[0] ?? null;
        // Sync TaskAssignee table
        await prisma.taskAssignee.deleteMany({ where: { taskId: params.id } });
        if (ids.length > 0) {
          await prisma.taskAssignee.createMany({
            data: ids.map((uid) => ({ taskId: params.id, userId: uid })),
          });
        }
        // Send notifications to newly assigned users
        for (const uid of ids) {
          if (uid !== userId) {
            try {
              await prisma.notification.create({
                data: {
                  userId: uid,
                  type: "TASK_ASSIGNED",
                  message: `"${(await prisma.task.findUnique({ where: { id: params.id }, select: { title: true } }))?.title}" görevi size atandı.`,
                  relatedId: params.id,
                },
              });
            } catch { /* ignore */ }
          }
        }
      } else if (body.assignedToId !== undefined) {
        // Legacy single-assign fallback
        const newId: string | null = body.assignedToId || null;
        allowed.assignedToId = newId;
        if (newId) {
          await prisma.taskAssignee.deleteMany({ where: { taskId: params.id } });
          await prisma.taskAssignee.create({ data: { taskId: params.id, userId: newId } });
        }
      }
    }

    const task = await prisma.task.update({
      where: { id: params.id },
      data: allowed,
      include: taskInclude,
    });

    // Log status changes
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
          data: { taskId: params.id, userId, action, fromStatus, toStatus, durationMinutes },
        });
      } catch {
        return NextResponse.json(task);
      }

      const taskWithLogs = await prisma.task.findUnique({
        where: { id: params.id },
        include: taskInclude,
      });
      return NextResponse.json(taskWithLogs ?? task);
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
