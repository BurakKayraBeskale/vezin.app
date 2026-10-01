/**
 * Akıllı Takvim — CLIENT-SAFE sözleşme ve saf eşleme (prisma import etmez).
 *
 * Görev → takvim eşlemesi (tek kaynak, sunucu ve testler kullanır):
 *   start + due (start ≤ due) → "range": başlangıçtan son tarihe uzanan bar
 *   yalnız due               → "due":   yalnız son tarih gününde
 *   yalnız start             → "start": başlangıç gününde "Başlangıç" işaretli
 *   ikisi de yok             → takvimde YOK (createdAt'e yerleştirilmez)
 *   start > due (eski veri)  → "due" (son tarih esas alınır)
 *   start = due              → "due" (tek gün)
 *
 * Tarihler tarih-yalnız "YYYY-MM-DD" (UTC gece yarısı saklanır).
 */

import { utcDateKey } from "@/lib/holidays";
import type { HolidayOccurrence } from "@/lib/holidays";

export type CalendarTaskKind = "range" | "due" | "start";

export interface CalendarTaskSpan {
  kind: CalendarTaskKind;
  start: string;
  end: string;
}

export function taskCalendarSpan(startDate: Date | null, dueDate: Date | null): CalendarTaskSpan | null {
  const s = startDate ? utcDateKey(startDate) : null;
  const d = dueDate ? utcDateKey(dueDate) : null;
  if (s && d) return s < d ? { kind: "range", start: s, end: d } : { kind: "due", start: d, end: d };
  if (d) return { kind: "due", start: d, end: d };
  if (s) return { kind: "start", start: s, end: s };
  return null;
}

/** Takvim isteğinde izin verilen en geniş aralık (6 haftalık ay ızgarası + pay). */
export const CALENDAR_MAX_RANGE_DAYS = 62;
/** Tek istekte dönen en fazla görev (aşılırsa truncated=true). */
export const CALENDAR_TASK_CAP = 500;

// ── API yanıtı (GET /api/dashboard/calendar) ─────────────────────────────────

export interface CalendarTaskDTO {
  id: string;
  title: string;
  status: "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";
  priority: "LOW" | "MEDIUM" | "HIGH";
  kind: CalendarTaskKind;
  start: string;
  end: string;
  /** Orijinal alanlar (popover metni için) */
  startDate: string | null;
  dueDate: string | null;
  assignee: string | null;
  project: string | null;
}

export interface CalendarLeaveDTO {
  id: string;
  start: string;
  end: string;
  /**
   * null → viewer bu izin kaydının ayrıntısını görmeye yetkili değil; yalnız
   * "İzinli" gösterilir (tür/not/durum sızmaz, tıklama yönlendirmez).
   */
  detail: { typeLabel: string; statusLabel: string; days: number; href: string } | null;
}

export interface DashboardCalendarDTO {
  person: { id: string };
  range: { from: string; to: string };
  tasks: CalendarTaskDTO[];
  truncated: boolean;
  leaves: CalendarLeaveDTO[];
  holidays: HolidayOccurrence[];
}
