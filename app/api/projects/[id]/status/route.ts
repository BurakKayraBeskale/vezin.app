/**
 * POST /api/projects/[id]/status
 *
 * Proje yaşam döngüsü yönetimi.
 *
 * Body: { action: "complete" | "reopen" | "archive" | "restore" | "delete" }
 *
 * Geçerli geçişler:
 *   complete : ACTIVE  → DONE     (tüm görevler DONE olmalı)
 *   reopen   : DONE    → ACTIVE
 *   archive  : DONE    → ARCHIVED
 *   restore  : ARCHIVED → DONE
 *   delete   : ARCHIVED → soft-delete (deletedAt set, status=DELETED)
 */
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { getVisibleProjectIds, buildProjectVisibilityWhere } from "@/lib/task-visibility";
import { canAccessProjects, canManageProject } from "@/lib/access";

type Action = "complete" | "reopen" | "archive" | "restore" | "delete";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const userId = token.id as string;
  const userRole = (token.role ?? "EMPLOYEE") as string;
  const userDept = (token.department ?? "") as string;
  const userSeniorityLevel = (token.seniorityLevel ?? 0) as number;
  const canViewAllProjects = (token.canViewAllProjects ?? false) as boolean;
  const overseesDepartment = (token.overseesDepartment ?? null) as string | null;

  if (!canAccessProjects({ role: userRole, department: userDept, canViewAllProjects, overseesDepartment })) {
    return NextResponse.json({ error: "Proje bulunamadı" }, { status: 404 });
  }

  const visUser = {
    id: userId,
    role: userRole,
    department: userDept,
    seniorityLevel: userSeniorityLevel,
    canViewAllProjects,
    overseesDepartment,
  };

  const projectIds = await getVisibleProjectIds(visUser);
  const visWhere = buildProjectVisibilityWhere(projectIds);

  const project = await prisma.project.findFirst({
    where: { AND: [{ id: params.id }, visWhere as any] },
    select: {
      id: true,
      department: true,
      createdById: true,
      status: true,
      members: { select: { userId: true } },
    },
  });
  if (!project) return NextResponse.json({ error: "Proje bulunamadı" }, { status: 404 });

  const isMember = project.members.some((m) => m.userId === userId);
  if (!canManageProject(visUser, project, isMember)) {
    return NextResponse.json({ error: "Proje durumu değiştirme yetkiniz yok" }, { status: 403 });
  }

  const body = await req.json();
  const action = body.action as Action;

  const currentStatus = project.status;

  switch (action) {
    // ── AKTİF → BİTMİŞ ──────────────────────────────────────────────────────
    case "complete": {
      if (currentStatus !== "ACTIVE") {
        return NextResponse.json(
          { error: "Yalnızca aktif projeler tamamlanabilir" },
          { status: 409 }
        );
      }
      // Açık görev kontrolü
      const openTaskCount = await prisma.task.count({
        where: {
          projectId: params.id,
          status: { in: ["TODO", "IN_PROGRESS", "REVIEW"] },
        },
      });
      if (openTaskCount > 0) {
        return NextResponse.json(
          {
            error: `Bu projede ${openTaskCount} tamamlanmamış görev bulunmaktadır. Projeyi tamamlamadan önce tüm görevlerin tamamlanması gerekmektedir.`,
          },
          { status: 409 }
        );
      }
      await prisma.project.update({
        where: { id: params.id },
        data: { status: "DONE" },
      });
      return NextResponse.json({ ok: true, status: "DONE" });
    }

    // ── BİTMİŞ → AKTİF ──────────────────────────────────────────────────────
    case "reopen": {
      if (currentStatus !== "DONE") {
        return NextResponse.json(
          { error: "Yalnızca tamamlanmış projeler yeniden açılabilir" },
          { status: 409 }
        );
      }
      await prisma.project.update({
        where: { id: params.id },
        data: { status: "ACTIVE" },
      });
      return NextResponse.json({ ok: true, status: "ACTIVE" });
    }

    // ── BİTMİŞ → ARŞİVLENMİŞ ────────────────────────────────────────────────
    case "archive": {
      if (currentStatus !== "DONE") {
        return NextResponse.json(
          { error: "Yalnızca tamamlanmış projeler arşivlenebilir. Önce projeyi tamamlayın." },
          { status: 409 }
        );
      }
      await prisma.project.update({
        where: { id: params.id },
        data: { status: "ARCHIVED" },
      });
      return NextResponse.json({ ok: true, status: "ARCHIVED" });
    }

    // ── ARŞİVLENMİŞ → BİTMİŞ ────────────────────────────────────────────────
    case "restore": {
      if (currentStatus !== "ARCHIVED") {
        return NextResponse.json(
          { error: "Yalnızca arşivlenmiş projeler geri yüklenebilir" },
          { status: 409 }
        );
      }
      await prisma.project.update({
        where: { id: params.id },
        data: { status: "DONE" },
      });
      return NextResponse.json({ ok: true, status: "DONE" });
    }

    // ── ARŞİVLENMİŞ → SİLİNMİŞ (soft) ──────────────────────────────────────
    case "delete": {
      if (currentStatus !== "ARCHIVED") {
        return NextResponse.json(
          { error: "Yalnızca arşivlenmiş projeler silinebilir" },
          { status: 409 }
        );
      }
      await prisma.project.update({
        where: { id: params.id },
        data: { status: "DELETED", deletedAt: new Date() },
      });
      return NextResponse.json({ ok: true, status: "DELETED" });
    }

    default:
      return NextResponse.json(
        { error: "Geçersiz aksiyon. Geçerli: complete, reopen, archive, restore, delete" },
        { status: 400 }
      );
  }
}
