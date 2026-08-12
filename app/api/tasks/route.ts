import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getVisibleProjectIds, buildTaskVisibilityWhere } from "@/lib/task-visibility";

const taskInclude = {
  assignedTo: { select: { id: true, name: true, email: true } },
  assignees: { include: { user: { select: { id: true, name: true, email: true } } } },
  createdBy: { select: { id: true, name: true } },
  parent: { select: { id: true, title: true } },
  children: { select: { id: true, title: true, status: true } },
  project: { select: { id: true, name: true, department: true } },
  files: { include: { uploadedBy: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" as const } },
  feedbacks: { include: { fromUser: { select: { id: true, name: true, role: true } } }, orderBy: { createdAt: "asc" as const } },
  logs: { include: { user: { select: { id: true, name: true } } }, orderBy: { timestamp: "asc" as const } },
};

function sessionVisUser(session: any) {
  return {
    id: (session.user as any).id as string,
    role: (session.user as any).role as string,
    canViewAllProjects: (session.user as any).canViewAllProjects as boolean ?? false,
    overseesDepartment: (session.user as any).overseesDepartment as string | null ?? null,
  };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const visUser = sessionVisUser(session);
  const projectIds = await getVisibleProjectIds(visUser);
  const where = buildTaskVisibilityWhere(projectIds);

  const tasks = await prisma.task.findMany({
    where: where as any,
    include: taskInclude,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const body = await req.json();
  const { title, description, priority, assignedToId, dueDate, projectId, companyId, parentTaskId } = body;
  const assigneeIds: string[] = Array.isArray(body.assigneeIds) ? body.assigneeIds.filter(Boolean) : [];

  if (!title?.trim()) return NextResponse.json({ error: "Başlık gerekli" }, { status: 400 });

  const visUser = sessionVisUser(session);
  const userId = visUser.id;
  const userRole = visUser.role;

  const primaryAssignee = assigneeIds[0] ?? assignedToId ?? null;

  // ── Atama yetkisi kontrolü ──────────────────────────────────────────────
  if (primaryAssignee && primaryAssignee !== userId) {
    const [assigner, assignee] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { seniorityLevel: true, canViewAllProjects: true, role: true } }),
      prisma.user.findUnique({ where: { id: primaryAssignee }, select: { seniorityLevel: true } }),
    ]);
    if (!assigner || !assignee) return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
    const assignerCanAll = assigner.canViewAllProjects || assigner.role === "ADMIN";
    if (!assignerCanAll && !(assigner.seniorityLevel > assignee.seniorityLevel)) {
      return NextResponse.json({ error: "Bu kişiye atama yapamazsınız (kıdem yetersiz)" }, { status: 403 });
    }
  }

  if (assigneeIds.length > 1) {
    const assigner = await prisma.user.findUnique({ where: { id: userId }, select: { seniorityLevel: true, canViewAllProjects: true, role: true } });
    const assignerCanAll = assigner ? (assigner.canViewAllProjects || assigner.role === "ADMIN") : false;
    if (!assignerCanAll && assigner) {
      for (const aid of assigneeIds) {
        if (aid === userId) continue;
        const assignee = await prisma.user.findUnique({ where: { id: aid }, select: { seniorityLevel: true } });
        if (assignee && !(assigner.seniorityLevel > assignee.seniorityLevel)) {
          return NextResponse.json({ error: "Bu kişiye atama yapamazsınız (kıdem yetersiz)" }, { status: 403 });
        }
      }
    }
  }

  // ── Proje erişim kontrolü ─────────────────────────────────────────────
  if (projectId) {
    const projectIds = await getVisibleProjectIds(visUser);
    const visWhere = buildTaskVisibilityWhere(projectIds);
    // Proje görünürlük: projeye erişim varsa görev eklenebilir
    const project = await prisma.project.findFirst({
      where: { AND: [{ id: projectId }, projectIds === null ? {} : { id: { in: projectIds } }] },
      select: { id: true },
    });
    if (!project) return NextResponse.json({ error: "Proje bulunamadı veya erişim yok" }, { status: 404 });
  }

  // ── Alt-görev: üst görevi görebilmeyi kontrol et ───────────────────────
  if (parentTaskId) {
    const projectIds = await getVisibleProjectIds(visUser);
    const parentWhere = buildTaskVisibilityWhere(projectIds);
    const parent = await prisma.task.findFirst({
      where: { AND: [{ id: parentTaskId }, parentWhere as any] },
      select: { id: true },
    });
    if (!parent) return NextResponse.json({ error: "Üst görev bulunamadı veya erişim yok" }, { status: 404 });
  }

  const task = await prisma.task.create({
    data: {
      title: title.trim(),
      description: description?.trim() || null,
      priority: priority || "MEDIUM",
      assignedToId: primaryAssignee,
      dueDate: dueDate ? new Date(dueDate) : null,
      createdById: userId,
      isRecurring: body.isRecurring ?? false,
      recurringType: body.recurringType ?? null,
      recurringDay: body.recurringDay ?? null,
      nextOccurrence: body.nextOccurrence ? new Date(body.nextOccurrence) : null,
      companyId: companyId || null,
      projectId: projectId || null,
      parentTaskId: parentTaskId || null,
    },
    include: taskInclude,
  });

  const idsToAssign = assigneeIds.length > 0 ? assigneeIds : (primaryAssignee ? [primaryAssignee] : []);
  // SQLite: skipDuplicates desteklenmez — task yeni oluşturulduğu için mükerrer olamaz
  if (idsToAssign.length > 0) {
    await prisma.taskAssignee.createMany({
      data: [...new Set(idsToAssign)].map((uid) => ({ taskId: task.id, userId: uid })),
    });
  }

  for (const uid of idsToAssign) {
    if (uid !== userId) {
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

  const full = await prisma.task.findUnique({ where: { id: task.id }, include: taskInclude });
  return NextResponse.json(full ?? task, { status: 201 });
}
