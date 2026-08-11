import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { getVisibleProjectIds, buildTaskVisibilityWhere } from "@/lib/task-visibility";

const taskInclude = {
  assignedTo: { select: { id: true, name: true, email: true } },
  assignees: { include: { user: { select: { id: true, name: true, email: true } } } },
  createdBy: { select: { id: true, name: true } },
  parent: { select: { id: true, title: true } },
  children: { select: { id: true, title: true, status: true } },
  files: { include: { uploadedBy: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" as const } },
  feedbacks: { include: { fromUser: { select: { id: true, name: true, role: true } } }, orderBy: { createdAt: "asc" as const } },
  logs: { include: { user: { select: { id: true, name: true } } }, orderBy: { timestamp: "asc" as const } },
};

async function getSession(req: NextRequest) {
  return getToken({ req, secret: process.env.NEXTAUTH_SECRET });
}

function sessionFields(token: NonNullable<Awaited<ReturnType<typeof getSession>>>) {
  return {
    userId: token.id as string,
    userRole: (token as any).role as string,
    canViewAllTasks: (token as any).canViewAllTasks as boolean ?? false,
    canViewAllProjects: (token as any).canViewAllProjects as boolean ?? false,
    overseesDepartment: (token as any).overseesDepartment as string | null ?? null,
    isAdmin: (token as any).role === "ADMIN",
  };
}

function makeVisUser(fields: ReturnType<typeof sessionFields>) {
  return {
    id: fields.userId,
    role: fields.userRole,
    canViewAllProjects: fields.canViewAllProjects,
    overseesDepartment: fields.overseesDepartment,
  };
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const token = await getSession(req);
  if (!token) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const fields = sessionFields(token);

  const projectIds = await getVisibleProjectIds(makeVisUser(fields));
  const taskWhere = buildTaskVisibilityWhere(projectIds);

  const task = await prisma.task.findFirst({
    where: { AND: [{ id: params.id }, taskWhere as any] },
    include: taskInclude,
  });

  // 404 (not 403) — 403 "böyle bir görev var" bilgisini sızdırır
  if (!task) return NextResponse.json({ error: "Görev bulunamadı" }, { status: 404 });
  return NextResponse.json(task);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = await getSession(req);
    if (!token) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

    const body = await req.json();
    const fields = sessionFields(token);
    const { userId, isAdmin } = fields;
    const canManage = isAdmin || fields.canViewAllProjects || fields.overseesDepartment != null;

    // Mevcut görevi çek — görünürlük zorla
    const projectIds = await getVisibleProjectIds(makeVisUser(fields));
    const where = buildTaskVisibilityWhere(projectIds);
    const current = await prisma.task.findFirst({
      where: { AND: [{ id: params.id }, where as any] },
      select: { status: true, assignedToId: true },
    });
    if (!current) return NextResponse.json({ error: "Görev bulunamadı" }, { status: 404 });

    const allowed: Record<string, unknown> = {};
    if (body.status !== undefined) allowed.status = body.status;

    if (canManage) {
      if (body.title !== undefined) allowed.title = body.title;
      if (body.description !== undefined) allowed.description = body.description;
      if (body.priority !== undefined) allowed.priority = body.priority;
      if (body.dueDate !== undefined) allowed.dueDate = body.dueDate ? new Date(body.dueDate) : null;
      if (body.isRecurring !== undefined) allowed.isRecurring = body.isRecurring;
      if (body.recurringType !== undefined) allowed.recurringType = body.recurringType || null;
      if (body.recurringDay !== undefined) allowed.recurringDay = body.recurringDay ?? null;
      if (body.nextOccurrence !== undefined) allowed.nextOccurrence = body.nextOccurrence ? new Date(body.nextOccurrence) : null;
      if (body.parentTaskId !== undefined) allowed.parentTaskId = body.parentTaskId || null;

      // Çoklu atanan — assigneeIds öncelikli, sonra tek assignedToId
      if (Array.isArray(body.assigneeIds)) {
        const newIds: string[] = body.assigneeIds.filter(Boolean);

        // Server-side atama yetkisi kontrolü
        const assigner = await prisma.user.findUnique({
          where: { id: userId },
          select: { seniorityLevel: true, canViewAllProjects: true, role: true },
        });
        const assignerCanAssignAll = assigner ? (assigner.canViewAllProjects || assigner.role === "ADMIN") : false;

        if (!assignerCanAssignAll) {
          for (const aid of newIds) {
            if (aid === userId) continue;
            const assignee = await prisma.user.findUnique({ where: { id: aid }, select: { seniorityLevel: true } });
            if (assigner && assignee && !(assigner.seniorityLevel > assignee.seniorityLevel)) {
              return NextResponse.json({ error: "Bu kişiye atama yapamazsınız (kıdem yetersiz)" }, { status: 403 });
            }
          }
        }

        allowed.assignedToId = newIds[0] ?? null;
        await prisma.taskAssignee.deleteMany({ where: { taskId: params.id } });
        if (newIds.length > 0) {
          await prisma.taskAssignee.createMany({
            data: newIds.map((uid) => ({ taskId: params.id, userId: uid })),
          });
        }
        for (const uid of newIds) {
          if (uid !== userId) {
            try {
              const t = await prisma.task.findUnique({ where: { id: params.id }, select: { title: true } });
              await prisma.notification.create({
                data: {
                  userId: uid,
                  type: "TASK_ASSIGNED",
                  message: `"${t?.title}" görevi size atandı.`,
                  relatedId: params.id,
                },
              });
            } catch { /* ignore */ }
          }
        }
      } else if (body.assignedToId !== undefined) {
        const newId: string | null = body.assignedToId || null;
        if (newId && newId !== userId) {
          // Server-side kıdem kontrolü
          const [assigner, assignee] = await Promise.all([
            prisma.user.findUnique({ where: { id: userId }, select: { seniorityLevel: true, canViewAllProjects: true, role: true } }),
            prisma.user.findUnique({ where: { id: newId }, select: { seniorityLevel: true } }),
          ]);
          if (assigner && assignee) {
            const assignerCanAssignAll = assigner.canViewAllProjects || assigner.role === "ADMIN";
            if (!assignerCanAssignAll && !(assigner.seniorityLevel > assignee.seniorityLevel)) {
              return NextResponse.json({ error: "Bu kişiye atama yapamazsınız (kıdem yetersiz)" }, { status: 403 });
            }
          }
        }
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

    // Durum değişikliği logu
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

      const taskWithLogs = await prisma.task.findUnique({ where: { id: params.id }, include: taskInclude });
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

  const { isAdmin, canViewAllTasks } = sessionFields(token);
  if (!isAdmin && !canViewAllTasks) {
    return NextResponse.json({ error: "Sadece admin" }, { status: 403 });
  }

  await prisma.task.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
