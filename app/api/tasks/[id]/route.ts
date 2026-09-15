import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { buildTaskVisibilityWhereForUser, filterRelatedTaskVisibility } from "@/lib/task-visibility";
import { computeCompletedAt } from "@/lib/task-status";
import {
  canDeleteTask,
  canManageTask,
  canReviewTask,
  canSubmitForReview,
  canTakeOverReview,
} from "@/lib/task-permissions";
import { isEligibleAssignee } from "@/lib/task-assignment";
import { sendNotification, sendNotificationToMany, TaskNotif } from "@/lib/notifications";
import { computeRetentionUntil } from "@/lib/recurring";

const taskInclude = {
  assignedTo: { select: { id: true, name: true, email: true, seniorityLevel: true } },
  assignees: { include: { user: { select: { id: true, name: true, email: true } } } },
  createdBy: { select: { id: true, name: true } },
  project: { select: { id: true, name: true, department: true, createdById: true } },
  parent: { select: { id: true, title: true } },
  children: { select: { id: true, title: true, status: true } },
  files: { include: { uploadedBy: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" as const } },
  feedbacks: { include: { fromUser: { select: { id: true, name: true, role: true } } }, orderBy: { createdAt: "asc" as const } },
  logs: { include: { user: { select: { id: true, name: true } } }, orderBy: { timestamp: "asc" as const } },
  reviewRounds: {
    include: {
      submittedBy: { select: { id: true, name: true } },
      reviewedBy: { select: { id: true, name: true } },
    },
    orderBy: { roundNumber: "asc" as const },
  },
  sources: {
    include: { addedBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" as const },
  },
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
    department: (token as any).department as string ?? "",
    seniorityLevel: (token as any).seniorityLevel as number ?? 0,
    isAdmin: (token as any).role === "ADMIN",
  };
}

function makeVisUser(fields: ReturnType<typeof sessionFields>) {
  return {
    id: fields.userId,
    role: fields.userRole,
    canViewAllProjects: fields.canViewAllProjects,
    overseesDepartment: fields.overseesDepartment,
    department: fields.department,
    seniorityLevel: fields.seniorityLevel,
  };
}

function makeWorkflowUser(fields: ReturnType<typeof sessionFields>) {
  return {
    id: fields.userId,
    role: fields.userRole,
    canViewAllProjects: fields.canViewAllProjects,
    overseesDepartment: fields.overseesDepartment,
    department: fields.department,
    seniorityLevel: fields.seniorityLevel,
  };
}

/** parent/children'daki görünmeyen ilişkili görevleri süzüp yanıtı döner. */
async function respondTask(fields: ReturnType<typeof sessionFields>, task: NonNullable<Awaited<ReturnType<typeof prisma.task.findFirst>>>) {
  const [sanitized] = await filterRelatedTaskVisibility([task as any], makeVisUser(fields));
  return NextResponse.json(sanitized);
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const token = await getSession(req);
  if (!token) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const fields = sessionFields(token);
  const taskWhere = buildTaskVisibilityWhereForUser(makeVisUser(fields));

  const task = await prisma.task.findFirst({
    where: { AND: [{ id: params.id }, taskWhere as any] },
    include: taskInclude,
  });

  // 404 (not 403) — 403 "böyle bir görev var" bilgisini sızdırır
  if (!task) return NextResponse.json({ error: "Görev bulunamadı" }, { status: 404 });
  return respondTask(fields, task);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = await getSession(req);
    if (!token) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

    const body = await req.json();
    const fields = sessionFields(token);
    const { userId, isAdmin } = fields;
    const canManage = isAdmin || fields.canViewAllProjects || fields.overseesDepartment != null;
    const wfUser = makeWorkflowUser(fields);

    // Mevcut görevi çek — görünürlük zorla
    const where = buildTaskVisibilityWhereForUser(makeVisUser(fields));
    const current = await prisma.task.findFirst({
      where: { AND: [{ id: params.id }, where as any] },
      select: {
        status: true,
        assignedToId: true,
        createdById: true,
        reviewOwnerId: true,
        completedAt: true,
        parentTaskId: true,
        projectId: true,
        departmentId: true,
      },
    });
    if (!current) return NextResponse.json({ error: "Görev bulunamadı" }, { status: 404 });

    // ── TAMAMLANMIŞ (DONE) GÖREV DÜZENLEME YASAĞI ────────────────────────────
    // Yalnızca özel aksiyonlara (reopen, take_over_review) izin ver
    const allowedOnDone = ["reopen", "take_over_review"];
    if (current.status === "DONE" && body.action && !allowedOnDone.includes(body.action)) {
      return NextResponse.json({ error: "Tamamlanmış görev düzenlenemez" }, { status: 403 });
    }
    if (current.status === "DONE" && !body.action) {
      // Herhangi bir alan güncellemesi → 403
      const editFields = ["title", "description", "priority", "dueDate", "status",
        "assigneeIds", "assignedToId", "parentTaskId", "isRecurring"];
      if (editFields.some((f) => body[f] !== undefined)) {
        return NextResponse.json({ error: "Tamamlanmış görev düzenlenemez" }, { status: 403 });
      }
    }

    // ── ÖZEL AKSİYONLAR ──────────────────────────────────────────────────────

    if (body.action === "submit_review") {
      // IN_PROGRESS → REVIEW: yalnızca atanan kişi, submissionNote zorunlu
      if (!canSubmitForReview(wfUser, { assignedToId: current.assignedToId })) {
        return NextResponse.json({ error: "Yalnızca atanan kişi incelemeye gönderebilir" }, { status: 403 });
      }
      if (current.status !== "IN_PROGRESS") {
        return NextResponse.json({ error: "Görev devam ediyor durumunda olmalı" }, { status: 400 });
      }
      if (!body.submissionNote?.trim()) {
        return NextResponse.json({ error: "Gönderim notu zorunludur" }, { status: 400 });
      }

      // Açık alt görev kontrolü — herhangi bir torun DONE değilse 409
      const openChildren = await prisma.task.findFirst({
        where: { parentTaskId: params.id, status: { not: "DONE" }, deletedAt: null },
        select: { id: true },
      });
      if (openChildren) {
        return NextResponse.json(
          { error: "Tüm alt görevler tamamlanmadan incelemeye gönderilemez" },
          { status: 409 }
        );
      }

      // Mevcut tur sayısını bul
      const roundCount = await prisma.taskReviewRound.count({ where: { taskId: params.id } });
      await prisma.taskReviewRound.create({
        data: {
          taskId: params.id,
          roundNumber: roundCount + 1,
          submittedById: userId,
          submissionNote: body.submissionNote.trim(),
        },
      });

      const updated = await prisma.task.update({
        where: { id: params.id },
        data: { status: "REVIEW" },
        include: taskInclude,
      });
      await prisma.taskLog.create({
        data: { taskId: params.id, userId, action: "STATUS_CHANGED", fromStatus: "IN_PROGRESS", toStatus: "REVIEW" },
      });
      // Bildirim: reviewOwner'a inceleme talebi (atanan kişi ≠ reviewOwner ise)
      if (current.reviewOwnerId && current.reviewOwnerId !== userId) {
        const notif = TaskNotif.submittedForReview(updated.title, params.id);
        await sendNotification(current.reviewOwnerId, notif.type, notif.message, notif.relatedId);
      }
      const withLogs = await prisma.task.findUnique({ where: { id: params.id }, include: taskInclude });
      return respondTask(fields, withLogs ?? updated);
    }

    if (body.action === "approve") {
      // Atanan kişi kendi görevini tamamlayamaz — önce kontrol et
      if (current.assignedToId === userId) {
        return NextResponse.json({ error: "Kendi görevinizi onaylayamazsınız" }, { status: 403 });
      }
      // REVIEW → DONE: yalnızca reviewOwner veya yönetici
      if (!canReviewTask(wfUser, { reviewOwnerId: current.reviewOwnerId, assignedToId: current.assignedToId })) {
        return NextResponse.json({ error: "İnceleme yetkisi yok" }, { status: 403 });
      }
      if (current.status !== "REVIEW") {
        return NextResponse.json({ error: "Görev incelemede durumunda olmalı" }, { status: 400 });
      }

      // En son turu güncelle
      const lastRound = await prisma.taskReviewRound.findFirst({
        where: { taskId: params.id },
        orderBy: { roundNumber: "desc" },
      });
      if (lastRound) {
        await prisma.taskReviewRound.update({
          where: { id: lastRound.id },
          data: { reviewedById: userId, reviewAction: "APPROVED", reviewedAt: new Date() },
        });
      }

      const completedAt = new Date();
      const updated = await prisma.task.update({
        where: { id: params.id },
        data: { status: "DONE", completedAt },
        include: taskInclude,
      });
      await prisma.taskLog.create({
        data: { taskId: params.id, userId, action: "COMPLETED", fromStatus: "REVIEW", toStatus: "DONE" },
      });

      // D BLOĞU: Dosya retention — completedAt + 1 yıl
      const retentionUntil = computeRetentionUntil(completedAt);
      await prisma.file.updateMany({
        where: { taskId: params.id, purgedAt: null },
        data: { retentionUntil },
      });
      await prisma.taskAttachment.updateMany({
        where: { taskId: params.id, type: "FILE", purgedAt: null },
        data: { retentionUntil },
      });

      // D BLOĞU: Alt görev bildirimleri — parent atananına
      if (current.parentTaskId) {
        const parent = await prisma.task.findUnique({
          where: { id: current.parentTaskId },
          select: { id: true, title: true, assignedToId: true },
        });
        if (parent?.assignedToId) {
          const subtaskNotif = TaskNotif.subtaskCompleted(updated.title, parent.id);
          await sendNotification(parent.assignedToId, subtaskNotif.type, subtaskNotif.message, subtaskNotif.relatedId);

          // Tüm kardeş görevler tamamlandı mı?
          const openSiblings = await prisma.task.count({
            where: {
              parentTaskId: current.parentTaskId,
              id: { not: params.id },
              status: { not: "DONE" },
              deletedAt: null,
            },
          });
          if (openSiblings === 0) {
            const allDoneNotif = TaskNotif.allSubtasksDone(parent.title, parent.id);
            await sendNotification(parent.assignedToId, allDoneNotif.type, allDoneNotif.message, allDoneNotif.relatedId);
          }
        }
      }

      const withLogs = await prisma.task.findUnique({ where: { id: params.id }, include: taskInclude });
      return respondTask(fields, withLogs ?? updated);
    }

    if (body.action === "request_revision") {
      // REVIEW → TODO: yalnızca reviewOwner veya yönetici, geri bildirim zorunlu
      if (!canReviewTask(wfUser, { reviewOwnerId: current.reviewOwnerId, assignedToId: current.assignedToId })) {
        return NextResponse.json({ error: "İnceleme yetkisi yok" }, { status: 403 });
      }
      // Atanan kişi kendi görevini kendine iade edemez
      if (current.assignedToId === userId) {
        return NextResponse.json({ error: "Atanan kişi kendi görevini geri gönderemez" }, { status: 403 });
      }
      if (current.status !== "REVIEW") {
        return NextResponse.json({ error: "Görev incelemede durumunda olmalı" }, { status: 400 });
      }
      if (!body.reviewNote?.trim()) {
        return NextResponse.json({ error: "Revizyon notu zorunludur" }, { status: 400 });
      }

      // En son turu güncelle
      const lastRound = await prisma.taskReviewRound.findFirst({
        where: { taskId: params.id },
        orderBy: { roundNumber: "desc" },
      });
      if (lastRound) {
        await prisma.taskReviewRound.update({
          where: { id: lastRound.id },
          data: {
            reviewedById: userId,
            reviewAction: "REVISION_REQUESTED",
            reviewNote: body.reviewNote.trim(),
            reviewedAt: new Date(),
          },
        });
      }

      const updated = await prisma.task.update({
        where: { id: params.id },
        data: { status: "TODO" },
        include: taskInclude,
      });
      await prisma.taskLog.create({
        data: { taskId: params.id, userId, action: "STATUS_CHANGED", fromStatus: "REVIEW", toStatus: "TODO" },
      });
      // Bildirim: atanana revizyon talebi
      if (current.assignedToId && current.assignedToId !== userId) {
        const notif = TaskNotif.revisionRequested(updated.title, params.id);
        await sendNotification(current.assignedToId, notif.type, notif.message, notif.relatedId);
      }
      const withLogs = await prisma.task.findUnique({ where: { id: params.id }, include: taskInclude });
      return respondTask(fields, withLogs ?? updated);
    }

    if (body.action === "reopen") {
      // DONE → TODO: reopenReason zorunlu
      if (!canManage && current.reviewOwnerId !== userId) {
        return NextResponse.json({ error: "Yeniden açma yetkisi yok" }, { status: 403 });
      }
      if (current.status !== "DONE") {
        return NextResponse.json({ error: "Görev tamamlanmış durumunda olmalı" }, { status: 400 });
      }
      if (!body.reopenReason?.trim()) {
        return NextResponse.json({ error: "Yeniden açma sebebi zorunludur" }, { status: 400 });
      }

      const updated = await prisma.task.update({
        where: { id: params.id },
        data: { status: "TODO", completedAt: null, reopenReason: body.reopenReason.trim() },
        include: taskInclude,
      });
      await prisma.taskLog.create({
        data: { taskId: params.id, userId, action: "STATUS_CHANGED", fromStatus: "DONE", toStatus: "TODO" },
      });

      // D BLOĞU: Retention sıfırla — geri sayım iptal edilir
      await prisma.file.updateMany({
        where: { taskId: params.id, purgedAt: null },
        data: { retentionUntil: null },
      });
      await prisma.taskAttachment.updateMany({
        where: { taskId: params.id, type: "FILE", purgedAt: null },
        data: { retentionUntil: null },
      });

      // Bildirim: atanana görev yeniden açıldı
      if (current.assignedToId && current.assignedToId !== userId) {
        const notif = TaskNotif.taskReopened(updated.title, params.id);
        await sendNotification(current.assignedToId, notif.type, notif.message, notif.relatedId);
      }
      const withLogs = await prisma.task.findUnique({ where: { id: params.id }, include: taskInclude });
      return respondTask(fields, withLogs ?? updated);
    }

    if (body.action === "take_over_review") {
      // reviewOwnerId'yi devralan kullanıcıya ata
      // reviewOwner'ın kıdemini öğren
      const currentOwnerRecord = current.reviewOwnerId
        ? await prisma.user.findUnique({
            where: { id: current.reviewOwnerId },
            select: { seniorityLevel: true },
          })
        : null;
      if (
        !canTakeOverReview(wfUser, {
          reviewOwnerId: current.reviewOwnerId,
          reviewOwnerSeniorityLevel: currentOwnerRecord?.seniorityLevel ?? null,
        })
      ) {
        return NextResponse.json({ error: "Devir alma yetkisi yok" }, { status: 403 });
      }

      const oldReviewOwnerId = current.reviewOwnerId;
      const updated = await prisma.task.update({
        where: { id: params.id },
        data: { reviewOwnerId: userId },
        include: taskInclude,
      });
      await prisma.taskLog.create({
        data: { taskId: params.id, userId, action: "UPDATED", fromStatus: null, toStatus: null },
      });
      // Bildirim: eski reviewOwner'a devir bildirimi
      if (oldReviewOwnerId && oldReviewOwnerId !== userId) {
        const lostNotif = TaskNotif.reviewOwnerLost(updated.title, params.id);
        await sendNotification(oldReviewOwnerId, lostNotif.type, lostNotif.message, lostNotif.relatedId);
      }
      const withLogs = await prisma.task.findUnique({ where: { id: params.id }, include: taskInclude });
      return respondTask(fields, withLogs ?? updated);
    }

    // ── STANDART DURUM DEĞİŞİKLİĞİ ───────────────────────────────────────────
    const allowed: Record<string, unknown> = {};

    if (body.status !== undefined) {
      const newStatus = body.status as string;
      const fromStatus = current.status;

      // IN_PROGRESS→REVIEW yalnızca action:"submit_review" ile yapılabilir —
      // genel PATCH'ten gelirse kim olursa olsun reddet (submissionNote/alt görev
      // kontrolü/inceleme turu kaydı bu yoldan atlanamaz)
      if (fromStatus === "IN_PROGRESS" && newStatus === "REVIEW") {
        return NextResponse.json(
          { error: "İncelemeye göndermek için 'İncelemeye Gönder' butonunu kullanın" },
          { status: 400 }
        );
      }

      // REVIEW'dan çıkış (IN_PROGRESS veya TODO) yalnızca action:"request_revision" ile
      // yapılabilir — genel PATCH'ten reddet
      if (fromStatus === "REVIEW" && (newStatus === "IN_PROGRESS" || newStatus === "TODO")) {
        return NextResponse.json(
          { error: "Revizyon istemek için 'Revizyon İste' aksiyonunu kullanın" },
          { status: 400 }
        );
      }

      // REVIEW→DONE yalnızca action:"approve" ile yapılabilir — genel PATCH'ten
      // gelirse canReviewTask'ı olsa bile reddet (onay turu kaydı/bildirim/retention
      // bu yoldan atlanamaz)
      if (fromStatus === "REVIEW" && newStatus === "DONE") {
        return NextResponse.json(
          { error: "Onaylamak için 'Onayla' butonunu kullanın" },
          { status: 400 }
        );
      }

      // DONE→TODO için reopen aksiyonu gerekli
      if (fromStatus === "DONE" && newStatus === "TODO") {
        return NextResponse.json(
          { error: "Yeniden açmak için 'Yeniden Aç' aksiyonunu kullanın" },
          { status: 400 }
        );
      }

      allowed.status = newStatus;
      allowed.completedAt = computeCompletedAt(newStatus);
    }

    const scope = current.projectId
      ? { projectId: current.projectId }
      : { departmentId: current.departmentId };

    if (canManageTask(wfUser, current)) {
      if (body.title !== undefined) allowed.title = body.title;
      if (body.description !== undefined) allowed.description = body.description;
      if (body.priority !== undefined) allowed.priority = body.priority;
      if (body.dueDate !== undefined) allowed.dueDate = body.dueDate ? new Date(body.dueDate) : null;
      if (body.isRecurring !== undefined) allowed.isRecurring = body.isRecurring;
      if (body.recurringType !== undefined) allowed.recurringType = body.recurringType || null;
      if (body.recurringDay !== undefined) allowed.recurringDay = body.recurringDay ?? null;
      if (body.nextOccurrence !== undefined) allowed.nextOccurrence = body.nextOccurrence ? new Date(body.nextOccurrence) : null;
      if (body.parentTaskId !== undefined) allowed.parentTaskId = body.parentTaskId || null;

      // A BLOĞU: assignedToId tek kaynak — TaskAssignee artık yazılmıyor
      if (Array.isArray(body.assigneeIds)) {
        const newIds: string[] = body.assigneeIds.filter(Boolean);

        if (newIds.length > 1) {
          return NextResponse.json({ error: "Birden fazla kişiye atama yapılamaz" }, { status: 400 });
        }

        const assigner = await prisma.user.findUnique({
          where: { id: userId },
          select: { seniorityLevel: true, canViewAllProjects: true, role: true, email: true },
        });

        for (const aid of newIds) {
          if (aid === userId) continue; // self: uygunluk kontrolü atlanır
          if (assigner && !(await isEligibleAssignee(
            { id: userId, role: assigner.role, seniorityLevel: assigner.seniorityLevel, canViewAllProjects: assigner.canViewAllProjects, email: assigner.email },
            aid,
            scope
          ))) {
            return NextResponse.json({ error: "Bu kişiye atama yapamazsınız" }, { status: 403 });
          }
        }

        const newAssignee = newIds[0] ?? null;
        allowed.assignedToId = newAssignee;
        // C+D BLOĞU: Yeniden atamada status → TODO, reviewOwnerId → atayan
        if (newAssignee && newAssignee !== current.assignedToId) {
          allowed.status = "TODO";
          allowed.reviewOwnerId = userId;
          // Bildirim: eski atanana görev alındı
          if (current.assignedToId && current.assignedToId !== userId) {
            const t = await prisma.task.findUnique({ where: { id: params.id }, select: { title: true } });
            if (t) {
              const takenNotif = TaskNotif.taskTaken(t.title, params.id);
              await sendNotification(current.assignedToId, takenNotif.type, takenNotif.message, takenNotif.relatedId);
            }
          }
        }
        // Bildirim: yeni atanana görev atandı
        if (newAssignee && newAssignee !== userId && newAssignee !== current.assignedToId) {
          const t = await prisma.task.findUnique({ where: { id: params.id }, select: { title: true } });
          if (t) {
            const assignedNotif = TaskNotif.taskAssigned(t.title, params.id);
            await sendNotification(newAssignee, assignedNotif.type, assignedNotif.message, assignedNotif.relatedId);
          }
        }
      } else if (body.assignedToId !== undefined) {
        const newId: string | null = body.assignedToId || null;
        if (newId && newId !== userId) {
          const assigner = await prisma.user.findUnique({
            where: { id: userId },
            select: { seniorityLevel: true, canViewAllProjects: true, role: true, email: true },
          });
          if (assigner && !(await isEligibleAssignee(
            { id: userId, role: assigner.role, seniorityLevel: assigner.seniorityLevel, canViewAllProjects: assigner.canViewAllProjects, email: assigner.email },
            newId,
            scope
          ))) {
            return NextResponse.json({ error: "Bu kişiye atama yapamazsınız" }, { status: 403 });
          }
        }
        allowed.assignedToId = newId;
        // C+D BLOĞU: Yeniden atamada status → TODO, reviewOwnerId → atayan
        if (newId && newId !== current.assignedToId) {
          allowed.status = "TODO";
          allowed.reviewOwnerId = userId;
          // Bildirim: eski atanana görev alındı
          if (current.assignedToId && current.assignedToId !== userId) {
            const t = await prisma.task.findUnique({ where: { id: params.id }, select: { title: true } });
            if (t) {
              const takenNotif = TaskNotif.taskTaken(t.title, params.id);
              await sendNotification(current.assignedToId, takenNotif.type, takenNotif.message, takenNotif.relatedId);
            }
          }
          // Bildirim: yeni atanana görev atandı
          if (newId && newId !== userId) {
            const t = await prisma.task.findUnique({ where: { id: params.id }, select: { title: true } });
            if (t) {
              const assignedNotif = TaskNotif.taskAssigned(t.title, params.id);
              await sendNotification(newId, assignedNotif.type, assignedNotif.message, assignedNotif.relatedId);
            }
          }
        }
      }
    }

    if (Object.keys(allowed).length === 0) {
      return NextResponse.json({ error: "Güncellenecek alan yok" }, { status: 400 });
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
        return respondTask(fields, task);
      }

      const taskWithLogs = await prisma.task.findUnique({ where: { id: params.id }, include: taskInclude });
      return respondTask(fields, taskWithLogs ?? task);
    }

    return respondTask(fields, task);
  } catch (err) {
    console.error("PATCH /api/tasks/[id] error:", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const token = await getSession(req);
  if (!token) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const fields = sessionFields(token);
  const visUser = makeVisUser(fields);

  // Önce görünürlük filtresi — kullanıcının göremediği görevi silemez
  const taskWhere = buildTaskVisibilityWhereForUser(visUser);
  const task = await prisma.task.findFirst({
    where: { AND: [{ id: params.id }, taskWhere as any] },
    select: {
      id: true,
      status: true,
      createdById: true,
      assignedToId: true,
      project: { select: { department: true, createdById: true } },
    },
  });

  if (!task) return NextResponse.json({ error: "Görev bulunamadı" }, { status: 404 });

  // DONE görev: yalnızca Admin silebilir
  if (task.status === "DONE" && !fields.isAdmin) {
    return NextResponse.json({ error: "Görev bulunamadı" }, { status: 404 });
  }

  // Tamamlanmamış alt görev kontrolü
  const openChild = await prisma.task.findFirst({
    where: { parentTaskId: params.id, status: { not: "DONE" }, deletedAt: null },
    select: { id: true },
  });
  if (openChild) {
    return NextResponse.json(
      { error: "Tamamlanmamış alt görevler var; önce onları kapatın" },
      { status: 409 }
    );
  }

  // Silme yetkisi kontrolü — canDeleteTask tek doğru kaynak
  const allowed = canDeleteTask(
    { id: fields.userId, role: fields.userRole, canViewAllProjects: fields.canViewAllProjects, overseesDepartment: fields.overseesDepartment },
    { createdById: task.createdById, assignedToId: task.assignedToId },
    task.project ?? null
  );

  if (!allowed) return NextResponse.json({ error: "Görev bulunamadı" }, { status: 404 });

  // C BLOĞU: Yumuşak silme (soft-delete)
  await prisma.task.update({
    where: { id: params.id },
    data: { deletedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
