/**
 * Dashboard client tipleri — GET /api/dashboard ve /api/dashboard/people yanıtları
 * (tarihler ISO metin). Kaynak: lib/dashboard/service.ts, lib/dashboard/people.ts.
 */

export type DashboardStatus = "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";
export type DashboardKpiKey = "open" | "overdue" | "review" | "doneThisWeek";
export type UpcomingGroup = "overdue" | "today" | "upcoming";

export interface DashboardPersonDTO {
  id: string;
  name: string;
  title: string;
  department: string;
}

export interface DashboardCountDTO {
  count: number;
  href: string;
}

export interface DashboardSummaryDTO {
  person: { id: string; name: string; isSelf: boolean };
  kpis: Record<DashboardKpiKey, DashboardCountDTO>;
  distribution: { status: DashboardStatus; count: number; href: string }[];
  pending: { key: string; label: string; count: number; href: string }[];
  upcoming: {
    items: {
      id: string;
      title: string;
      status: DashboardStatus;
      priority: "LOW" | "MEDIUM" | "HIGH";
      dueDate: string;
      project: { id: string; name: string } | null;
      group: UpcomingGroup;
    }[];
    total: number;
    href: string;
  };
  projects: {
    items: {
      id: string;
      name: string;
      department: string;
      overdueCount: number;
      openCount: number;
      nextDueDate: string | null;
      endDate: string | null;
      href: string;
    }[];
    total: number;
    href: string;
  };
  finance: {
    receivable: { amount: number; count: number };
    refund: { amount: number; count: number };
    inApproval: { amount: number; count: number } | null;
    href: string;
  } | null;
  generatedAt: string;
}
