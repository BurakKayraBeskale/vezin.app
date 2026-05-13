import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import BacklogTable from "@/components/BacklogTable";

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

export default async function BacklogPage() {
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user.role === "ADMIN";
  const userId = session!.user.id;
  const role = session!.user.role;

  const visibleUserIds = await getVisibleUserIds(userId, role);
  const taskWhere = visibleUserIds ? { assignedToId: { in: visibleUserIds } } : {};

  const [tasks, users, templates] = await Promise.all([
    prisma.task.findMany({
      where: taskWhere,
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
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

  const open = tasks.filter((t) => t.status !== "DONE").length;
  const highPriority = tasks.filter((t) => t.priority === "HIGH" && t.status !== "DONE").length;

  return (
    <div className="max-w-screen-xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Backlog</h1>
          <p className="text-sm text-gray-400 mt-1">
            {open} açık görev · {highPriority} yüksek öncelikli
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {[
            { label: "Toplam", value: tasks.length, cls: "bg-gray-100 text-gray-600" },
            { label: "Açık", value: open, cls: "bg-orange-50 text-orange-600 border border-orange-200" },
            { label: "Tamamlandı", value: tasks.filter(t=>t.status==="DONE").length, cls: "bg-emerald-50 text-emerald-600 border border-emerald-200" },
            { label: "Yüksek Öncelik", value: tasks.filter(t=>t.priority==="HIGH").length, cls: "bg-red-50 text-red-600 border border-red-200" },
          ].map((chip) => (
            <div key={chip.label} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${chip.cls}`}>
              <span className="font-bold">{chip.value}</span>
              <span className="opacity-70">{chip.label}</span>
            </div>
          ))}
        </div>
      </div>

      <BacklogTable
        initialTasks={JSON.parse(JSON.stringify(tasks))}
        users={JSON.parse(JSON.stringify(users))}
        isAdmin={isAdmin}
        templates={JSON.parse(JSON.stringify(templates))}
      />
    </div>
  );
}
