import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getVisibleProjectIds, buildProjectVisibilityWhere } from "@/lib/task-visibility";
import { canAccessProjects, canCreateProject } from "@/lib/access";
import ProjectList from "@/components/ProjectList";

export default async function ProjelerPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const userId = (session.user as any).id as string;
  const userRole = (session.user as any).role as string;
  const seniorityLevel = (session.user as any).seniorityLevel as number ?? 0;
  const canViewAllProjects = (session.user as any).canViewAllProjects as boolean ?? false;
  const overseesDepartment = (session.user as any).overseesDepartment as string | null ?? null;
  const userDepartment = (session.user as any).department as string ?? "";

  if (!canAccessProjects({ role: userRole, department: userDepartment, canViewAllProjects, overseesDepartment })) {
    notFound();
  }

  const visUser = {
    id: userId,
    role: userRole,
    department: userDepartment,
    seniorityLevel,
    canViewAllProjects,
    overseesDepartment,
  };
  const projectIds = await getVisibleProjectIds(visUser);
  const visWhere = buildProjectVisibilityWhere(projectIds);

  // Proje listesi (varsayılan: aktif)
  const [projects, outsourceUsers, bdUsers, muhasebeUsers, ymmUsers] = await Promise.all([
    prisma.project.findMany({
      where: { AND: [visWhere as any, { status: { not: "DELETED" } }] },
      include: {
        createdBy: { select: { id: true, name: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, seniorityLevel: true, title: true } },
          },
          orderBy: { assignedAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    // Üye seçimi için departman bazlı aktif kullanıcılar (kıdem kısıtı yok)
    prisma.user.findMany({
      where: { department: "OUTSOURCE", status: "ACTIVE" },
      select: { id: true, name: true, email: true, seniorityLevel: true, title: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { department: "BAGIMSIZ_DENETIM", status: "ACTIVE" },
      select: { id: true, name: true, email: true, seniorityLevel: true, title: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { department: "MUHASEBE", status: "ACTIVE" },
      select: { id: true, name: true, email: true, seniorityLevel: true, title: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { department: "YEMINLI_MALI_MUSAVIR", status: "ACTIVE" },
      select: { id: true, name: true, email: true, seniorityLevel: true, title: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const canCreate = canCreateProject({ seniorityLevel, role: userRole });

  return (
    <ProjectList
      initialProjects={projects as any}
      usersByDept={{
        OUTSOURCE: outsourceUsers,
        BAGIMSIZ_DENETIM: bdUsers,
        MUHASEBE: muhasebeUsers,
        YMM: ymmUsers,
      }}
      canCreate={canCreate}
      canViewAllProjects={canViewAllProjects}
      userDepartment={userDepartment}
      userId={userId}
      userRole={userRole}
      seniorityLevel={seniorityLevel}
      overseesDepartment={overseesDepartment}
    />
  );
}
