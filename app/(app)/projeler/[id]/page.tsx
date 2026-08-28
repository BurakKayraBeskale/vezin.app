import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getVisibleProjectIds, buildProjectVisibilityWhere, buildTaskVisibilityWhere } from "@/lib/task-visibility";
import { canAccessProjects } from "@/lib/access";
import Link from "next/link";

const DEPT_LABELS: Record<string, string> = {
  BAGIMSIZ_DENETIM: "Bağımsız Denetim",
  VERGI: "Vergi",
};

const STATUS_LABELS: Record<string, string> = {
  TODO: "Yapılacak",
  IN_PROGRESS: "Devam Ediyor",
  REVIEW: "İncelemede",
  DONE: "Tamamlandı",
};

export default async function ProjeDetayPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const userId = (session.user as any).id as string;
  const userRole = (session.user as any).role as string;
  const userDepartment = (session.user as any).department as string ?? "";
  const canViewAllProjects = (session.user as any).canViewAllProjects as boolean ?? false;
  const overseesDepartment = (session.user as any).overseesDepartment as string | null ?? null;

  if (!canAccessProjects({ role: userRole, department: userDepartment, canViewAllProjects, overseesDepartment })) {
    notFound();
  }

  const visUser = { id: userId, role: userRole, canViewAllProjects, overseesDepartment };
  const projectIds = await getVisibleProjectIds(visUser);
  const visWhere = buildProjectVisibilityWhere(projectIds);

  const project = await prisma.project.findFirst({
    where: { AND: [{ id: params.id }, visWhere as any] },
    include: {
      createdBy: { select: { id: true, name: true } },
      members: {
        include: { user: { select: { id: true, name: true, email: true, seniorityLevel: true, title: true } } },
        orderBy: { assignedAt: "asc" },
      },
    },
  });

  if (!project) notFound();

  // Tasks in this project — visibility already enforced by project access
  const taskWhere = buildTaskVisibilityWhere(projectIds);
  const tasks = await prisma.task.findMany({
    where: { AND: [{ projectId: params.id }, taskWhere as any] },
    select: {
      id: true, title: true, status: true, priority: true, dueDate: true,
      assignedTo: { select: { id: true, name: true } },
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const now = new Date();
  const statusGroups = {
    TODO: tasks.filter((t) => t.status === "TODO"),
    IN_PROGRESS: tasks.filter((t) => t.status === "IN_PROGRESS"),
    REVIEW: tasks.filter((t) => t.status === "REVIEW"),
    DONE: tasks.filter((t) => t.status === "DONE"),
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4">
        <Link href="/projeler" className="hover:text-[#F57C28] transition-colors">Projeler</Link>
        <span>/</span>
        <span className="text-gray-900 dark:text-white font-medium">{project.name}</span>
      </div>

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{project.name}</h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                project.department === "BAGIMSIZ_DENETIM"
                  ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                  : "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
              }`}>
                {DEPT_LABELS[project.department] ?? project.department}
              </span>
            </div>
            {project.sector && <p className="text-sm text-gray-500 dark:text-gray-400">{project.sector}</p>}
            {project.taxNumber && <p className="text-xs text-gray-400 mt-1">VKN: {project.taxNumber}</p>}
          </div>
          <div className="text-right text-sm text-gray-500">
            <p>{tasks.length} görev</p>
            <p>{project.members.length} üye</p>
          </div>
        </div>

        {/* Members */}
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Proje Üyeleri</p>
          <div className="flex flex-wrap gap-2">
            {project.members.map((m) => (
              <div key={m.user.id} className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-700 rounded-lg px-2.5 py-1.5">
                <div className="w-5 h-5 rounded-full bg-[#F57C28] flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0">
                  {m.user.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-900 dark:text-white leading-none">{m.user.name}</p>
                  {m.user.title && <p className="text-[9px] text-gray-400 mt-0.5">{m.user.title}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tasks */}
      <div className="space-y-4">
        {(["IN_PROGRESS", "REVIEW", "TODO", "DONE"] as const).map((status) => {
          const group = statusGroups[status];
          if (group.length === 0) return null;
          return (
            <div key={status} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{STATUS_LABELS[status]}</h2>
                <span className="text-xs font-medium text-gray-400">{group.length}</span>
              </div>
              <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {group.map((task) => {
                  const isOverdue = task.dueDate && new Date(task.dueDate) < now && task.status !== "DONE";
                  return (
                    <Link
                      key={task.id}
                      href={`/backlog?task=${task.id}`}
                      className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{task.title}</p>
                        {task.assignedTo && (
                          <p className="text-xs text-gray-400 mt-0.5">{task.assignedTo.name}</p>
                        )}
                      </div>
                      {task.dueDate && (
                        <span className={`text-xs ml-3 flex-shrink-0 ${isOverdue ? "text-red-500 font-semibold" : "text-gray-400"}`}>
                          {new Date(task.dueDate).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {tasks.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p>Bu projede henüz görev yok</p>
        </div>
      )}
    </div>
  );
}
