import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { computeCompletedAt } from "@/lib/task-status";
import { canManageTask, canReviewTask, WorkflowUser } from "@/lib/task-permissions";
import { isEligibleAssignee, AssignerUser } from "@/lib/task-assignment";
import { sendNotification, TaskNotif } from "@/lib/notifications";

const taskInclude = {
  assignedTo: { select: { id: true, name: true, email: true } },
  assignees: { include: { user: { select: { id: true, name: true, email: true } } } },
  createdBy: { select: { id: true, name: true } },
  files: { include: { uploadedBy: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" as const } },
  feedbacks: { include: { fromUser: { select: { id: true, name: true, role: true } } }, orderBy: { createdAt: "asc" as const } },
  logs: { include: { user: { select: { id: true, name: true } } }, orderBy: { timestamp: "asc" as const } },
};

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  if (token.role !== "ADMIN") return NextResponse.json({ error: "Sadece admin" }, { status: 403 });

  const body = await req.json();
  const { ids, action, assignedToId, status } = body;
  const userId = token.id as string;

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "Görev seçilmedi" }, { status: 400 });
  }

  const wfUser: WorkflowUser = {
    id: userId,
    role: token.role as string,
    seniorityLevel: ((token as any).seniorityLevel as number) ?? 0,
    canViewAllProjects: ((token as any).canViewAllProjects as boolean) ?? false,
    overseesDepartment: ((token as any).overseesDepartment as string | null) ?? null,
    department: ((token as any).department as string) ?? "",
  };

  // Görevleri tek seferde çek — merkezi kural motorunun ihtiyaç duyduğu alanlarla
  const tasks = await prisma.task.findMany({
    where: { id: { in: ids }, deletedAt: null },
    select: {
      id: true, title: true, status: true, assignedToId: true,
      reviewOwnerId: true, projectId: true, departmentId: true,
    },
  });

  if (tasks.length !== ids.length) {
    return NextResponse.json({ error: "Bazı görevler bulunamadı" }, { status: 404 });
  }

  if (action === "assign") {
    // ── Atanan zorunlu — boş/null atama kabul edilmez ────────────────────────
    if (!assignedToId) {
      return NextResponse.json({ error: "Atanan kişi zorunludur" }, { status: 400 });
    }

    const assignerRecord = await prisma.user.findUnique({
      where: { id: userId },
      select: { seniorityLevel: true, canViewAllProjects: true, role: true, email: true },
    });
    if (!assignerRecord) return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });

    const assignerEligibility: AssignerUser = {
      id: userId,
      role: assignerRecord.role,
      seniorityLevel: assignerRecord.seniorityLevel,
      canViewAllProjects: assignerRecord.canViewAllProjects,
      email: assignerRecord.email,
    };

    // ── Her görev için: düzenleme yetkisi + hedefin uygunluğu — hepsi geçmezse tamamen reddet ──
    for (const t of tasks) {
      if (!canManageTask(wfUser, t)) {
        return NextResponse.json(
          { error: `Görev düzenlenemez (tamamlanmış olabilir veya atanan kişisiniz): ${t.id}` },
          { status: 403 }
        );
      }
      if (assignedToId === userId) continue; // self: uygunluk kontrolü atlanır (tekil uçla tutarlı)
      const scope = t.projectId ? { projectId: t.projectId } : { departmentId: t.departmentId };
      const eligible = await isEligibleAssignee(assignerEligibility, assignedToId, scope);
      if (!eligible) {
        return NextResponse.json(
          { error: "Seçilen kişi görevlerden en az biri için uygun atanan değil" },
          { status: 403 }
        );
      }
    }

    // ── Doğrulama geçti — tamamını uygula ────────────────────────────────────
    for (const t of tasks) {
      const data: Record<string, unknown> = { assignedToId };
      if (assignedToId !== t.assignedToId) {
        // C+D BLOĞU deseniyle tutarlı: yeniden atamada status→TODO, reviewOwnerId→atayan
        data.status = "TODO";
        data.reviewOwnerId = userId;
        data.completedAt = null;
      }
      await prisma.task.update({ where: { id: t.id }, data });

      if (assignedToId !== t.assignedToId && assignedToId !== userId) {
        const notif = TaskNotif.taskAssigned(t.title, t.id);
        await sendNotification(assignedToId, notif.type, notif.message, notif.relatedId);
      }
    }
  } else if (action === "status") {
    if (!status) return NextResponse.json({ error: "Durum gerekli" }, { status: 400 });

    // ── REVIEW/DONE'a giriş yalnızca özel aksiyonlarla (submit_review/approve) yapılabilir ──
    if (status === "REVIEW") {
      return NextResponse.json(
        { error: "İncelemeye gönderme toplu işlemden yapılamaz; ilgili görevden 'İncelemeye Gönder' kullanın" },
        { status: 400 }
      );
    }
    if (status === "DONE") {
      return NextResponse.json(
        { error: "Onaylama toplu işlemden yapılamaz; ilgili görevden 'Onayla' kullanın" },
        { status: 400 }
      );
    }

    for (const t of tasks) {
      if (t.status === "DONE") {
        return NextResponse.json(
          { error: "Tamamlanmış görev yeniden açmak için 'Yeniden Aç' aksiyonu kullanılmalı" },
          { status: 400 }
        );
      }
      if (t.status === "REVIEW") {
        if (!canReviewTask(wfUser, t)) {
          return NextResponse.json({ error: `İnceleme yetkisi yok: ${t.id}` }, { status: 403 });
        }
        return NextResponse.json(
          { error: "İncelemedeki görevin durumu toplu işlemden değiştirilemez; 'Revizyon İste' kullanın" },
          { status: 400 }
        );
      }
      if (!canManageTask(wfUser, t)) {
        return NextResponse.json({ error: `Görev üzerinde işlem yetkiniz yok: ${t.id}` }, { status: 403 });
      }
    }

    await prisma.task.updateMany({
      where: { id: { in: tasks.map((t) => t.id) } },
      data: { status, completedAt: computeCompletedAt(status) },
    });
  } else {
    return NextResponse.json({ error: "Geçersiz işlem" }, { status: 400 });
  }

  const updated = await prisma.task.findMany({
    where: { id: { in: ids } },
    include: taskInclude,
  });

  return NextResponse.json(updated);
}
