import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const taskInclude = {
  assignedTo: { select: { id: true, name: true, email: true } },
  assignees: { include: { user: { select: { id: true, name: true, email: true } } } },
  createdBy: { select: { id: true, name: true } },
  files: { include: { uploadedBy: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" as const } },
  feedbacks: { include: { fromUser: { select: { id: true, name: true, role: true } } }, orderBy: { createdAt: "asc" as const } },
  logs: { include: { user: { select: { id: true, name: true } } }, orderBy: { timestamp: "asc" as const } },
};

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const tasks = await prisma.task.findMany({
    include: taskInclude,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  // All authenticated users can create tasks (employees via templates, admins/managers directly)

  const body = await req.json();
  const { title, description, priority, assignedToId, dueDate, companyId } = body;
  const assigneeIds: string[] = Array.isArray(body.assigneeIds) ? body.assigneeIds.filter(Boolean) : [];

  if (!title?.trim()) return NextResponse.json({ error: "Başlık gerekli" }, { status: 400 });

  // Primary assignee = first in list (backward compat)
  const primaryAssignee = assigneeIds[0] ?? assignedToId ?? null;

  const task = await prisma.task.create({
    data: {
      title: title.trim(),
      description: description?.trim() || null,
      priority: priority || "MEDIUM",
      assignedToId: primaryAssignee,
      dueDate: dueDate ? new Date(dueDate) : null,
      createdById: session.user.id,
      isRecurring: body.isRecurring ?? false,
      recurringType: body.recurringType ?? null,
      recurringDay: body.recurringDay ?? null,
      nextOccurrence: body.nextOccurrence ? new Date(body.nextOccurrence) : null,
      companyId: companyId || null,
    },
    include: taskInclude,
  });

  // Sync TaskAssignee table
  const idsToAssign = assigneeIds.length > 0 ? assigneeIds : (primaryAssignee ? [primaryAssignee] : []);
  if (idsToAssign.length > 0) {
    await prisma.taskAssignee.createMany({
      data: idsToAssign.map((uid) => ({ taskId: task.id, userId: uid })),
    });
  }

  // Notify all assignees
  for (const uid of idsToAssign) {
    if (uid !== session.user.id) {
      try {
        await prisma.notification.create({
          data: {
            userId: uid,
            type: "TASK_ASSIGNED",
            message: `"${task.title}" görevi size atandı.`,
            relatedId: task.id,
          },
        });
      } catch { /* ignore */ }
    }
  }

  // Re-fetch with assignees populated
  const full = await prisma.task.findUnique({ where: { id: task.id }, include: taskInclude });
  return NextResponse.json(full ?? task, { status: 201 });
}
