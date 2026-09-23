/**
 * Görev Takip (Kanban) ekranının client-safe tipleri.
 * lib/task-board.ts'deki BoardTaskRow ile aynı şekli, prisma bağımlılığı olmadan taşır.
 */

export type BoardStatus = "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";
export type BoardQuickView = "mine" | "given" | "all";
export type BoardOverdueFilter = "" | "yes" | "no";
export type BoardCompletedRange = "30d" | "all";

export type BoardTaskParent = { id: string; title: string } | { restricted: true } | null;

export interface BoardTask {
  id: string;
  title: string;
  description: string | null;
  status: BoardStatus;
  priority: "LOW" | "MEDIUM" | "HIGH";
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  reviewOwnerId: string | null;
  assignedToId: string | null;
  assignedTo: { id: string; name: string } | null;
  projectId: string | null;
  project: { id: string; name: string; department: string } | null;
  departmentId: string | null;
  parent: BoardTaskParent;
}

export interface BoardColumnState {
  status: BoardStatus;
  items: BoardTask[];
  total: number;
  hasMore: boolean;
}

export interface BoardMeta {
  projects: { id: string; name: string }[];
  people: { id: string; name: string }[];
}

export interface BoardData {
  columns: BoardColumnState[];
  meta: BoardMeta;
}

export interface BoardFilters {
  view: BoardQuickView;
  q: string;
  projectId: string;
  personId: string;
  priority: string;
  overdue: BoardOverdueFilter;
  department: string;
  completedRange: BoardCompletedRange;
}

export const BOARD_COLUMN_DEFS: { id: BoardStatus; label: string; color: string; bg: string; darkBg: string; ring: string }[] = [
  { id: "TODO",        label: "Yapılacak",    color: "#6B7280", bg: "#F3F4F6", darkBg: "rgba(107,114,128,0.12)", ring: "ring-gray-300" },
  { id: "IN_PROGRESS", label: "Devam Ediyor", color: "#F57C28", bg: "#FFF3E9", darkBg: "rgba(245,124,40,0.12)",  ring: "ring-[#F57C28]/40" },
  { id: "REVIEW",      label: "İncelemede",   color: "#6366F1", bg: "#EEF2FF", darkBg: "rgba(99,102,241,0.12)",  ring: "ring-indigo-300" },
  { id: "DONE",        label: "Tamamlandı",   color: "#10B981", bg: "#ECFDF5", darkBg: "rgba(16,185,129,0.12)",  ring: "ring-emerald-300" },
];

export const DEPARTMENT_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "OUTSOURCE", label: "Outsource" },
  { value: "BAGIMSIZ_DENETIM", label: "Bağımsız Denetim" },
  { value: "MUHASEBE", label: "Muhasebe" },
  { value: "YMM", label: "YMM" },
];

export function isOverdueTask(t: Pick<BoardTask, "dueDate" | "status">): boolean {
  return !!t.dueDate && t.status !== "DONE" && new Date(t.dueDate) < new Date();
}
