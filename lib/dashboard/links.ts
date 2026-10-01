/**
 * Dashboard drill-down sözleşmesi — CLIENT-SAFE (prisma import etmez).
 *
 * Her KPI / dağılım / "Tümünü Gör" için Görev Takip (/board) filtre nesnesi
 * BURADA tanımlanır. Aynı nesne iki yerde kullanılır:
 *   1. Linkin kendisi (boardHref → /board?view=all&personId=…&overdue=yes …)
 *   2. Dashboard sayısı (lib/dashboard/service.ts → buildBoardBaseWhere +
 *      boardStatusWhere; Görev Takip'in kendi sorgu motoru)
 * Böylece kartta görünen sayı ile tıklanınca açılan listenin toplamı AYNI
 * tanımdan gelir (Dashboard ≠ Görev Takip sapması olamaz).
 */

import {
  BOARD_STATUSES,
  boardFiltersToParams,
  type BoardFilters,
  type BoardStatus,
} from "@/lib/task-board-query";

/** "Bugün & Yaklaşan İşler" ufku (gün). */
export const DASHBOARD_UPCOMING_DAYS = 7;

export const OPEN_STATUSES: BoardStatus[] = ["TODO", "IN_PROGRESS", "REVIEW"];

export type DashboardKpiKey = "open" | "overdue" | "review" | "doneThisWeek";

/** Görev Takip varsayılanları üzerine yama — "Tüm Görevler" görünümü (kişi filtresiyle daraltılır). */
function boardFilters(patch: Partial<BoardFilters>): BoardFilters {
  return {
    view: "all",
    q: "",
    projectId: "",
    personId: "",
    priority: "",
    overdue: "",
    department: "",
    completedRange: "30d",
    reviewerId: "",
    statuses: [],
    dueWithinDays: null,
    ...patch,
  };
}

/** Dört ana KPI kartının Görev Takip filtreleri. */
export function kpiBoardFilters(personId: string): Record<DashboardKpiKey, BoardFilters> {
  return {
    // Açık: atanan = kişi, durum ∈ {Yapılacak, Devam Ediyor, İncelemede}
    open: boardFilters({ personId, statuses: OPEN_STATUSES }),
    // Geciken: atanan = kişi, tamamlanmamış, son tarihi geçmiş (Görev Takip "Gecikmiş" filtresi)
    overdue: boardFilters({ personId, overdue: "yes" }),
    // İncelemesinde: reviewOwner = kişi (created_by DEĞİL), durum = İncelemede
    review: boardFilters({ reviewerId: personId, statuses: ["REVIEW"] }),
    // Bu hafta tamamlanan: atanan = kişi, completedAt bu takvim haftasında
    doneThisWeek: boardFilters({ personId, statuses: ["DONE"], completedRange: "week" }),
  };
}

/** Görev Dağılımı — her durum için ayrı drill-down (Tamamlandı tüm zamanlar). */
export function distributionBoardFilters(personId: string): Record<BoardStatus, BoardFilters> {
  return Object.fromEntries(
    BOARD_STATUSES.map((s) => [s, boardFilters({ personId, statuses: [s], completedRange: s === "DONE" ? "all" : "30d" })])
  ) as Record<BoardStatus, BoardFilters>;
}

/** "Bugün & Yaklaşan İşler → Tümünü Gör": gecikmişler + önümüzdeki N gün. */
export function upcomingBoardFilters(personId: string): BoardFilters {
  return boardFilters({ personId, statuses: OPEN_STATUSES, dueWithinDays: DASHBOARD_UPCOMING_DAYS });
}

/**
 * Akıllı Takvim'in görev kapsamı: atanan = kişi, tüm durumlar (tarih koşulu
 * lib/dashboard/calendar-service.ts'te eklenir). KPI'larla aynı kişi tanımı.
 */
export function calendarBoardFilters(personId: string): BoardFilters {
  return boardFilters({ personId, completedRange: "all" });
}

export function boardHref(filters: BoardFilters): string {
  return `/board?${boardFiltersToParams(filters).toString()}`;
}

export function projectHref(projectId: string): string {
  return `/projeler/${projectId}`;
}

/** Projeler modülü — kişinin üyesi olduğu projeler filtresi (?member=). */
export function projectsForMemberHref(personId: string): string {
  return `/projeler?member=${encodeURIComponent(personId)}`;
}
