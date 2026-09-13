import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { canAccessProjects, canManageProject, projectDeptToUserDept } from "@/lib/access";

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

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: {
      id: true, createdById: true, department: true, status: true,
      members: { select: { userId: true } },
    },
  });
  if (!project) return NextResponse.json({ error: "Proje bulunamadı" }, { status: 404 });

  // Arşivlenmiş/silinmiş projede üye yönetimi yapılamaz
  if (project.status === "ARCHIVED" || project.status === "DELETED") {
    return NextResponse.json({ error: "Arşivlenmiş veya silinmiş projede üye yönetimi yapılamaz" }, { status: 403 });
  }

  const isMember = project.members.some((m) => m.userId === userId);
  const userObj = {
    id: userId,
    role: userRole,
    department: userDept,
    seniorityLevel: userSeniorityLevel,
    canViewAllProjects,
    overseesDepartment,
  };

  if (!canManageProject(userObj, project, isMember)) {
    return NextResponse.json({ error: "Üye yönetimi yetkiniz yok" }, { status: 403 });
  }

  const body = await req.json();
  const addUserIds: string[] = Array.isArray(body.addUserIds) ? body.addUserIds.filter(Boolean) : [];
  const removeUserIds: string[] = Array.isArray(body.removeUserIds) ? body.removeUserIds.filter(Boolean) : [];

  // ── Ekleme ──────────────────────────────────────────────────────────────────
  if (addUserIds.length > 0) {
    // Departman filtresi: yalnızca aynı departmandan aktif kullanıcılar
    const targetDept = projectDeptToUserDept(project.department);
    if (targetDept !== null) {
      const wrongDeptUser = await prisma.user.findFirst({
        where: { id: { in: addUserIds }, NOT: { department: targetDept } },
        select: { id: true, name: true },
      });
      if (wrongDeptUser) {
        return NextResponse.json(
          { error: "Bu projeye sadece ilgili departman kadrosundan üye eklenebilir" },
          { status: 403 }
        );
      }
    }

    // Aktif kullanıcı kontrolü
    const inactiveUser = await prisma.user.findFirst({
      where: { id: { in: addUserIds }, NOT: { status: "ACTIVE" } },
      select: { id: true, name: true },
    });
    if (inactiveUser) {
      return NextResponse.json(
        { error: "Yalnızca aktif kullanıcılar proje üyesi yapılabilir" },
        { status: 403 }
      );
    }

    // SQLite: skipDuplicates desteklenmez — mevcut üyeleri filtrele
    const existing = await prisma.projectMember.findMany({
      where: { projectId: params.id, userId: { in: addUserIds } },
      select: { userId: true },
    });
    const existingSet = new Set(existing.map((e) => e.userId));
    const toAdd = addUserIds.filter((uid) => !existingSet.has(uid));
    if (toAdd.length > 0) {
      await prisma.projectMember.createMany({
        data: toAdd.map((uid) => ({ projectId: params.id, userId: uid, assignedBy: userId })),
      });
    }
  }

  // ── Çıkarma ─────────────────────────────────────────────────────────────────
  if (removeUserIds.length > 0) {
    // D BLOĞU: açık görev kontrolü genişletildi — kişiye atanmış VE kişinin review owner olduğu görevler
    for (const removeUserId of removeUserIds) {
      const [assignedCount, reviewOwnerCount] = await Promise.all([
        prisma.task.count({
          where: {
            projectId: params.id,
            assignedToId: removeUserId,
            status: { in: ["TODO", "IN_PROGRESS", "REVIEW"] },
            deletedAt: null,
          },
        }),
        prisma.task.count({
          where: {
            projectId: params.id,
            reviewOwnerId: removeUserId,
            assignedToId: { not: removeUserId }, // kendi üzerine olanlar zaten assignedCount'ta
            status: { in: ["TODO", "IN_PROGRESS", "REVIEW"] },
            deletedAt: null,
          },
        }),
      ]);

      if (assignedCount > 0 || reviewOwnerCount > 0) {
        const targetUser = await prisma.user.findUnique({
          where: { id: removeUserId },
          select: { name: true },
        });
        const name = targetUser?.name ?? "Bu kullanıcı";
        const parts: string[] = [];
        if (assignedCount > 0) parts.push(`${assignedCount} görev kullanıcının üzerinde`);
        if (reviewOwnerCount > 0) parts.push(`${reviewOwnerCount} açık görevin incelemesinden kullanıcı sorumludur`);
        return NextResponse.json(
          {
            error: `${name}'nın projede devam eden görev ilişkileri bulunmaktadır. ${parts.join(", ")}.`,
          },
          { status: 409 }
        );
      }
    }

    await prisma.projectMember.deleteMany({
      where: { projectId: params.id, userId: { in: removeUserIds } },
    });
  }

  const updated = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true, seniorityLevel: true, title: true } } },
        orderBy: { assignedAt: "asc" },
      },
    },
  });
  return NextResponse.json(updated);
}
