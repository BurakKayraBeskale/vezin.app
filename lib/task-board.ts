/**
 * Görev Takip (Kanban) ekranının sunucu tarafı veri motoru — GÖREV TAKİP
 * YENİDEN YAPILANDIRMASI.
 *
 * Bu dosya yalnızca mevcut Task Core görünürlük/izin kurallarının (bkz.
 * lib/task-permissions.ts, lib/task-visibility.ts) üzerine bir SORGULAMA/
 * SAYFALAMA/SIRALAMA katmanı ekler — yeni bir permission veya workflow kuralı
 * ÜRETMEZ. Görünürlük her zaman buildTaskVisibilityWhereForUser'dan gelir;
 * parent/children sızıntısı her zaman filterRelatedTaskVisibility'den geçer.
 *
 * Prisma'ya bağımlı olduğu için lib/task-permissions.ts'ten AYRI tutulur —
 * o dosya client component'lerden de import edilir (bkz. lib/task-assignment.ts
 * ile aynı ayrım deseni).
 */

import { prisma } from "@/lib/prisma";
import { buildTaskVisibilityWhereForUser, filterRelatedTaskVisibility, VisibilityUser } from "@/lib/task-visibility";
import { projectDeptToUserDept } from "@/lib/access";

export const BOARD_STATUSES = ["TODO", "IN_PROGRESS", "REVIEW", "DONE"] as const;
export type BoardStatus = (typeof BOARD_STATUSES)[number];

export type BoardQuickView = "mine" | "given" | "all";
export type BoardOverdueFilter = "" | "yes" | "no";
export type BoardCompletedRange = "30d" | "all";

export const BOARD_PAGE_SIZE = 30;
/** "Tümünü Göster" + arama birlikte kullanıldığında DONE için tek seferde
 *  DB'den çekilecek üst sınır — pano bir arşiv değildir (bkz. ekranın amacı);
 *  bu kombinasyonda arama en son tamamlanan N görev içinde çalışır. */
const DONE_ALL_SEARCH_CAP = 1000;

export interface BoardFilters {
  view: BoardQuickView;
  q: string;
  /** "" = tümü, "none" = projesiz, aksi halde proje id'si */
  projectId: string;
  /** "" = tümü, aksi halde assignedToId */
  personId: string;
  /** "" = tümü, aksi halde LOW|MEDIUM|HIGH */
  priority: string;
  overdue: BoardOverdueFilter;
  /** yalnızca ADMIN için anlamlıdır; diğer kullanıcılarda sunucu tarafında yok sayılır */
  department: string;
  completedRange: BoardCompletedRange;
}

export function parseBoardFilters(params: URLSearchParams): BoardFilters {
  const view = params.get("view");
  return {
    view: view === "given" || view === "all" ? view : "mine",
    q: params.get("q") ?? "",
    projectId: params.get("projectId") ?? "",
    personId: params.get("personId") ?? "",
    priority: params.get("priority") ?? "",
    overdue: params.get("overdue") === "yes" || params.get("overdue") === "no" ? (params.get("overdue") as BoardOverdueFilter) : "",
    department: params.get("department") ?? "",
    completedRange: params.get("completedRange") === "all" ? "all" : "30d",
  };
}

export interface BoardQueryUser extends VisibilityUser {
  isAdmin: boolean;
}

const cardInclude = {
  assignedTo: { select: { id: true, name: true } },
  project: { select: { id: true, name: true, department: true } },
  parent: { select: { id: true, title: true } },
};

export type BoardTaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: BoardStatus;
  priority: "LOW" | "MEDIUM" | "HIGH";
  dueDate: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  reviewOwnerId: string | null;
  assignedToId: string | null;
  assignedTo: { id: string; name: string } | null;
  projectId: string | null;
  project: { id: string; name: string; department: string } | null;
  departmentId: string | null;
  parent: { id: string; title: string } | { restricted: true } | null;
};

/** Türkçe harf duyarlı küçültme — "İ"→"i", "I"→"ı" (varsayılan locale bunu bozar). */
function trFold(s: string): string {
  return s.toLocaleLowerCase("tr");
}

function matchesSearch(t: { title: string; description: string | null; project: { name: string } | null; assignedTo: { name: string } | null }, needle: string): boolean {
  const haystacks = [t.title, t.description ?? "", t.project?.name ?? "", t.assignedTo?.name ?? ""];
  return haystacks.some((h) => trFold(h).includes(needle));
}

function priorityRank(p: string): number {
  return p === "HIGH" ? 0 : p === "MEDIUM" ? 1 : 2;
}

function isOverdueRow(t: { dueDate: Date | null; status: string }, now: Date): boolean {
  return !!t.dueDate && t.status !== "DONE" && t.dueDate.getTime() < now.getTime();
}

/**
 * Kolon içi varsayılan sıralama — GÖREV TAKİP #39/#40:
 *   1. Gecikmiş önce
 *   2. Yüksek öncelik önce
 *   3. Son tarihi olanlar arasında en yakın önce (son tarihi olmayanlar sona)
 *   4. Son tarihi olmayanlarda en yeni oluşturulan önce
 */
function boardComparator(now: Date) {
  return (a: BoardTaskRow, b: BoardTaskRow): number => {
    const ao = isOverdueRow(a, now) ? 0 : 1;
    const bo = isOverdueRow(b, now) ? 0 : 1;
    if (ao !== bo) return ao - bo;

    const ap = priorityRank(a.priority);
    const bp = priorityRank(b.priority);
    if (ap !== bp) return ap - bp;

    const ad = a.dueDate ? a.dueDate.getTime() : null;
    const bd = b.dueDate ? b.dueDate.getTime() : null;
    if (ad !== null && bd !== null) {
      if (ad !== bd) return ad - bd;
    } else if (ad !== null) {
      return -1; // son tarihi olan, olmayandan önce
    } else if (bd !== null) {
      return 1;
    }

    return b.createdAt.getTime() - a.createdAt.getTime();
  };
}

/** Admin department filtresi (proje-departman formatı: OUTSOURCE|BAGIMSIZ_DENETIM|MUHASEBE|YMM). */
function departmentWhere(deptFilter: string): object {
  const userDept = projectDeptToUserDept(deptFilter) ?? deptFilter;
  return {
    OR: [
      { projectId: null, departmentId: userDept },
      { project: { department: deptFilter } },
    ],
  };
}

/**
 * Güvenlik + hızlı görünüm + filtre WHERE'i — status/tamamlanma tarihi HARİÇ
 * (bunlar fetchStatusColumn içinde kolon bazlı eklenir).
 */
function buildBaseWhere(user: BoardQueryUser, filters: BoardFilters): object {
  const and: object[] = [buildTaskVisibilityWhereForUser(user)];

  if (filters.view === "mine") and.push({ assignedToId: user.id });
  else if (filters.view === "given") and.push({ reviewOwnerId: user.id });

  if (filters.projectId === "none") and.push({ projectId: null });
  else if (filters.projectId) and.push({ projectId: filters.projectId });

  if (filters.personId) and.push({ assignedToId: filters.personId });

  if (filters.priority) and.push({ priority: filters.priority });

  if (filters.overdue === "yes") {
    and.push({ status: { not: "DONE" }, dueDate: { lt: new Date() } });
  } else if (filters.overdue === "no") {
    and.push({ OR: [{ status: "DONE" }, { dueDate: null }, { dueDate: { gte: new Date() } }] });
  }

  // department: yalnızca admin için anlamlı — çağıran taraf (API ucu) admin
  // olmayan kullanıcılar için bu alanı zaten boşa çevirir (güvenlik sınırı
  // burada değil, çağıran tarafta İKİ kez uygulanmaz; tek doğru kaynak orada).
  if (filters.department) and.push(departmentWhere(filters.department));

  return { AND: and };
}

interface FetchColumnResult {
  items: BoardTaskRow[];
  total: number;
  hasMore: boolean;
}

async function fetchStatusColumn(
  baseWhere: object,
  status: BoardStatus,
  filters: BoardFilters,
  offset: number,
  limit: number,
  now: Date
): Promise<FetchColumnResult> {
  const trimmedQ = filters.q.trim() ? trFold(filters.q.trim()) : "";

  let statusWhere: any = { AND: [baseWhere, { status }] };
  if (status === "DONE" && filters.completedRange === "30d") {
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - 30);
    statusWhere = { AND: [baseWhere, { status }, { completedAt: { gte: cutoff } }] };
  }

  // DONE + Tümünü Göster + arama: pano bir arşiv değildir — DB'den yalnızca
  // en son tamamlanan DONE_ALL_SEARCH_CAP kaydı çekilir (bkz. dosya başı notu).
  const useSearchCap = status === "DONE" && filters.completedRange === "all" && !!trimmedQ;
  // DONE + Tümünü Göster + aramasız: gerçek DB seviyesinde sayfalama —
  // sınırsız geçmiş veri asla tek seferde belleğe çekilmez.
  const useDbPagination = status === "DONE" && filters.completedRange === "all" && !trimmedQ;

  if (useDbPagination) {
    const [total, rows] = await Promise.all([
      prisma.task.count({ where: statusWhere }),
      prisma.task.findMany({
        where: statusWhere,
        include: cardInclude,
        orderBy: [{ completedAt: "desc" }],
        skip: offset,
        take: limit,
      }),
    ]);
    (rows as BoardTaskRow[]).sort(boardComparator(now)); // sayfa içinde tam sıralama
    return { items: rows as BoardTaskRow[], total, hasMore: offset + rows.length < total };
  }

  const rows = await prisma.task.findMany({
    where: statusWhere,
    include: cardInclude,
    orderBy: [{ [status === "DONE" ? "completedAt" : "createdAt"]: "desc" }],
    ...(useSearchCap ? { take: DONE_ALL_SEARCH_CAP } : {}),
  });

  const filtered = trimmedQ ? (rows as BoardTaskRow[]).filter((r) => matchesSearch(r, trimmedQ)) : (rows as BoardTaskRow[]);
  filtered.sort(boardComparator(now));
  const items = filtered.slice(offset, offset + limit);
  const total = filtered.length;
  return { items, total, hasMore: offset + limit < total };
}

export interface BoardMeta {
  projects: { id: string; name: string }[];
  people: { id: string; name: string }[];
}

/**
 * Filtre seçenekleri (Proje/Kişi) — kullanıcının canViewTask kapsamındaki TÜM
 * görevlerinden türetilir (aktif hızlı görünüm/diğer filtrelerden bağımsız,
 * kararlı bir liste — #14/#15: yalnızca erişilebilir/görünür veriden).
 */
async function fetchBoardMeta(user: BoardQueryUser): Promise<BoardMeta> {
  const allVisibleWhere = buildTaskVisibilityWhereForUser(user);
  const [projectRows, peopleRows] = await Promise.all([
    prisma.task.findMany({
      where: { AND: [allVisibleWhere, { projectId: { not: null } }] } as any,
      select: { project: { select: { id: true, name: true } } },
      distinct: ["projectId"],
    }),
    prisma.task.findMany({
      where: { AND: [allVisibleWhere, { assignedToId: { not: null } }] } as any,
      select: { assignedTo: { select: { id: true, name: true } } },
      distinct: ["assignedToId"],
    }),
  ]);
  const projects = projectRows
    .map((r) => r.project)
    .filter((p): p is { id: string; name: string } => !!p)
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  const people = peopleRows
    .map((r) => r.assignedTo)
    .filter((p): p is { id: string; name: string } => !!p)
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  return { projects, people };
}

export interface BoardColumnPayload {
  status: BoardStatus;
  items: BoardTaskRow[];
  total: number;
  hasMore: boolean;
}

export interface BoardData {
  columns: BoardColumnPayload[];
  meta: BoardMeta;
}

/** Panonun tamamı — dört kolonun ilk sayfası + filtre seçenekleri. */
export async function fetchBoardData(user: BoardQueryUser, filters: BoardFilters): Promise<BoardData> {
  const now = new Date();
  const effectiveFilters: BoardFilters = { ...filters, department: user.isAdmin ? filters.department : "" };
  const baseWhere = buildBaseWhere(user, effectiveFilters);

  const [columnResults, meta] = await Promise.all([
    Promise.all(
      BOARD_STATUSES.map((status) => fetchStatusColumn(baseWhere, status, effectiveFilters, 0, BOARD_PAGE_SIZE, now))
    ),
    fetchBoardMeta(user),
  ]);

  // parent sızıntısı koruması — TÜM kolonlardaki satırlar için TEK sorguda
  const allItems = columnResults.flatMap((c) => c.items);
  const sanitized = await filterRelatedTaskVisibility(allItems as any, user);
  let cursor = 0;
  const columns: BoardColumnPayload[] = BOARD_STATUSES.map((status, i) => {
    const count = columnResults[i].items.length;
    const items = sanitized.slice(cursor, cursor + count) as unknown as BoardTaskRow[];
    cursor += count;
    return { status, items, total: columnResults[i].total, hasMore: columnResults[i].hasMore };
  });

  return { columns, meta };
}

/** Tek bir kolonun sonraki sayfası — "Daha Fazla Göster". */
export async function fetchBoardColumn(
  user: BoardQueryUser,
  filters: BoardFilters,
  status: BoardStatus,
  offset: number
): Promise<BoardColumnPayload> {
  const now = new Date();
  const effectiveFilters: BoardFilters = { ...filters, department: user.isAdmin ? filters.department : "" };
  const baseWhere = buildBaseWhere(user, effectiveFilters);
  const result = await fetchStatusColumn(baseWhere, status, effectiveFilters, offset, BOARD_PAGE_SIZE, now);
  const sanitized = await filterRelatedTaskVisibility(result.items as any, user);
  return { status, items: sanitized as unknown as BoardTaskRow[], total: result.total, hasMore: result.hasMore };
}
