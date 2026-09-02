import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { getVisibleProjectIds, buildProjectVisibilityWhere } from "@/lib/task-visibility";
import { canAccessProjects, canDeleteProject, canEditProject } from "@/lib/access";

const projectInclude = {
  createdBy: { select: { id: true, name: true } },
  members: {
    include: {
      user: { select: { id: true, name: true, email: true, seniorityLevel: true, title: true } },
    },
    orderBy: { assignedAt: "asc" as const },
  },
  _count: { select: { tasks: true } },
};

function getVisUser(token: any) {
  return {
    id: token.id as string,
    role: (token as any).role as string,
    department: (token as any).department as string ?? "",
    canViewAllProjects: (token as any).canViewAllProjects as boolean ?? false,
    overseesDepartment: (token as any).overseesDepartment as string | null ?? null,
  };
}

function checkProjectAccess(user: ReturnType<typeof getVisUser>): boolean {
  return canAccessProjects({ role: user.role, department: user.department, canViewAllProjects: user.canViewAllProjects, overseesDepartment: user.overseesDepartment });
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
    select: { id: true, createdById: true, department: true },
  });
  if (!existing) return NextResponse.json({ error: "Proje bulunamadı" }, { status: 404 });

  // Düzenleme yetkisi: canDeleteProject ile aynı kural
  if (!canEditProject(user, existing)) {
    return NextResponse.json({ error: "Proje bulunamadı" }, { status: 404 });
  }

  const body = await req.json();
  // department değiştirilemez — üyelik ve görünürlük tutarsızlığını önler
  const updated = await prisma.project.update({
    where: { id: params.id },
    data: {
      ...(body.name !== undefined && { name: body.name.trim() }),
      ...(body.taxNumber !== undefined && { taxNumber: body.taxNumber?.trim() || null }),
      ...(body.sector !== undefined && { sector: body.sector?.trim() || null }),
      ...(body.startDate !== undefined && { startDate: body.startDate ? new Date(body.startDate) : null }),
      ...(body.notes !== undefined && { notes: body.notes?.trim() || null }),
      ...(body.about !== undefined && { about: body.about?.trim() || null }),
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

  // createdById'yi de çekiyoruz — kurucu silme yetkisine ihtiyaç var
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { id: true, department: true, createdById: true, _count: { select: { tasks: true } } },
  });
  if (!project) return NextResponse.json({ error: "Proje bulunamadı" }, { status: 404 });

  // Yetki: ADMIN | kendi departman gözetmeni | projeyi oluşturan kişi
  if (!canDeleteProject(user, project)) {
    return NextResponse.json({ error: "Proje bulunamadı" }, { status: 404 });
  }

  // Görev cascade kontrolü: görev varsa cascade=true zorunlu
  const taskCount = project._count.tasks;
  const cascade = new URL(req.url).searchParams.get("cascade") === "true";
  if (taskCount > 0 && !cascade) {
    return NextResponse.json(
      { error: "Proje altında görevler var, silmek için cascade=true gönderin", taskCount },
      { status: 409 }
    );
  }

  await prisma.project.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
