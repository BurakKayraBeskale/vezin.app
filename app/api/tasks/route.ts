import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildTaskVisibilityWhereForUser } from "@/lib/task-visibility";
import { canAssignTaskInProject } from "@/lib/task-permissions";
import { isEligibleAssignee } from "@/lib/task-assignment";
import { projectDeptToUserDept } from "@/lib/access";
import { sendNotification, TaskNotif } from "@/lib/notifications";
import { computeNextOccurrence } from "@/lib/recurring";

/** body.departmentId proje-departman formatındaysa (örn. "YMM") kullanıcı-departman formatına çevirir. */
function normalizeDepartmentId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return projectDeptToUserDept(raw) ?? raw;
}

const taskInclude = {
  assignedTo: { select: { id: true, name: true, email: true } },
  assignees: { include: { user: { select: { id: true, name: true, email: true } } } }, // okunur ama artık yazılmaz
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
    department: (session.user as any).department as string ?? "",
    seniorityLevel: (session.user as any).seniorityLevel as number ?? 0,
  };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const visUser = sessionVisUser(session);
  const where = buildTaskVisibilityWhereForUser(visUser);

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

  // A BLOĞU: assignedToId tek kaynak — çoklu atama desteklenmiyor
  if (assigneeIds.length > 1) {
    return NextResponse.json({ error: "Birden fazla kişiye atama yapılamaz" }, { status: 400 });
  }

  if (!title?.trim()) return NextResponse.json({ error: "Başlık gerekli" }, { status: 400 });

  const visUser = sessionVisUser(session);
  const userId = visUser.id;

  const primaryAssignee = assigneeIds[0] ?? assignedToId ?? null;

  const assigner = await prisma.user.findUnique({
    where: { id: userId },
    select: { seniorityLevel: true, canViewAllProjects: true, role: true, email: true, department: true },
  });
  if (!assigner) return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });

  const assignerEligibility = {
    id: userId,
    role: assigner.role,
    seniorityLevel: assigner.seniorityLevel,
    canViewAllProjects: assigner.canViewAllProjects,
    email: assigner.email,
  };

  let taskDepartmentId: string | null = null;

  if (projectId) {
    // ── Proje görevi: proje otoritesi (canAssignTaskInProject) + hedef uygunluğu (isEligibleAssignee) ──
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, createdById: true, department: true },
    });
    if (!project) return NextResponse.json({ error: "Proje bulunamadı veya erişim yok" }, { status: 404 });

    const assignerArg = {
      id: userId,
      role: assigner.role,
      canViewAllProjects: assigner.canViewAllProjects,
      overseesDepartment: visUser.overseesDepartment,
      seniorityLevel: assigner.seniorityLevel,
      email: assigner.email,
    };

    // Proje otoritesi kontrolü (hedef olmadan): ADMIN/canViewAll geçer, diğerleri overseer/kurucu olmalı
    if (!canAssignTaskInProject(assignerArg, project)) {
      return NextResponse.json({ error: "Proje bulunamadı veya erişim yok" }, { status: 404 });
    }

    // Her atanan için tek doğru kaynaktan (isEligibleAssignee) hedef uygunluk kontrolü
    const idsToCheck = assigneeIds.length > 0 ? assigneeIds : (primaryAssignee ? [primaryAssignee] : []);
    for (const aid of idsToCheck) {
      if (aid === userId) continue; // self: uygunluk kontrolü atlanır
      const target = await prisma.user.findUnique({ where: { id: aid }, select: { id: true } });
      if (!target) return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
      if (!(await isEligibleAssignee(assignerEligibility, aid, { projectId }))) {
        return NextResponse.json({ error: "Bu kişiye atama yapamazsınız" }, { status: 403 });
      }
    }
  } else {
    // ── Proje dışı görev: departman + tek doğru kaynaktan (isEligibleAssignee) ──
    taskDepartmentId = normalizeDepartmentId(body.departmentId) || assigner.department || null;

    const idsToCheck = assigneeIds.length > 0 ? assigneeIds : (primaryAssignee ? [primaryAssignee] : []);
    for (const aid of idsToCheck) {
      if (aid === userId) continue; // self: uygunluk kontrolü atlanır
      const target = await prisma.user.findUnique({ where: { id: aid }, select: { id: true } });
      if (!target) return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
      if (!(await isEligibleAssignee(assignerEligibility, aid, { departmentId: taskDepartmentId ?? undefined }))) {
        return NextResponse.json({ error: "Bu kişiye atama yapamazsınız" }, { status: 403 });
      }
    }
  }

  // ── Atanan zorunlu ────────────────────────────────────────────────────
  if (!primaryAssignee) {
    return NextResponse.json({ error: "Atanan kişi zorunludur" }, { status: 400 });
  }

  // ── Alt-görev: üst görevi görebilmeyi kontrol et ───────────────────────
  if (parentTaskId) {
    const parentWhere = buildTaskVisibilityWhereForUser(visUser);
    const parent = await prisma.task.findFirst({
      where: { AND: [{ id: parentTaskId }, parentWhere as any] },
      select: { id: true },
    });
    if (!parent) return NextResponse.json({ error: "Üst görev bulunamadı veya erişim yok" }, { status: 404 });
  }

  // D BLOĞU: Tekrarlayan görev işaretliyse RecurringSeries oluştur ve bu ilk
  // occurrence'ı seriye bağla — üretim motoru (generate-occurrences) seriyi bekler.
  let recurringSeriesId: string | null = null;
  if (body.isRecurring && body.recurringType) {
    const now = new Date();
    const series = await prisma.recurringSeries.create({
      data: {
        recurringType: body.recurringType,
        recurringDay: body.recurringDay ?? null,
        startDate: now,
        endType: body.endType === "SPECIFIC_DATE" ? "SPECIFIC_DATE" : "INDEFINITE",
        endDate: body.endDate ? new Date(body.endDate) : null,
        nextOccurrenceAt: computeNextOccurrence(now, body.recurringType, body.recurringDay ?? null),
        title: title.trim(),
        description: description?.trim() || null,
        priority: priority || "MEDIUM",
        assignedToId: primaryAssignee,
        projectId: projectId || null,
        departmentId: taskDepartmentId,
        ownerId: userId,
      },
    });
    recurringSeriesId = series.id;
  }

  const task = await prisma.task.create({
    data: {
      title: title.trim(),
      description: description?.trim() || null,
      priority: priority || "MEDIUM",
      assignedToId: primaryAssignee,
      reviewOwnerId: userId,
      assignmentLevelSnapshot: assigner.seniorityLevel ?? null,
      departmentId: taskDepartmentId,
      dueDate: dueDate ? new Date(dueDate) : null,
      createdById: userId,
      isRecurring: body.isRecurring ?? false,
      recurringType: body.recurringType ?? null,
      recurringDay: body.recurringDay ?? null,
      nextOccurrence: body.nextOccurrence ? new Date(body.nextOccurrence) : null,
      recurringSeriesId,
      companyId: companyId || null,
      projectId: projectId || null,
      parentTaskId: parentTaskId || null,
    },
    include: taskInclude,
  });

  // D BLOĞU: Bildirim — atanan kişiye (spam önleme: yalnızca doğrudan ilişkili)
  if (primaryAssignee && primaryAssignee !== userId) {
    const notif = TaskNotif.taskAssigned(task.title, task.id);
    await sendNotification(primaryAssignee, notif.type, notif.message, notif.relatedId);
  }

  // D BLOĞU: Alt görev bildirimi — parent'ın atananına
  if (parentTaskId && task.parentTaskId) {
    const parent = await prisma.task.findUnique({
      where: { id: task.parentTaskId },
      select: { id: true, title: true, assignedToId: true },
    });
    if (parent?.assignedToId && parent.assignedToId !== userId && parent.assignedToId !== primaryAssignee) {
      await sendNotification(parent.assignedToId, "TASK_ASSIGNED", `"${task.title}" adlı yeni bir alt görev oluşturuldu.`, parent.id);
    }
  }

  const full = await prisma.task.findUnique({ where: { id: task.id }, include: taskInclude });
  return NextResponse.json(full ?? task, { status: 201 });
}
