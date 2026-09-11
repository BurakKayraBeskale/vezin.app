import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  getVisibleProjectIds,
  buildProjectVisibilityWhere,
  buildTaskVisibilityWhereForUser,
} from "@/lib/task-visibility";
import { canAccessProjects, canManageProject } from "@/lib/access";
import Link from "next/link";
import ProjeEditForm from "@/components/ProjeEditForm";
import ProjeDetayClient from "@/components/ProjeDetayClient";
import ProjeAksiyonlar from "@/components/ProjeAksiyonlar";

const DEPT_LABELS: Record<string, string> = {
  OUTSOURCE:        "Outsource",
  BAGIMSIZ_DENETIM: "Bağımsız Denetim",
  MUHASEBE:         "Muhasebe",
  YMM:              "YMM",
};

const DEPT_COLORS: Record<string, string> = {
  OUTSOURCE:        "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300",
  BAGIMSIZ_DENETIM: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
  MUHASEBE:         "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
  YMM:              "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300",
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE:   "Aktif",
  DONE:     "Tamamlandı",
  ARCHIVED: "Arşivlendi",
  DELETED:  "Silinmiş",
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:   "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
  DONE:     "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300",
  ARCHIVED: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300",
  DELETED:  "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
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
  const canViewAllProjects = (session.user as any).canViewAllProjects as boolean ?? false;
  const overseesDepartment = (session.user as any).overseesDepartment as string | null ?? null;
  const seniorityLevel = (session.user as any).seniorityLevel as number ?? 0;

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

  // Silinmiş projeye erişim engellenir (buildProjectVisibilityWhere zaten deletedAt: null ekler)
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
              canBeAssignedTasks: true,
            },
          },
        },
        orderBy: { assignedAt: "asc" },
      },
    },
  });

  if (!project) notFound();

  const isMember = project.members.some((m) => m.user.id === userId);
  const canManage = canManageProject(visUser, project, isMember);

  // Üye ilerleme hesabı — bu projedeki tüm görevler (görünürlük filtresi olmadan)
  // canManage → tüm üyelerin ilerlemesi; değil → yalnızca kendi ilerlemesi
  const progressNeededIds = canManage
    ? project.members.map((m) => m.user.id)
    : [userId];
  const progressTasks = await prisma.task.findMany({
    where: { projectId: params.id, assignedToId: { in: progressNeededIds } },
    select: { assignedToId: true, status: true },
  });
  const progressMap = new Map<string, { done: number; total: number }>();
  for (const t of progressTasks) {
    if (!t.assignedToId) continue;
    const entry = progressMap.get(t.assignedToId) ?? { done: 0, total: 0 };
    entry.total++;
    if (t.status === "DONE") entry.done++;
    progressMap.set(t.assignedToId, entry);
  }

  // canAssignBase: görev atama otoritesi (gelecekteki task permission sistemi için hazır)
  const canAssignBase = canViewAllProjects || canManage;
  const bypassSeniority = userRole === "ADMIN" || canViewAllProjects;

  // Görev görünürlüğü — mevcut sistem korunuyor; task permission sistemi ayrı geliştirilecek
  const taskWhere = buildTaskVisibilityWhereForUser({
    ...visUser,
    seniorityLevel,
  });
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

  const now = new Date();
  const endDate = project.endDate ? (project.endDate as Date) : null;
  const isOverdue = endDate != null && endDate < now && project.status === "ACTIVE";

  return (
    <div className="max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4">
        <Link href="/projeler" className="hover:text-[#F57C28] transition-colors">
          Projeler
        </Link>
        <span>/</span>
        <span className="text-gray-900 dark:text-white font-medium">{project.name}</span>
      </div>

      {/* Header kartı */}
      <div className={`bg-white dark:bg-gray-800 rounded-xl border p-6 mb-6 ${
        isOverdue ? "border-red-300 dark:border-red-700" : "border-gray-200 dark:border-gray-700"
      }`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Ad + Badges */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {project.name}
              </h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                DEPT_COLORS[project.department] ?? "bg-gray-100 text-gray-700"
              }`}>
                {DEPT_LABELS[project.department] ?? project.department}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                STATUS_COLORS[project.status] ?? STATUS_COLORS.ACTIVE
              }`}>
                {STATUS_LABELS[project.status] ?? project.status}
              </span>
              {isOverdue && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                  Bitiş tarihi geçti
                </span>
              )}
            </div>

            {/* Tarihler */}
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
              {project.startDate && (
                <span>
                  Başlangıç:{" "}
                  <span className="text-gray-700 dark:text-gray-300 font-medium">
                    {(project.startDate as Date).toLocaleDateString("tr-TR")}
                  </span>
                </span>
              )}
              {endDate && (
                <span>
                  Bitiş:{" "}
                  <span className={`font-medium ${isOverdue ? "text-red-600 dark:text-red-400" : "text-gray-700 dark:text-gray-300"}`}>
                    {endDate.toLocaleDateString("tr-TR")}
                  </span>
                </span>
              )}
            </div>

            {/* Proje Açıklaması */}
            {project.about && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-3 leading-relaxed">
                {project.about}
              </p>
            )}
          </div>

          {/* Sağ taraf: Düzenle + Aksiyonlar */}
          {canManage && (
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              <ProjeEditForm
                project={{
                  id: project.id,
                  name: project.name,
                  department: project.department,
                  status: project.status,
                  startDate: project.startDate
                    ? (project.startDate as Date).toISOString()
                    : null,
                  endDate: endDate ? endDate.toISOString() : null,
                  about: project.about,
                }}
                canEdit={canManage}
                currentMemberIds={project.members.map((m) => m.user.id)}
              />
              <ProjeAksiyonlar
                projectId={project.id}
                status={project.status}
              />
            </div>
          )}
        </div>
      </div>

      {/* Üyeler + Görevler (client component) */}
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
            seniorityLevel: m.user.seniorityLevel,
            canBeAssignedTasks: m.user.canBeAssignedTasks,
            // canManage → tüm üyelerin ilerlemesi gönderilir; değil → yalnızca kendi
            taskProgress: progressMap.get(m.user.id) ?? (
              (canManage || m.user.id === userId) ? { done: 0, total: 0 } : null
            ),
          },
        }))}
        canEdit={canManage}
        canAssignBase={canAssignBase}
        assignerSeniorityLevel={seniorityLevel}
        bypassSeniority={bypassSeniority}
        projectId={project.id}
        projectName={project.name}
        projectDept={project.department}
        projectStatus={project.status}
      />
    </div>
  );
}
