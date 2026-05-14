import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import KanbanBoard from "@/components/KanbanBoard";

export const dynamic = "force-dynamic";

async function getVisibleUserIds(userId: string, role: string): Promise<string[] | null> {
  if (role === "ADMIN") return null;

  // Sadece SUBORDINATE ilişkisindeki kişilerin görevleri görünür
  // SUPERIOR ve PEER ilişkileri görev görünürlüğünü etkilemez
  const relations = await prisma.userRelation.findMany({
    where: { managerId: userId, relationType: "SUBORDINATE" },
    select: { subordinateId: true },
  });

  return [userId, ...relations.map((r) => r.subordinateId)];
}

export default async function BoardPage() {
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user.role === "ADMIN";
  const userId = session!.user.id;
  const role = session!.user.role;

  const visibleUserIds = await getVisibleUserIds(userId, role);

  const taskWhere = visibleUserIds
    ? { assignedToId: { in: visibleUserIds } }
    : {};

  const [tasks, users, templates] = await Promise.all([
    prisma.task.findMany({
      where: taskWhere,
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        assignees: { include: { user: { select: { id: true, name: true, email: true } } } },
        createdBy: { select: { id: true, name: true } },
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
    prisma.user.findMany({
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    (isAdmin || role === "MANAGER")
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
        isAdmin={isAdmin}
        templates={JSON.parse(JSON.stringify(templates))}
      />
    </div>
  );
}
