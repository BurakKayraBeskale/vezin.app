import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import CompanyDetail from "@/components/CompanyDetail";

export const dynamic = "force-dynamic";

export default async function CompanyDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { role, department } = session.user as any;
  const canView = role === "ADMIN" || department === "BAGIMSIZ_DENETIM";
  if (!canView) redirect("/");

  const canManage = role === "ADMIN" || (department === "BAGIMSIZ_DENETIM" && role === "MANAGER");
  const userId = (session.user as any).id as string;

  const company = await prisma.company.findUnique({
    where: { id: params.id },
    include: {
      assignments: {
        include: { user: { select: { id: true, name: true, email: true, department: true } } },
        orderBy: { assignedAt: "asc" },
      },
      tasks: {
        include: { assignedTo: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!company) notFound();

  // EMPLOYEE: only if assigned
  if (role === "EMPLOYEE" && department === "BAGIMSIZ_DENETIM") {
    const isAssigned = company.assignments.some((a) => a.userId === userId);
    if (!isAssigned) redirect("/companies");
  }

  // Metrics
  const totalTasks = company.tasks.length;
  const completedTasks = company.tasks.filter((t) => t.status === "DONE").length;
  const activeEmployees = company.assignments.length;
  const allWorkerIds = new Set([
    ...company.assignments.map((a) => a.userId),
    ...company.tasks.map((t) => t.assignedToId).filter(Boolean),
  ]);
  const totalRotation = allWorkerIds.size;
  const now = Date.now();
  const overdueTasks = company.tasks.filter(
    (t) => t.status !== "DONE" && t.dueDate && new Date(t.dueDate).getTime() < now
  ).length;

  // Stats for charts
  const statusCount: Record<string, number> = { TODO: 0, IN_PROGRESS: 0, REVIEW: 0, DONE: 0 };
  for (const t of company.tasks) statusCount[t.status] = (statusCount[t.status] || 0) + 1;

  const STATUS_LABELS: Record<string, string> = {
    TODO: "Yapılacak", IN_PROGRESS: "Devam Ediyor", REVIEW: "İncelemede", DONE: "Tamamlandı",
  };
  const STATUS_COLORS: Record<string, string> = {
    TODO: "#9CA3AF", IN_PROGRESS: "#F57C28", REVIEW: "#6366F1", DONE: "#10B981",
  };
  const statusDist = Object.entries(statusCount).map(([status, count]) => ({
    status, label: STATUS_LABELS[status], count, color: STATUS_COLORS[status],
  }));

  const nowDate = new Date();
  const monthlyMap: Record<string, number> = {};
  for (let i = 11; i >= 0; i--) {
    const d = new Date(nowDate.getFullYear(), nowDate.getMonth() - i, 1);
    monthlyMap[`${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}`] = 0;
  }
  for (const t of company.tasks.filter((t) => t.status === "DONE")) {
    const d = new Date(t.updatedAt);
    const key = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (key in monthlyMap) monthlyMap[key]++;
  }
  const monthlyCompleted = Object.entries(monthlyMap).map(([month, count]) => ({ month, count }));

  const yearlyMap: Record<number, number> = {};
  for (const t of company.tasks) {
    const year = new Date(t.createdAt).getFullYear();
    yearlyMap[year] = (yearlyMap[year] || 0) + 1;
  }
  const yearlyTasks = Object.entries(yearlyMap)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([year, count]) => ({ year: Number(year), count }));

  // Task count per user
  const taskCountByUser: Record<string, number> = {};
  for (const t of company.tasks) {
    if (t.assignedToId) taskCountByUser[t.assignedToId] = (taskCountByUser[t.assignedToId] || 0) + 1;
  }

  // Activity timeline (max 60 events)
  type TimelineEvent = { type: string; date: string; label: string; extra?: string };
  const timeline: TimelineEvent[] = [
    { type: "company_created", date: company.createdAt.toISOString(), label: "Firma sisteme eklendi" },
  ];
  for (const a of company.assignments) {
    timeline.push({ type: "assignment", date: a.assignedAt.toISOString(), label: `${a.user.name} firmaya atandı`, extra: a.user.department });
  }
  for (const t of company.tasks) {
    timeline.push({ type: "task_created", date: t.createdAt.toISOString(), label: t.title, extra: t.assignedTo?.name });
    if (t.status === "DONE") {
      timeline.push({ type: "task_completed", date: t.updatedAt.toISOString(), label: t.title, extra: t.assignedTo?.name });
    }
  }
  timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Serialize for client component
  const serialized = {
    id: company.id,
    name: company.name,
    taxNumber: company.taxNumber,
    sector: company.sector,
    startDate: company.startDate?.toISOString() ?? null,
    notes: company.notes,
    about: company.about,
    createdAt: company.createdAt.toISOString(),
    assignments: company.assignments.map((a) => ({
      id: a.id,
      userId: a.userId,
      assignedAt: a.assignedAt.toISOString(),
      user: a.user,
      taskCount: taskCountByUser[a.userId] ?? 0,
    })),
    tasks: company.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      dueDate: t.dueDate?.toISOString() ?? null,
      assignedTo: t.assignedTo,
    })),
  };

  return (
    <CompanyDetail
      company={serialized}
      metrics={{ totalTasks, completedTasks, activeEmployees, totalRotation, overdueTasks }}
      stats={{ statusDist, monthlyCompleted, yearlyTasks }}
      timeline={timeline.slice(0, 60)}
      canManage={canManage}
      role={role}
    />
  );
}
