import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  getVisibleProjectIds,
  buildProjectVisibilityWhere,
  buildTaskVisibilityWhereForUser,
} from "@/lib/task-visibility";
import { canAccessProjects, canEditProject } from "@/lib/access";
import Link from "next/link";
import ProjeEditForm from "@/components/ProjeEditForm";
import ProjeDetayClient from "@/components/ProjeDetayClient";

const DEPT_LABELS: Record<string, string> = {
  BAGIMSIZ_DENETIM: "Bağımsız Denetim",
  VERGI: "Vergi",
};

export default async function ProjeDetayPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const userId = (session.user as any).id as string;
  const userRole = (session.user as any).role as string;
  const userDepartment = (session.user as any).department as string ?? "";
  const canViewAllProjects =
    (session.user as any).canViewAllProjects as boolean ?? false;
  const overseesDepartment =
    (session.user as any).overseesDepartment as string | null ?? null;

  if (
    !canAccessProjects({
      role: userRole,
      department: userDepartment,
      canViewAllProjects,
      overseesDepartment,
    })
  ) {
    notFound();
  }

  const visUser = {
    id: userId,
    role: userRole,
    canViewAllProjects,
    overseesDepartment,
  };
  const projectIds = await getVisibleProjectIds(visUser);
  const visWhere = buildProjectVisibilityWhere(projectIds);

  const project = await prisma.project.findFirst({
    where: { AND: [{ id: params.id }, visWhere as any] },
    include: {
      createdBy: { select: { id: true, name: true } },
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              seniorityLevel: true,
              title: true,
            },
          },
        },
        orderBy: { assignedAt: "asc" },
      },
    },
  });

  if (!project) notFound();

  const canEdit = canEditProject(
    { id: userId, role: userRole, overseesDepartment },
    { createdById: project.createdBy.id, department: project.department }
  );

  // Tasks — new per-user visibility model
  const taskWhere = buildTaskVisibilityWhereForUser(visUser);
  const tasks = await prisma.task.findMany({
    where: { AND: [{ projectId: params.id }, taskWhere as any] },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      dueDate: true,
      assignedTo: { select: { id: true, name: true } },
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4">
        <Link
          href="/projeler"
          className="hover:text-[#F57C28] transition-colors"
        >
          Projeler
        </Link>
        <span>/</span>
        <span className="text-gray-900 dark:text-white font-medium">
          {project.name}
        </span>
      </div>

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {project.name}
              </h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  project.department === "BAGIMSIZ_DENETIM"
                    ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                    : "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                }`}
              >
                {DEPT_LABELS[project.department] ?? project.department}
              </span>
            </div>
          </div>
          <div className="text-right text-sm text-gray-500 flex flex-col items-end gap-2">
            <p>{tasks.length} görev</p>
            <p>{project.members.length} üye</p>
            <ProjeEditForm
              project={{
                id: project.id,
                name: project.name,
                department: project.department,
                startDate: project.startDate
                  ? (project.startDate as Date).toISOString()
                  : null,
                notes: project.notes,
                about: project.about,
              }}
              canEdit={canEdit}
              currentMemberIds={project.members.map((m) => m.user.id)}
            />
          </div>
        </div>
      </div>

      {/* Interactive members + tasks (client component) */}
      <ProjeDetayClient
        tasks={tasks.map((t) => ({
          ...t,
          dueDate: t.dueDate ? (t.dueDate as Date).toISOString() : null,
          createdAt: (t.createdAt as Date).toISOString(),
        }))}
        members={project.members.map((m) => ({
          user: {
            id: m.user.id,
            name: m.user.name,
            title: m.user.title ?? null,
          },
        }))}
        canEdit={canEdit}
      />
    </div>
  );
}
