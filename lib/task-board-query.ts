/**
 * Görev Takip (/board) filtre sözleşmesi — CLIENT-SAFE (prisma import etmez).
 *
 * Görev Takip sayfası, /api/tasks/board ve Dashboard drill-down linkleri
 * (lib/dashboard/links.ts) aynı parse/serialize fonksiyonlarını ve aynı tarih
 * sınırlarını kullanır; böylece Dashboard sayısı ile tıklanınca açılan Görev
 * Takip görünümü aynı tanımdan gelir. Sorgu motoru: lib/task-board.ts.
 */

export const BOARD_STATUSES = ["TODO", "IN_PROGRESS", "REVIEW", "DONE"] as const;
export type BoardStatus = (typeof BOARD_STATUSES)[number];

export type BoardQuickView = "mine" | "given" | "all";
export type BoardOverdueFilter = "" | "yes" | "no";
export type BoardCompletedRange = "30d" | "week" | "all";

// ── Tarih sınırları (Türkiye, UTC+3, yaz saati yok) — Dashboard da bunları kullanır ──

const TR_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Türkiye'de bugünün 00:00'ı (UTC Date olarak). */
export function istanbulDayStart(now: Date = new Date()): Date {
  const tr = new Date(now.getTime() + TR_OFFSET_MS);
  return new Date(Date.UTC(tr.getUTCFullYear(), tr.getUTCMonth(), tr.getUTCDate()) - TR_OFFSET_MS);
}

/** İçinde bulunulan takvim haftasının başlangıcı — Türkiye'de Pazartesi 00:00. */
export function currentWeekStart(now: Date = new Date()): Date {
  const dayStart = istanbulDayStart(now);
  const trDow = new Date(dayStart.getTime() + TR_OFFSET_MS).getUTCDay(); // 0=Pazar
  return new Date(dayStart.getTime() - ((trDow + 6) % 7) * DAY_MS);
}

/** "Önümüzdeki N gün içinde son tarihi olan" için üst sınır (hariç): bugün+N+1 günün 00:00'ı. */
export function dueWithinDaysEnd(days: number, now: Date = new Date()): Date {
  return new Date(istanbulDayStart(now).getTime() + (days + 1) * DAY_MS);
}

export const DUE_WITHIN_DAYS_MAX = 60;

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
  /** DONE kolonu: son 30 gün | bu takvim haftası (completedAt) | tümü */
  completedRange: BoardCompletedRange;
  /** "" = tümü, aksi halde reviewOwnerId (Dashboard "İncelemesinde Bekleyenler") */
  reviewerId: string;
  /** boş = dört kolon; doluysa yalnız bu durum kolonları (Dashboard drill-down) */
  statuses: BoardStatus[];
  /** null = tümü; N → tamamlanmamış ve son tarihi bugün+N gün sonuna kadar (gecikmişler dahil) */
  dueWithinDays: number | null;
}

/**
 * URL sözleşmesi — Görev Takip (/board) sayfası, /api/tasks/board ve Dashboard
 * drill-down linkleri (lib/dashboard/links.ts) aynı parametreleri kullanır:
 *   view, q, projectId, personId, priority, overdue, department, completedRange,
 *   reviewerId, status (virgülle ayrılmış TODO|IN_PROGRESS|REVIEW|DONE), dueWithinDays
 */
export function parseBoardFilters(params: URLSearchParams): BoardFilters {
  const view = params.get("view");
  const completedRange = params.get("completedRange");
  const statuses = (params.get("status") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is BoardStatus => (BOARD_STATUSES as readonly string[]).includes(s));
  const dueWithin = Number(params.get("dueWithinDays"));
  return {
    view: view === "given" || view === "all" ? view : "mine",
    q: params.get("q") ?? "",
    projectId: params.get("projectId") ?? "",
    personId: params.get("personId") ?? "",
    priority: params.get("priority") ?? "",
    overdue: params.get("overdue") === "yes" || params.get("overdue") === "no" ? (params.get("overdue") as BoardOverdueFilter) : "",
    department: params.get("department") ?? "",
    completedRange: completedRange === "all" || completedRange === "week" ? completedRange : "30d",
    reviewerId: params.get("reviewerId") ?? "",
    statuses: [...new Set(statuses)],
    dueWithinDays:
      Number.isInteger(dueWithin) && dueWithin >= 0 && dueWithin <= DUE_WITHIN_DAYS_MAX && params.get("dueWithinDays") !== null
        ? dueWithin
        : null,
  };
}

/** parseBoardFilters'ın tersi — yalnız varsayılandan farklı alanlar yazılır. */
export function boardFiltersToParams(filters: Partial<BoardFilters>): URLSearchParams {
  const p = new URLSearchParams();
  if (filters.view) p.set("view", filters.view);
  if (filters.q) p.set("q", filters.q);
  if (filters.projectId) p.set("projectId", filters.projectId);
  if (filters.personId) p.set("personId", filters.personId);
  if (filters.priority) p.set("priority", filters.priority);
  if (filters.overdue) p.set("overdue", filters.overdue);
  if (filters.department) p.set("department", filters.department);
  if (filters.completedRange) p.set("completedRange", filters.completedRange);
  if (filters.reviewerId) p.set("reviewerId", filters.reviewerId);
  if (filters.statuses && filters.statuses.length > 0) p.set("status", filters.statuses.join(","));
  if (filters.dueWithinDays !== null && filters.dueWithinDays !== undefined) p.set("dueWithinDays", String(filters.dueWithinDays));
  return p;
}
