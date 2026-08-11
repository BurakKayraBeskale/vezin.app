import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import KanbanBoard from "@/components/KanbanBoard";
import { HIDDEN_ACCOUNT_EMAILS } from "@/lib/hidden-accounts";
import { BYPASS_AUTH_ROLES } from "@/lib/auth-bypass";
import { getVisibleTaskIds, buildVisibilityWhere } from "@/lib/task-visibility";

export const dynamic = "force-dynamic";

export default async function BoardPage() {
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user.role === "ADMIN";
  const userId = session!.user.id;
  const role = session!.user.role;
  const canViewAllTasks = (session!.user as any).canViewAllTasks ?? false;
  const canManage = isAdmin || canViewAllTasks;

  // ── Görünür görevler — kıdem+atama zinciri modeli ─────────────────────────
  const visibleIds = await getVisibleTaskIds({ id: userId, role, canViewAllTasks });
  const taskWhere = buildVisibilityWhere(visibleIds);

  // ── Atanabilir kullanıcılar — kıdem kuralı ───────────────────────────────
  const assigner = await prisma.user.findUnique({
    where: { id: userId },
    select: { seniorityLevel: true, canViewAllTasks: true, role: true },
  });
  const canAssignAll = assigner ? (assigner.canViewAllTasks || assigner.role === "ADMIN") : false;

  const [tasks, users, templates] = await Promise.all([
    prisma.task.findMany({
      where: taskWhere as any,
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        assignees: { include: { user: { select: { id: true, name: true, email: true } } } },
        createdBy: { select: { id: true, name: true } },
        parent: { select: { id: true, title: true } },
        children: { select: { id: true, title: true, status: true } },
        files: {
          include: { uploadedBy: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
        },
        feedbacks: {
          include: { fromUser: { select: { id: true, name: true, role: true } } },
          orderBy: { createdAt: "asc" },
        },
        logs: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { timestamp: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    // Atanabilir kullanıcılar: kıdem kuralına göre filtreli
    prisma.user.findMany({
      where: canAssignAll
        ? { email: { notIn: HIDDEN_ACCOUNT_EMAILS } }
        : {
            email: { notIn: HIDDEN_ACCOUNT_EMAILS },
            seniorityLevel: { lt: assigner?.seniorityLevel ?? 0 },
          },
      select: { id: true, name: true, email: true, seniorityLevel: true, title: true },
      orderBy: { name: "asc" },
    }),
    canManage
      ? prisma.taskTemplate.findMany({
          select: { id: true, title: true, description: true, priority: true, estimatedDays: true },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
  ]);

  const counts = {
    todo: tasks.filter((t) => t.status === "TODO").length,
    inProgress: tasks.filter((t) => t.status === "IN_PROGRESS").length,
    review: tasks.filter((t) => t.status === "REVIEW").length,
    done: tasks.filter((t) => t.status === "DONE").length,
  };

  return (
    <div className="max-w-screen-2xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Kanban Tahtası</h1>
          <p className="text-sm text-gray-400 mt-1">
            Görevlere tıklayarak detay ve işlemleri görüntüleyin
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { label: "Yapılacak", count: counts.todo, color: "#6B7280", bg: "#F3F4F6" },
            { label: "Devam", count: counts.inProgress, color: "#F57C28", bg: "#FFF3E9" },
            { label: "İncele", count: counts.review, color: "#6366F1", bg: "#EEF2FF" },
            { label: "Tamam", count: counts.done, color: "#10B981", bg: "#ECFDF5" },
          ].map((s) => (
            <div key={s.label}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{ backgroundColor: s.bg, color: s.color }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}: {s.count}
            </div>
          ))}
        </div>
      </div>

      <KanbanBoard
        initialTasks={JSON.parse(JSON.stringify(tasks))}
        users={JSON.parse(JSON.stringify(users))}
        isAdmin={canManage}
        currentUserId={userId}
        canDeleteFiles={canManage}
        templates={JSON.parse(JSON.stringify(templates))}
      />
    </div>
  );
}
