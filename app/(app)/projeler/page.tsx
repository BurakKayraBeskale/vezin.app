import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getVisibleProjectIds, buildProjectVisibilityWhere } from "@/lib/task-visibility";
import { canAccessProjects } from "@/lib/access";
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

  const visUser = { id: userId, role: userRole, canViewAllProjects, overseesDepartment };
  const projectIds = await getVisibleProjectIds(visUser);
  const visWhere = buildProjectVisibilityWhere(projectIds);

  // Üye seçimi için departman bazlı filtre — server-side Prisma WHERE
  // BD projesi → BAGIMSIZ_DENETIM kadrosu; Vergi projesi → YEMINLI_MALI_MUSAVIR kadrosu
  const seniorityFilter = canViewAllProjects || userRole === "ADMIN"
    ? {}
    : { seniorityLevel: { lt: seniorityLevel > 0 ? seniorityLevel : 1 } };

  const [projects, bdUsers, vergiUsers] = await Promise.all([
    prisma.project.findMany({
      where: visWhere as any,
      include: {
        createdBy: { select: { id: true, name: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, seniorityLevel: true, title: true } },
          },
          orderBy: { assignedAt: "asc" },
        },
        _count: { select: { tasks: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({
      where: { department: "BAGIMSIZ_DENETIM", ...seniorityFilter },
      select: { id: true, name: true, email: true, seniorityLevel: true, title: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { department: "YEMINLI_MALI_MUSAVIR", ...seniorityFilter },
      select: { id: true, name: true, email: true, seniorityLevel: true, title: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const canCreate = userRole === "ADMIN" || canViewAllProjects || seniorityLevel >= 5;

  return (
    <ProjectList
      initialProjects={projects as any}
      usersByDept={{ BAGIMSIZ_DENETIM: bdUsers, VERGI: vergiUsers }}
      canCreate={canCreate}
      canViewAllProjects={canViewAllProjects}
      currentDept={null}
      userDepartment={userDepartment}
      userId={userId}
      userRole={userRole}
      overseesDepartment={overseesDepartment}
    />
  );
}
