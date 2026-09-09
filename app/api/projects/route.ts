import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { getVisibleProjectIds, buildProjectVisibilityWhere } from "@/lib/task-visibility";
import { canCreateProject, canAccessProjects, projectDeptToUserDept, userDeptToProjectDept } from "@/lib/access";

const VALID_DEPARTMENTS = ["OUTSOURCE", "BAGIMSIZ_DENETIM", "MUHASEBE", "YMM"] as const;

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

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const user = getVisUser(token);
  if (!canAccessProjects(user)) {
    return NextResponse.json({ error: "Proje bulunamadı" }, { status: 404 });
  }

  const projectIds = await getVisibleProjectIds(user);
  const visWhere = buildProjectVisibilityWhere(projectIds);

  const params = new URL(req.url).searchParams;
  const deptFilter = params.get("department");
  const statusFilter = params.get("status"); // "ACTIVE" | "DONE" | "ARCHIVED" | "ALL"

  // Departman filtresi — sadece geçerli değerlere izin ver
  const deptWhere = deptFilter && (VALID_DEPARTMENTS as readonly string[]).includes(deptFilter)
    ? { department: deptFilter }
    : {};

  // Durum filtresi — varsayılan: aktif projeler (silinmişler hiç gösterilmez)
  let statusWhere: object = { status: "ACTIVE" };
  if (statusFilter === "DONE") statusWhere = { status: "DONE" };
  else if (statusFilter === "ARCHIVED") statusWhere = { status: "ARCHIVED" };
  else if (statusFilter === "ALL") statusWhere = { status: { not: "DELETED" } };
  // else default: ACTIVE

  const finalWhere = {
    AND: [visWhere, deptWhere, statusWhere],
  };

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

  const user = getVisUser(token);
  if (!canAccessProjects(user)) {
    return NextResponse.json({ error: "Proje bulunamadı" }, { status: 404 });
  }

  const creator = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, seniorityLevel: true, canViewAllProjects: true, role: true, department: true },
  });
  if (!creator) return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });

  if (!canCreateProject({ seniorityLevel: creator.seniorityLevel, role: creator.role })) {
    return NextResponse.json(
      { error: "Proje oluşturmak için Manager 1 veya üstü kıdem gerekli" },
      { status: 403 }
    );
  }

  const body = await req.json();
  let { name, department, startDate, endDate, about, memberIds } = body;

  if (!name?.trim()) return NextResponse.json({ error: "Proje adı zorunlu" }, { status: 400 });

  // Admin departman seçer; standart kullanıcı kendi departmanı otomatik atanır
  const isAdminOrGlobal = creator.role === "ADMIN" || creator.canViewAllProjects;
  if (!isAdminOrGlobal) {
    // Standart kullanıcı: departman kendi departmanından türetilir
    const autoDept = userDeptToProjectDept(creator.department);
    if (!autoDept) {
      return NextResponse.json({ error: "Departmanınız proje oluşturmaya uygun değil" }, { status: 403 });
    }
    department = autoDept;
  }

  if (!department || !(VALID_DEPARTMENTS as readonly string[]).includes(department)) {
    return NextResponse.json(
      { error: `Geçerli departmanlar: ${VALID_DEPARTMENTS.join(", ")}` },
      { status: 400 }
    );
  }

  if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
    return NextResponse.json({ error: "Bitiş tarihi başlangıç tarihinden önce olamaz" }, { status: 400 });
  }

  // Aynı departmanda aynı isimle proje kontrolü (case-insensitive, trim)
  // SQLite: LIKE case-insensitive değil; uygulama seviyesinde filtrele
  const normalizedName = name.trim().toLowerCase();
  const sameNameProjects = await prisma.project.findMany({
    where: { department, deletedAt: null },
    select: { id: true, name: true },
  });
  const isDuplicate = sameNameProjects.some(
    (p) => p.name.trim().toLowerCase() === normalizedName
  );
  if (isDuplicate) {
    return NextResponse.json(
      { error: "Bu departmanda aynı isimde bir proje zaten mevcut" },
      { status: 409 }
    );
  }

  const newMemberIds: string[] = Array.isArray(memberIds) ? memberIds.filter(Boolean) : [];

  // Üye departman kontrolü: yalnızca aynı departmandan aktif kullanıcılar
  if (newMemberIds.length > 0) {
    const targetUserDept = projectDeptToUserDept(department);
    if (targetUserDept) {
      const invalidUser = await prisma.user.findFirst({
        where: {
          id: { in: newMemberIds },
          NOT: { department: targetUserDept },
        },
        select: { id: true, name: true },
      });
      if (invalidUser) {
        return NextResponse.json(
          { error: "Yalnızca aynı departmandan aktif kullanıcılar proje üyesi yapılabilir" },
          { status: 403 }
        );
      }
      // Aktif kullanıcı kontrolü
      const inactiveUser = await prisma.user.findFirst({
        where: {
          id: { in: newMemberIds },
          NOT: { status: "ACTIVE" },
        },
        select: { id: true, name: true },
      });
      if (inactiveUser) {
        return NextResponse.json(
          { error: "Yalnızca aktif kullanıcılar proje üyesi yapılabilir" },
          { status: 403 }
        );
      }
    }
  }

  const project = await prisma.project.create({
    data: {
      name: name.trim(),
      department,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      about: about?.trim() || null,
      createdById: user.id,
      status: "ACTIVE",
    },
  });

  // Kurucuyu + istenen üyeleri ekle (Set ile tekilleştir)
  const allMemberIds = [...new Set([user.id, ...newMemberIds])];
  await prisma.projectMember.createMany({
    data: allMemberIds.map((uid) => ({
      projectId: project.id,
      userId: uid,
      assignedBy: user.id,
    })),
  });

  const full = await prisma.project.findUnique({
    where: { id: project.id },
    include: projectInclude,
  });
  return NextResponse.json(full, { status: 201 });
}
