import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { getVisibleProjectIds, buildProjectVisibilityWhere } from "@/lib/task-visibility";

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
    canViewAllProjects: (token as any).canViewAllProjects as boolean ?? false,
    overseesDepartment: (token as any).overseesDepartment as string | null ?? null,
  };
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const user = getVisUser(token);
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
  const projectIds = await getVisibleProjectIds(user);
  const visWhere = buildProjectVisibilityWhere(projectIds);

  const existing = await prisma.project.findFirst({
    where: { AND: [{ id: params.id }, visWhere as any] },
    select: { id: true, createdById: true },
  });
  if (!existing) return NextResponse.json({ error: "Proje bulunamadı" }, { status: 404 });

  // Düzenleme: kurucu, gözetmen veya admin
  const canEdit =
    user.role === "ADMIN" ||
    user.canViewAllProjects ||
    user.overseesDepartment != null ||
    existing.createdById === user.id;
  if (!canEdit) return NextResponse.json({ error: "Düzenleme yetkiniz yok" }, { status: 403 });

  const body = await req.json();
  const updated = await prisma.project.update({
    where: { id: params.id },
    data: {
      ...(body.name !== undefined && { name: body.name.trim() }),
      ...(body.department !== undefined && { department: body.department }),
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

  const userRole = (token as any).role as string;
  const overseesDepartment = (token as any).overseesDepartment as string | null ?? null;
  const isAdmin = userRole === "ADMIN";

  // Sadece ADMIN veya departman gözetmeni silebilir
  if (!isAdmin && overseesDepartment == null) {
    return NextResponse.json({ error: "Proje bulunamadı" }, { status: 404 });
  }

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { id: true, department: true, _count: { select: { tasks: true } } },
  });
  if (!project) return NextResponse.json({ error: "Proje bulunamadı" }, { status: 404 });

  // Gözetmen yalnızca kendi departmanını silebilir
  if (!isAdmin && project.department !== overseesDepartment) {
    return NextResponse.json({ error: "Proje bulunamadı" }, { status: 404 });
  }

  // Görev cascade kontrolü: görev varsa cascade=true zorunlu
  const taskCount = project._count.tasks;
  const cascade = req.nextUrl.searchParams.get("cascade") === "true";
  if (taskCount > 0 && !cascade) {
    return NextResponse.json(
      { error: "Proje altında görevler var, silmek için cascade=true gönderin", taskCount },
      { status: 409 }
    );
  }

  await prisma.project.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
