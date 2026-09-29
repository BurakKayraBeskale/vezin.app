/**
 * Dashboard özet servisi — permission-aware domain AGGREGATOR.
 *
 * Kendi iş kuralı ÜRETMEZ; her bölüm ilgili domain'in mevcut kodundan gelir:
 *   Görevler  → Görev Takip sorgu motoru (buildBoardBaseWhere + boardStatusWhere,
 *               içinde Task Core görünürlüğü buildTaskVisibilityWhereForUser)
 *   Projeler  → getVisibleProjectIds (proje görünürlüğü) + görünür görevler
 *   İzin      → buildLeaveVisibilityWhere (viewer) + canApproveLeave (seçili kişi)
 *   Harcama   → buildExpenseVisibilityWhere (viewer) + getExpenseSummary
 *
 * Temel kural: "seçili kişi" (target) yalnız FİLTREDİR; görünürlük daima
 * VIEWER'a göredir. Viewer'ın göremediği görev/proje/izin/harcama hiçbir
 * sayıya, listeye veya proje özetine girmez. Seçili kişinin şahsi finansal
 * bakiyesi yalnız kendisine, Muhasebe'ye ve Admin'e döner.
 *
 * N+1 yok: KPI'lar count, dağılım tek groupBy, projeler iki sorgu + bellek içi
 * birleştirme, bekleyen işlemler kategori başına tek count.
 */

import { prisma } from "@/lib/prisma";
import { buildLeaveVisibilityWhere, canApproveLeave } from "@/lib/access";
import { getVisibleProjectIds } from "@/lib/task-visibility";
import {
  BOARD_STATUSES,
  boardStatusWhere,
  buildBoardBaseWhere,
  istanbulDayStart,
  type BoardFilters,
  type BoardQueryUser,
  type BoardStatus,
} from "@/lib/task-board";
import { getExpenseSummary, loadExpenseActor, loadExpenseActorScope } from "@/lib/expense/data";
import { buildExpenseVisibilityWhere } from "@/lib/expense/permissions";
import { isExpenseAccountingUser } from "@/lib/expense/constants";
import {
  DASHBOARD_UPCOMING_DAYS,
  OPEN_STATUSES,
  boardHref,
  distributionBoardFilters,
  kpiBoardFilters,
  projectHref,
  projectsForMemberHref,
  upcomingBoardFilters,
  type DashboardKpiKey,
} from "./links";
import type { DashboardViewer } from "./people";

export const DASHBOARD_UPCOMING_LIMIT = 10;
export const DASHBOARD_PROJECT_LIMIT = 5;
/** Yaklaşan/proje hesapları için bellek üst sınırı — tek kişinin açık görevleri. */
const OPEN_TASK_SCAN_CAP = 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface DashboardTarget {
  id: string;
  name: string;
  role: string;
  email: string;
  department: string;
  status: string;
}

export interface DashboardCount {
  count: number;
  href: string;
}

export type UpcomingGroup = "overdue" | "today" | "upcoming";

export interface DashboardUpcomingItem {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: Date;
  project: { id: string; name: string } | null;
  group: UpcomingGroup;
}

export interface DashboardProjectCard {
  id: string;
  name: string;
  department: string;
  overdueCount: number;
  openCount: number;
  nextDueDate: Date | null;
  endDate: Date | null;
  href: string;
}

export interface DashboardPendingItem {
  key: string;
  label: string;
  count: number;
  href: string;
}

export interface DashboardSummary {
  person: { id: string; name: string; isSelf: boolean };
  kpis: Record<DashboardKpiKey, DashboardCount>;
  distribution: { status: BoardStatus; count: number; href: string }[];
  pending: DashboardPendingItem[];
  upcoming: { items: DashboardUpcomingItem[]; total: number; href: string };
  projects: { items: DashboardProjectCard[]; total: number; href: string };
  /** null → viewer bu kişinin şahsi finansal özetini göremez */
  finance: {
    receivable: { amount: number; count: number };
    refund: { amount: number; count: number };
    inApproval: { amount: number; count: number } | null;
    href: string;
  } | null;
  generatedAt: Date;
}

function boardUserOf(viewer: DashboardViewer): BoardQueryUser {
  return {
    id: viewer.id,
    role: viewer.role,
    department: viewer.department,
    seniorityLevel: viewer.seniorityLevel,
    canViewAllProjects: viewer.canViewAllProjects,
    overseesDepartment: viewer.overseesDepartment,
    isAdmin: viewer.role === "ADMIN",
  };
}

/** Görev Takip'in bir filtre için göstereceği toplam (seçili kolonların toplamı). */
async function countBoard(user: BoardQueryUser, filters: BoardFilters, now: Date): Promise<number> {
  const base = buildBoardBaseWhere(user, filters);
  const statuses = filters.statuses.length > 0 ? filters.statuses : [...BOARD_STATUSES];
  const counts = await Promise.all(statuses.map((s) => prisma.task.count({ where: boardStatusWhere(base, s, filters, now) as any })));
  return counts.reduce((a, b) => a + b, 0);
}

// ── Görevler ─────────────────────────────────────────────────────────────────

async function taskKpis(user: BoardQueryUser, personId: string, now: Date) {
  const f = kpiBoardFilters(personId);
  const keys = Object.keys(f) as DashboardKpiKey[];
  const counts = await Promise.all(keys.map((k) => countBoard(user, f[k], now)));
  return Object.fromEntries(keys.map((k, i) => [k, { count: counts[i], href: boardHref(f[k]) }])) as Record<DashboardKpiKey, DashboardCount>;
}

async function taskDistribution(user: BoardQueryUser, personId: string) {
  const f = distributionBoardFilters(personId);
  // Tek groupBy — Tamamlandı dahil tüm geçmiş client'a inmeden sayılır
  const rows = await prisma.task.groupBy({
    by: ["status"],
    where: buildBoardBaseWhere(user, { ...f.TODO, statuses: [] }) as any,
    _count: { id: true },
  });
  return BOARD_STATUSES.map((status) => ({
    status,
    count: rows.find((r) => r.status === status)?._count.id ?? 0,
    href: boardHref(f[status]),
  }));
}

function priorityRank(p: string): number {
  return p === "HIGH" ? 0 : p === "MEDIUM" ? 1 : 2;
}

const GROUP_RANK: Record<UpcomingGroup, number> = { overdue: 0, today: 1, upcoming: 2 };

/**
 * Bugün & Yaklaşan: gecikmiş → bugün → yaklaşan; grup içinde yüksek öncelik,
 * sonra yakın son tarih. Gruplama Türkiye takvim gününe göredir.
 */
export function classifyUpcoming(dueDate: Date, now: Date): UpcomingGroup {
  const todayStart = istanbulDayStart(now).getTime();
  if (dueDate.getTime() < todayStart) return "overdue";
  if (dueDate.getTime() < todayStart + DAY_MS) return "today";
  return "upcoming";
}

async function upcomingTasks(user: BoardQueryUser, personId: string, now: Date) {
  const filters = upcomingBoardFilters(personId);
  const where = { AND: [buildBoardBaseWhere(user, filters), { status: { in: OPEN_STATUSES } }] };
  const rows = await prisma.task.findMany({
    where: where as any,
    select: { id: true, title: true, status: true, priority: true, dueDate: true, project: { select: { id: true, name: true } } },
    take: OPEN_TASK_SCAN_CAP,
  });
  const total = rows.length < OPEN_TASK_SCAN_CAP ? rows.length : await prisma.task.count({ where: where as any });
  const items: DashboardUpcomingItem[] = rows
    .filter((r): r is typeof r & { dueDate: Date } => r.dueDate !== null)
    .map((r) => ({ ...r, group: classifyUpcoming(r.dueDate, now) }))
    .sort(
      (a, b) =>
        GROUP_RANK[a.group] - GROUP_RANK[b.group] ||
        priorityRank(a.priority) - priorityRank(b.priority) ||
        a.dueDate.getTime() - b.dueDate.getTime()
    )
    .slice(0, DASHBOARD_UPCOMING_LIMIT);
  return { items, total, href: boardHref(filters) };
}

// ── Projeler ─────────────────────────────────────────────────────────────────

/**
 * Öne Çıkan Projeler — seçili kişinin ÜYESİ olduğu, viewer'ın GÖREBİLDİĞİ aktif
 * projeler. Dikkat sırası: kişinin gecikmiş görevi → 7 gün içinde son tarihi →
 * aktif görevi → yakın proje bitişi → son aktivite. İstatistikler yalnız
 * viewer'ın görebildiği görevlerden hesaplanır (gizli görev dolaylı sızmaz).
 */
async function featuredProjects(viewer: DashboardViewer, user: BoardQueryUser, personId: string, now: Date) {
  const visibleIds = await getVisibleProjectIds(viewer);
  const projectWhere = {
    deletedAt: null,
    status: "ACTIVE",
    members: { some: { userId: personId } },
    ...(visibleIds !== null ? { id: { in: visibleIds } } : {}),
  };
  const projects = await prisma.project.findMany({
    where: projectWhere,
    select: { id: true, name: true, department: true, endDate: true, updatedAt: true },
  });
  const href = projectsForMemberHref(personId);
  if (projects.length === 0) return { items: [], total: 0, href };

  const tasks = await prisma.task.findMany({
    where: {
      AND: [
        buildBoardBaseWhere(user, { ...upcomingBoardFilters(personId), dueWithinDays: null }),
        { status: { in: OPEN_STATUSES }, projectId: { in: projects.map((p) => p.id) } },
      ],
    } as any,
    select: { projectId: true, dueDate: true, updatedAt: true },
    take: OPEN_TASK_SCAN_CAP,
  });

  const upcomingEnd = new Date(istanbulDayStart(now).getTime() + (DASHBOARD_UPCOMING_DAYS + 1) * DAY_MS);
  const stats = new Map<string, { overdue: number; open: number; upcoming: number; nextDue: Date | null; lastActivity: number }>();
  for (const t of tasks) {
    if (!t.projectId) continue;
    const s = stats.get(t.projectId) ?? { overdue: 0, open: 0, upcoming: 0, nextDue: null, lastActivity: 0 };
    s.open++;
    if (t.dueDate) {
      // "Gecikmiş" Görev Takip ile aynı tanım: tamamlanmamış ve son tarihi geçmiş
      if (t.dueDate < now) s.overdue++;
      else {
        if (t.dueDate < upcomingEnd) s.upcoming++;
        if (!s.nextDue || t.dueDate < s.nextDue) s.nextDue = t.dueDate;
      }
    }
    s.lastActivity = Math.max(s.lastActivity, t.updatedAt.getTime());
    stats.set(t.projectId, s);
  }

  const cards = projects.map((p) => {
    const s = stats.get(p.id);
    return {
      project: p,
      overdue: s?.overdue ?? 0,
      open: s?.open ?? 0,
      upcoming: s?.upcoming ?? 0,
      nextDue: s?.nextDue ?? null,
      lastActivity: Math.max(s?.lastActivity ?? 0, p.updatedAt.getTime()),
    };
  });
  const flag = (n: number) => (n > 0 ? 0 : 1);
  cards.sort(
    (a, b) =>
      flag(a.overdue) - flag(b.overdue) ||
      flag(a.upcoming) - flag(b.upcoming) ||
      flag(a.open) - flag(b.open) ||
      (a.project.endDate?.getTime() ?? Infinity) - (b.project.endDate?.getTime() ?? Infinity) ||
      b.lastActivity - a.lastActivity
  );

  const items: DashboardProjectCard[] = cards.slice(0, DASHBOARD_PROJECT_LIMIT).map((c) => ({
    id: c.project.id,
    name: c.project.name,
    department: c.project.department,
    overdueCount: c.overdue,
    openCount: c.open,
    nextDueDate: c.nextDue,
    endDate: c.project.endDate,
    href: projectHref(c.project.id),
  }));
  return { items, total: projects.length, href };
}

// ── Bekleyen işlemler ────────────────────────────────────────────────────────

async function pendingLeaveApprovals(viewer: DashboardViewer, target: DashboardTarget): Promise<DashboardPendingItem | null> {
  // Viewer'ın görebildiği bekleyen talepler ∩ seçili kişinin onaylayabildikleri (canApproveLeave)
  const requests = await prisma.leaveRequest.findMany({
    where: {
      AND: [
        buildLeaveVisibilityWhere({ id: viewer.id, role: viewer.role, email: viewer.email }),
        { status: "PENDING", deletedAt: null, userId: { not: target.id } },
      ],
    } as any,
    select: { id: true, userId: true, user: { select: { department: true } } },
    orderBy: { createdAt: "asc" },
  });
  const approvable = requests.filter((r) =>
    canApproveLeave({ id: target.id, role: target.role, email: target.email }, { userId: r.userId, userDepartment: r.user.department })
  );
  if (approvable.length === 0) return null;
  return {
    key: "leave-approval",
    label: "Onaylaması Gereken İzinler",
    count: approvable.length,
    href: approvable.length === 1 ? `/izin-durumu?requestId=${approvable[0].id}` : "/izin-durumu",
  };
}

async function pendingExpenseItems(viewer: DashboardViewer, target: DashboardTarget): Promise<DashboardPendingItem[]> {
  const actor = await loadExpenseActor(viewer.id);
  if (!actor || actor.status !== "ACTIVE") return [];
  const visible = buildExpenseVisibilityWhere(actor, await loadExpenseActorScope(actor));
  const count = (where: object) => prisma.expenseForm.count({ where: { AND: [visible, where] } as any });

  const out: DashboardPendingItem[] = [];
  // Departman onayı: seçili kişinin açık turda bekleyen onay kaydı (Onay Bekleyenler sekmesiyle aynı koşul)
  const deptApprovals = await count({
    status: "DEPT_APPROVAL",
    rounds: { some: { status: "PENDING", approvals: { some: { approverId: target.id, status: "PENDING" } } } },
  });
  if (deptApprovals > 0) {
    out.push({ key: "expense-dept", label: "Onaylaması Gereken Harcama Formları", count: deptApprovals, href: "/harcama?tab=approvals" });
  }

  // Muhasebe kuyruğu: yalnız seçili kişi Muhasebe'deyse (kendi formları hariç — kimse kendi formunu işleyemez)
  if (isExpenseAccountingUser(target)) {
    const queues = [
      { key: "expense-accounting", status: "ACCOUNTING_APPROVAL", label: "Muhasebe Onayı Bekleyen Harcamalar" },
      { key: "expense-payment", status: "PAYMENT_PENDING", label: "Ödeme Bekleyen Harcamalar" },
      { key: "expense-refund", status: "REFUND_PENDING", label: "İade Bekleyen Harcamalar" },
    ];
    const counts = await Promise.all(queues.map((q) => count({ status: q.status, ownerId: { not: target.id } })));
    queues.forEach((q, i) => {
      if (counts[i] > 0) {
        out.push({ key: q.key, label: q.label, count: counts[i], href: `/harcama?tab=accounting&status=${q.status}` });
      }
    });
  }
  return out;
}

// ── Finansal özet (gizlilik) ─────────────────────────────────────────────────

/** Şahsi alacak/iade bakiyesi: yalnız kişinin kendisi, Muhasebe ve Admin. */
export function canSeeDashboardFinance(viewer: DashboardViewer, targetId: string): boolean {
  return viewer.id === targetId || viewer.role === "ADMIN" || isExpenseAccountingUser(viewer);
}

async function financeSummary(viewer: DashboardViewer, target: DashboardTarget): Promise<DashboardSummary["finance"]> {
  if (!canSeeDashboardFinance(viewer, target.id)) return null;
  const s = await getExpenseSummary(target.id);
  const isSelf = viewer.id === target.id;
  return {
    receivable: s.receivable,
    refund: s.refund,
    // Onay sürecindeki (departman aşaması dahil) formlar yalnız sahibine özetlenir
    inApproval: isSelf ? s.inApproval : null,
    href: isSelf
      ? "/harcama"
      : `/harcama?tab=${viewer.role === "ADMIN" ? "all" : "accounting"}&view=all&ownerId=${encodeURIComponent(target.id)}`,
  };
}

// ── Toplam ───────────────────────────────────────────────────────────────────

export async function getDashboardSummary(viewer: DashboardViewer, target: DashboardTarget, now: Date = new Date()): Promise<DashboardSummary> {
  const user = boardUserOf(viewer);
  const [kpis, distribution, upcoming, projects, leave, expense, finance] = await Promise.all([
    taskKpis(user, target.id, now),
    taskDistribution(user, target.id),
    upcomingTasks(user, target.id, now),
    featuredProjects(viewer, user, target.id, now),
    pendingLeaveApprovals(viewer, target),
    pendingExpenseItems(viewer, target),
    financeSummary(viewer, target),
  ]);

  const pending: DashboardPendingItem[] = [];
  if (kpis.review.count > 0) {
    pending.push({ key: "task-review", label: "İncelemesinde Bekleyen Görevler", count: kpis.review.count, href: kpis.review.href });
  }
  if (leave) pending.push(leave);
  pending.push(...expense);

  return {
    person: { id: target.id, name: target.name, isSelf: viewer.id === target.id },
    kpis,
    distribution,
    pending,
    upcoming,
    projects,
    finance,
    generatedAt: now,
  };
}
