import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { getVisibleProjectIds, buildProjectVisibilityWhere } from "@/lib/task-visibility";
import { canAccessProjects, canManageProject } from "@/lib/access";

const projectInclude = {
  createdBy: { select: { id: true, name: true } },
  members: {
    include: {
      user: { select: { id: true, name: true, email: true, seniorityLevel: true, title: true } },
    },
    orderBy: { assignedAt: "asc" as const },
  },
};

function getVisUser(token: any) {
  return {
    id: token.id as string,
    role: (token.role ?? "EMPLOYEE") as string,
    department: (token.department ?? "") as string,
    seniorityLevel: (token.seniorityLevel ?? 0) as number,
    canViewAllProjects: (token.canViewAllProjects ?? false) as boolean,
    overseesDepartment: (token.overseesDepartment ?? null) as string | null,
  };
}

function checkProjectAccess(user: ReturnType<typeof getVisUser>): boolean {
  return canAccessProjects(user);
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const user = getVisUser(token);
  if (!checkProjectAccess(user)) return NextResponse.json({ error: "Proje bulunamadı" }, { status: 404 });

  const projectIds = await getVisibleProjectIds(user);
  const visWhere = buildProjectVisibilityWhere(projectIds);

  const project = await prisma.project.findFirst({
    where: { AND: [{ id: params.id }, visWhere as any] },
    include: projectInclude,
  });
  if (!project) return NextResponse.json({ error: "Proje bulunamadı" }, { status: 404 });
  return NextResponse.json(project);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const user = getVisUser(token);
  if (!checkProjectAccess(user)) return NextResponse.json({ error: "Proje bulunamadı" }, { status: 404 });

  const projectIds = await getVisibleProjectIds(user);
  const visWhere = buildProjectVisibilityWhere(projectIds);

  const existing = await prisma.project.findFirst({
    where: { AND: [{ id: params.id }, visWhere as any] },
    select: {
      id: true, createdById: true, department: true, status: true,
      startDate: true, endDate: true, name: true,
      members: { select: { userId: true } },
    },
  });
  if (!existing) return NextResponse.json({ error: "Proje bulunamadı" }, { status: 404 });

  // Arşivlenmiş veya silinmiş proje düzenlenemez
  if (existing.status === "ARCHIVED" || existing.status === "DELETED") {
    return NextResponse.json({ error: "Arşivlenmiş veya silinmiş proje düzenlenemez" }, { status: 403 });
  }

  const isMember = existing.members.some((m) => m.userId === user.id);
  if (!canManageProject(user, existing, isMember)) {
    return NextResponse.json({ error: "Proje düzenleme yetkiniz yok" }, { status: 403 });
  }

  const body = await req.json();

  // department değiştirilemez
  if (body.department !== undefined) {
    return NextResponse.json({ error: "Proje departmanı değiştirilemez" }, { status: 400 });
  }
  // status buradan değiştirilemez — /api/projects/[id]/status kullanılmalı
  if (body.status !== undefined) {
    return NextResponse.json({ error: "Proje durumu bu endpoint üzerinden değiştirilemez" }, { status: 400 });
  }

  const patchStart = body.startDate !== undefined ? body.startDate : existing.startDate;
  const patchEnd   = body.endDate   !== undefined ? body.endDate   : existing.endDate;
  if (patchStart && patchEnd && new Date(patchEnd) < new Date(patchStart)) {
    return NextResponse.json({ error: "Bitiş tarihi başlangıç tarihinden önce olamaz" }, { status: 400 });
  }

  // Proje adı değişiyorsa duplicate kontrolü
  if (body.name !== undefined && body.name.trim().toLowerCase() !== existing.name.toLowerCase()) {
    const sameNameProjects = await prisma.project.findMany({
      where: { department: existing.department, deletedAt: null, NOT: { id: params.id } },
      select: { name: true },
    });
    const isDuplicate = sameNameProjects.some(
      (p) => p.name.trim().toLowerCase() === body.name.trim().toLowerCase()
    );
    if (isDuplicate) {
      return NextResponse.json(
        { error: "Bu departmanda aynı isimde bir proje zaten mevcut" },
        { status: 409 }
      );
    }
  }

  const updated = await prisma.project.update({
    where: { id: params.id },
    data: {
      ...(body.name      !== undefined && { name:      body.name.trim() }),
      ...(body.startDate !== undefined && { startDate: body.startDate ? new Date(body.startDate) : null }),
      ...(body.endDate   !== undefined && { endDate:   body.endDate   ? new Date(body.endDate)   : null }),
      ...(body.about     !== undefined && { about:     body.about?.trim() || null }),
    },
    include: projectInclude,
  });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const user = getVisUser(token);
  if (!checkProjectAccess(user)) return NextResponse.json({ error: "Proje bulunamadı" }, { status: 404 });

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: {
      id: true, department: true, createdById: true, status: true,
      members: { select: { userId: true } },
    },
  });
  if (!project) return NextResponse.json({ error: "Proje bulunamadı" }, { status: 404 });

  const isMember = project.members.some((m) => m.userId === user.id);
  if (!canManageProject(user, project, isMember)) {
    return NextResponse.json({ error: "Proje silme yetkiniz yok" }, { status: 403 });
  }

  // Sadece ARŞİVLENMİŞ proje silinebilir (lifecycle kuralı)
  if (project.status !== "ARCHIVED") {
    return NextResponse.json(
      { error: "Yalnızca arşivlenmiş projeler silinebilir. Önce projeyi arşivleyin." },
      { status: 409 }
    );
  }

  // Soft delete
  await prisma.project.update({
    where: { id: params.id },
    data: { status: "DELETED", deletedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
