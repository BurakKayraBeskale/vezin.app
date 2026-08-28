import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { getVisibleProjectIds, buildProjectVisibilityWhere } from "@/lib/task-visibility";
import { canCreateProject, canAccessProjects } from "@/lib/access";

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

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const user = getVisUser(token);
  const userDept = (token as any).department as string ?? "";
  if (!canAccessProjects({ role: user.role, department: userDept, canViewAllProjects: user.canViewAllProjects, overseesDepartment: user.overseesDepartment })) {
    return NextResponse.json({ error: "Proje bulunamadı" }, { status: 404 });
  }

  const projectIds = await getVisibleProjectIds(user);
  const visWhere = buildProjectVisibilityWhere(projectIds);

  const dept = new URL(req.url).searchParams.get("department");
  const finalWhere = dept && ["BAGIMSIZ_DENETIM", "VERGI"].includes(dept)
    ? { AND: [visWhere, { department: dept }] }
    : visWhere;

  const projects = await prisma.project.findMany({
    where: finalWhere as any,
    include: projectInclude,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const userId = token.id as string;
  const postRole = (token as any).role as string;
  const postDept = (token as any).department as string ?? "";
  const postCanView = (token as any).canViewAllProjects as boolean ?? false;
  const postOversees = (token as any).overseesDepartment as string | null ?? null;
  if (!canAccessProjects({ role: postRole, department: postDept, canViewAllProjects: postCanView, overseesDepartment: postOversees })) {
    return NextResponse.json({ error: "Proje bulunamadı" }, { status: 404 });
  }

  // Proje açma yetkisi: seniorityLevel >= 5 VEYA overseesDepartment != null VEYA ADMIN/canViewAllProjects
  const creator = await prisma.user.findUnique({
    where: { id: userId },
    select: { seniorityLevel: true, canViewAllProjects: true, role: true, overseesDepartment: true },
  });
  if (!creator) return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });

  const canCreate = creator.role === "ADMIN" || creator.canViewAllProjects || canCreateProject(creator);
  if (!canCreate) {
    return NextResponse.json(
      { error: "Proje oluşturmak için Manager 1 veya üstü kıdem gerekli (seviye ≥ 5)" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const { name, department, taxNumber, sector, startDate, notes, about, memberIds } = body;

  if (!name?.trim()) return NextResponse.json({ error: "Proje adı zorunlu" }, { status: 400 });
  if (!department || !["BAGIMSIZ_DENETIM", "VERGI"].includes(department)) {
    return NextResponse.json({ error: "Geçerli birim: BAGIMSIZ_DENETIM veya VERGI" }, { status: 400 });
  }

  const newMemberIds: string[] = Array.isArray(memberIds) ? memberIds.filter(Boolean) : [];
  const canAssignAll = creator.canViewAllProjects || creator.role === "ADMIN";

  // Kıdem kontrolü: sadece kendinden düşük kıdemliye üye eklenebilir
  if (!canAssignAll) {
    for (const mid of newMemberIds) {
      if (mid === userId) continue;
      const member = await prisma.user.findUnique({ where: { id: mid }, select: { seniorityLevel: true } });
      if (member && !(creator.seniorityLevel > member.seniorityLevel)) {
        return NextResponse.json(
          { error: "Sadece kendinizden düşük kıdemlilere üye ekleyebilirsiniz" },
          { status: 403 }
        );
      }
    }
  }

  const project = await prisma.project.create({
    data: {
      name: name.trim(),
      department,
      taxNumber: taxNumber?.trim() || null,
      sector: sector?.trim() || null,
      startDate: startDate ? new Date(startDate) : null,
      notes: notes?.trim() || null,
      about: about?.trim() || null,
      createdById: userId,
    },
  });

  // Kurucuyu + istenen üyeleri ekle (SQLite: skipDuplicates yok, Set ile tekilleştir)
  const allMemberIds = [...new Set([userId, ...newMemberIds])];
  await prisma.projectMember.createMany({
    data: allMemberIds.map((uid) => ({
      projectId: project.id,
      userId: uid,
      assignedBy: userId,
    })),
  });

  const full = await prisma.project.findUnique({ where: { id: project.id }, include: projectInclude });
  return NextResponse.json(full, { status: 201 });
}
