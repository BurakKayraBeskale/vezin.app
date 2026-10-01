"use client";

/**
 * Akıllı Takvim (Dashboard B bloğu) — görüntüleme + gezinme + drill-down.
 *
 * Kişi: Dashboard'un master state'i (selectedDashboardUser) — ayrı kişi/yetki
 * mantığı YOK. Veri: GET /api/dashboard/calendar (lib/dashboard/calendar-service.ts),
 * viewer'ın görünürlüğüyle filtrelenmiş. Kişi değişince eski kişinin etkinlikleri
 * hemen kaldırılır, önceki istek iptal edilir (A bloğundaki desen).
 *
 * Etkinlikler: Görev (durum renginde bar; yalnız başlangıç = kesikli "Başlangıç"),
 * Onaylı İzin (yeşil "İzinli"), Resmî Tatil (hücre zemini + ad, sakin mavi).
 * Sürükle-bırak YOK: tarih değişikliği Görev Detayı → Düzenle ile yapılır.
 * Görev tıklaması ortak TaskDetail'i açar (Görev Takip'e yönlendirmez).
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { BOARD_COLUMN_DEFS } from "@/components/board/types";
import { PRIORITY_OPTIONS } from "@/lib/task-fields";
import { holidayDayTypeText, type HolidayOccurrence } from "@/lib/holidays";
import type { CalendarLeaveDTO, CalendarTaskDTO, DashboardCalendarDTO } from "@/lib/dashboard/calendar";
import {
  eventsOnDay,
  formatKeyTR,
  keyDay,
  keyMonth0,
  keyWeekdayMon0,
  layoutWeek,
  monthGridKeys,
  todayKeyTR,
  type WeekSegment,
} from "./calendarLayout";
import { Panel } from "./DashboardSections";

const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const WEEKDAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
/** Hücre başına görünen bar şeridi; fazlası "+N daha" */
const MAX_LANES = 3;
const FILTER_STORAGE_KEY = "vezin.dashboard.calendar.filters";

type FilterKey = "tasks" | "leaves" | "holidays";
type Filters = Record<FilterKey, boolean>;
const DEFAULT_FILTERS: Filters = { tasks: true, leaves: true, holidays: true };

type CalEvent =
  | { type: "task"; id: string; start: string; end: string; task: CalendarTaskDTO }
  | { type: "leave"; id: string; start: string; end: string; leave: CalendarLeaveDTO };

type Popover =
  | { kind: "day"; key: string; rect: DOMRect }
  | { kind: "leave"; leave: CalendarLeaveDTO; rect: DOMRect }
  | { kind: "holiday"; key: string; rect: DOMRect };

type Hover = { event: CalEvent; rect: DOMRect } | null;

export interface CalendarMonth {
  year: number;
  month0: number;
}

/** Türkiye'de içinde bulunulan ay. */
export function currentCalendarMonth(): CalendarMonth {
  const [y, m] = todayKeyTR().split("-").map(Number);
  return { year: y, month0: m - 1 };
}

// ── Görsel tanımlar ──────────────────────────────────────────────────────────

/** Görev bar renkleri — yeşil İZİNE ayrıldığı için Tamamlandı burada gri/soluk. */
const TASK_STYLE: Record<CalendarTaskDTO["status"], { bg: string; text: string; border: string }> = {
  TODO: { bg: "var(--badge-gray-bg)", text: "var(--text-main)", border: "var(--badge-gray-border)" },
  IN_PROGRESS: { bg: "var(--badge-orange-bg)", text: "var(--badge-orange-text)", border: "var(--badge-orange-border)" },
  REVIEW: { bg: "var(--badge-indigo-bg)", text: "var(--badge-indigo-text)", border: "var(--badge-indigo-border)" },
  DONE: { bg: "var(--badge-gray-bg)", text: "var(--text-muted)", border: "var(--badge-gray-border)" },
};

const LEAVE_STYLE = { bg: "var(--badge-emerald-bg)", text: "var(--badge-emerald-text)", border: "var(--badge-emerald-border)" };

const statusLabel = (s: string) => BOARD_COLUMN_DEFS.find((c) => c.id === s)?.label ?? s;
const priorityLabel = (p: string) => PRIORITY_OPTIONS.find((o) => o.value === p)?.label ?? p;

function isOverdue(t: CalendarTaskDTO, todayKey: string) {
  return t.status !== "DONE" && !!t.dueDate && t.dueDate < todayKey;
}

function taskDateText(t: CalendarTaskDTO): string {
  if (t.kind === "range") return `${formatKeyTR(t.start)} – ${formatKeyTR(t.end)}`;
  if (t.kind === "start") return `Başlangıç: ${formatKeyTR(t.start)} (son tarih yok)`;
  return `Son tarih: ${formatKeyTR(t.end)}`;
}

function leaveDateText(l: CalendarLeaveDTO): string {
  return l.start === l.end ? formatKeyTR(l.start) : `${formatKeyTR(l.start)} – ${formatKeyTR(l.end)}`;
}

function FlagIcon() {
  return (
    <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path d="M4 2a1 1 0 00-1 1v15a1 1 0 102 0v-5h4.38l.72 1.45A1 1 0 0011 15h5a1 1 0 001-1V6a1 1 0 00-1-1h-4.38l-.72-1.45A1 1 0 0010 3H5V3a1 1 0 00-1-1z" />
    </svg>
  );
}

function StartIcon() {
  return (
    <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path d="M6.3 2.84A1 1 0 004.8 3.7v12.6a1 1 0 001.5.86l10.5-6.3a1 1 0 000-1.72L6.3 2.84z" />
    </svg>
  );
}

// ── Konumlu kutular (hover özeti, tıklama popover'ı) ─────────────────────────

function useFloatingPosition(rect: DOMRect, ref: React.RefObject<HTMLDivElement>) {
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: rect.bottom + 6, left: rect.left });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - w - 8));
    const below = rect.bottom + 6;
    const top = below + h > window.innerHeight - 8 ? Math.max(8, rect.top - h - 6) : below;
    setPos({ top, left });
  }, [rect, ref]);
  return pos;
}

function HoverCard({ hover, todayKey }: { hover: NonNullable<Hover>; todayKey: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const pos = useFloatingPosition(hover.rect, ref);
  const e = hover.event;
  return (
    <div
      ref={ref}
      role="tooltip"
      style={{ top: pos.top, left: pos.left }}
      className="fixed z-50 w-64 bg-white border border-gray-200 rounded-xl shadow-xl px-3.5 py-3 text-xs pointer-events-none"
    >
      {e.type === "task" ? (
        <>
          <p className="text-sm font-semibold text-gray-800 leading-snug line-clamp-2">{e.task.title}</p>
          <p className="mt-1.5 text-gray-600">
            {statusLabel(e.task.status)} · {priorityLabel(e.task.priority)} Öncelik
          </p>
          <p className={clsx("mt-0.5", isOverdue(e.task, todayKey) ? "text-red-600 font-semibold" : "text-gray-600")}>
            {taskDateText(e.task)}
            {isOverdue(e.task, todayKey) && " · Gecikmiş"}
          </p>
          {e.task.assignee && <p className="mt-0.5 text-gray-500">Atanan: {e.task.assignee}</p>}
          {e.task.project && <p className="mt-0.5 text-gray-400 truncate">Proje: {e.task.project}</p>}
        </>
      ) : (
        <>
          <p className="text-sm font-semibold" style={{ color: LEAVE_STYLE.text }}>
            İzinli{e.leave.detail ? ` · ${e.leave.detail.typeLabel}` : ""}
          </p>
          <p className="mt-1.5 text-gray-600">{leaveDateText(e.leave)}</p>
          {e.leave.detail && <p className="mt-0.5 text-gray-500">Durum: {e.leave.detail.statusLabel}</p>}
        </>
      )}
    </div>
  );
}

function PopoverPanel({ rect, onClose, children, label }: { rect: DOMRect; onClose: () => void; children: React.ReactNode; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const pos = useFloatingPosition(rect, ref);
  useEffect(() => {
    function onDown(ev: MouseEvent) {
      if (ref.current && !ref.current.contains(ev.target as Node)) onClose();
    }
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") onClose();
    }
    function onScroll() {
      onClose();
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [onClose]);
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={label}
      style={{ top: pos.top, left: pos.left }}
      className="fixed z-50 w-72 max-h-80 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-xl text-xs"
    >
      {children}
    </div>
  );
}

function HolidayLines({ holidays }: { holidays: HolidayOccurrence[] }) {
  return (
    <>
      {holidays.map((h) => (
        <div key={h.holidayId} className="px-3.5 py-2.5" style={{ backgroundColor: "var(--cal-holiday-bg)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--cal-holiday-text)" }}>{h.name}</p>
          <p className="mt-0.5 text-gray-600">
            {formatKeyTR(h.date)} · Resmî Tatil · {holidayDayTypeText(h.dayType, h.halfDayPeriod)}
          </p>
          {h.description && <p className="mt-0.5 text-gray-500">{h.description}</p>}
        </div>
      ))}
    </>
  );
}

// ── Ana bileşen ──────────────────────────────────────────────────────────────

export default function SmartCalendar({
  personId,
  isSelf,
  personName,
  refreshKey,
  month,
  onMonthChange,
  onOpenTask,
}: {
  personId: string;
  isSelf: boolean;
  personName: string;
  /** Görev güncellemesi / sekmeye dönüş sonrası sessiz tazeleme için artan sayaç */
  refreshKey: number;
  /** Gösterilen ay — Dashboard tutar ki kişi değişiminde ay korunsun */
  month: CalendarMonth;
  onMonthChange: (m: CalendarMonth) => void;
  onOpenTask: (taskId: string) => void;
}) {
  const router = useRouter();
  const todayKey = useMemo(() => todayKeyTR(), []);
  const cursor = month;
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [data, setData] = useState<DashboardCalendarDTO | null>(null);
  const [error, setError] = useState("");
  const [hover, setHover] = useState<Hover>(null);
  const [popover, setPopover] = useState<Popover | null>(null);
  const [canHover, setCanHover] = useState(false);

  const grid = useMemo(() => monthGridKeys(cursor.year, cursor.month0), [cursor]);
  const from = grid[0];
  const to = grid[grid.length - 1];

  // Filtre tercihi — yalnız bu tarayıcıda, okunamazsa varsayılan
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(FILTER_STORAGE_KEY) ?? "null");
      if (saved && typeof saved === "object") setFilters({ ...DEFAULT_FILTERS, ...saved });
    } catch {
      /* yok say */
    }
    try {
      setCanHover(window.matchMedia("(hover: hover) and (pointer: fine)").matches);
    } catch {
      /* yok say */
    }
  }, []);

  function toggleFilter(k: FilterKey) {
    setFilters((prev) => {
      const next = { ...prev, [k]: !prev[k] };
      try {
        window.localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* yok say */
      }
      return next;
    });
  }

  // ── Veri: kişi / ay / tazeleme ─────────────────────────────────────────────
  const requestSeq = useRef(0);
  const inflight = useRef<AbortController | null>(null);
  const lastQuery = useRef("");

  const load = useCallback(async (silent: boolean) => {
    inflight.current?.abort();
    const controller = new AbortController();
    inflight.current = controller;
    const seq = ++requestSeq.current;
    if (!silent) setData(null);
    setError("");
    try {
      const qs = new URLSearchParams({ userId: personId, from, to });
      const res = await fetch(`/api/dashboard/calendar?${qs}`, { signal: controller.signal });
      const body = await res.json().catch(() => null);
      if (seq !== requestSeq.current) return;
      if (!res.ok) {
        setError(body?.error ?? "Takvim yüklenemedi");
        return;
      }
      setData(body);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      if (seq === requestSeq.current) setError("Sunucuya ulaşılamadı");
    }
  }, [personId, from, to]);

  useEffect(() => {
    const query = `${personId}|${from}|${to}`;
    // Kişi/ay değiştiyse eski etkinlikler hemen kalkar; yalnız refreshKey değiştiyse sessiz tazele
    const silent = query === lastQuery.current;
    lastQuery.current = query;
    setHover(null);
    setPopover(null);
    load(silent);
  }, [load, personId, from, to, refreshKey]);

  useEffect(() => () => inflight.current?.abort(), []);

  // Yalnız istenen kişi + aralığa ait yanıt çizilir (yarış koşulu koruması)
  const shown = data && data.person.id === personId && data.range.from === from && data.range.to === to ? data : null;

  const events: CalEvent[] = useMemo(() => {
    if (!shown) return [];
    const out: CalEvent[] = [];
    // İzinler önce: hücrenin üstünde "İzinli" görünür
    if (filters.leaves) for (const l of shown.leaves) out.push({ type: "leave", id: `leave-${l.id}`, start: l.start, end: l.end, leave: l });
    if (filters.tasks) for (const t of shown.tasks) out.push({ type: "task", id: `task-${t.id}`, start: t.start, end: t.end, task: t });
    return out;
  }, [shown, filters.leaves, filters.tasks]);

  const holidaysByDay = useMemo(() => {
    const map = new Map<string, HolidayOccurrence[]>();
    if (!shown || !filters.holidays) return map;
    for (const h of shown.holidays) map.set(h.date, [...(map.get(h.date) ?? []), h]);
    return map;
  }, [shown, filters.holidays]);

  const weeks = useMemo(
    () =>
      Array.from({ length: grid.length / 7 }, (_, w) => {
        const keys = grid.slice(w * 7, w * 7 + 7);
        return { keys, ...layoutWeek(keys, events, MAX_LANES) };
      }),
    [grid, events]
  );

  function shiftMonth(delta: number) {
    const d = new Date(Date.UTC(cursor.year, cursor.month0 + delta, 1));
    onMonthChange({ year: d.getUTCFullYear(), month0: d.getUTCMonth() });
  }
  function goToday() {
    onMonthChange(currentCalendarMonth());
  }

  function activate(ev: CalEvent, rect: DOMRect) {
    setHover(null);
    if (ev.type === "task") {
      setPopover(null);
      onOpenTask(ev.task.id);
      return;
    }
    // İzin: yetkiliyse ilgili kayda git; değilse yalnız "İzinli" bilgisi
    if (ev.leave.detail) {
      router.push(ev.leave.detail.href);
      return;
    }
    setPopover({ kind: "leave", leave: ev.leave, rect });
  }

  const hoverHandlers = (ev: CalEvent) =>
    canHover
      ? {
          onMouseEnter: (e: React.MouseEvent<HTMLElement>) => setHover({ event: ev, rect: e.currentTarget.getBoundingClientRect() }),
          onMouseLeave: () => setHover(null),
        }
      : {};

  function eventAriaLabel(ev: CalEvent): string {
    if (ev.type === "task") {
      const kind = ev.task.kind === "start" ? "Başlangıç" : ev.task.kind === "due" ? "Son tarih" : "Görev";
      return `${kind}: ${ev.task.title}, ${statusLabel(ev.task.status)}, ${taskDateText(ev.task)}. Görev detayını aç.`;
    }
    return `İzinli${ev.leave.detail ? `, ${ev.leave.detail.typeLabel}` : ""}, ${leaveDateText(ev.leave)}`;
  }

  // ── Çizim ──────────────────────────────────────────────────────────────────

  function renderBar(seg: WeekSegment<CalEvent>, weekKey: string) {
    const ev = seg.event;
    const style =
      ev.type === "leave"
        ? LEAVE_STYLE
        : TASK_STYLE[ev.task.status];
    const isStart = ev.type === "task" && ev.task.kind === "start";
    const overdue = ev.type === "task" && isOverdue(ev.task, todayKey);
    return (
      <button
        key={`${ev.id}-${weekKey}`}
        type="button"
        aria-label={eventAriaLabel(ev)}
        onClick={(e) => activate(ev, e.currentTarget.getBoundingClientRect())}
        {...hoverHandlers(ev)}
        style={{
          gridColumn: `${seg.colStart + 1} / ${seg.colEnd + 2}`,
          gridRow: seg.lane + 1,
          backgroundColor: isStart ? "transparent" : style.bg,
          color: style.text,
          borderColor: style.border,
        }}
        className={clsx(
          "pointer-events-auto h-[19px] min-w-0 flex items-center gap-1 px-1.5 text-[11px] font-medium leading-none border text-left",
          "hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F57C28]/50 transition",
          isStart && "border-dashed",
          seg.continuesBefore ? "rounded-l-none border-l-0" : "rounded-l-md ml-0.5",
          seg.continuesAfter ? "rounded-r-none border-r-0" : "rounded-r-md mr-0.5",
          overdue && !seg.continuesBefore && "!border-l-2 !border-l-red-500",
          ev.type === "task" && ev.task.status === "DONE" && "opacity-70"
        )}
      >
        {ev.type === "leave" ? (
          <span className="truncate">
            İzinli{ev.leave.detail ? <span className="font-normal"> · {ev.leave.detail.typeLabel}</span> : null}
          </span>
        ) : (
          <>
            {ev.task.kind === "due" && <FlagIcon />}
            {isStart && <StartIcon />}
            {isStart && <span className="flex-shrink-0 font-semibold">Başlangıç:</span>}
            <span className={clsx("truncate", ev.task.status === "DONE" && "line-through")}>{ev.task.title}</span>
          </>
        )}
      </button>
    );
  }

  const dayPopoverEvents = popover?.kind === "day" ? eventsOnDay(events, popover.key) : [];

  return (
    <Panel
      title="Akıllı Takvim"
      subtitle={isSelf ? "Görevleriniz, onaylı izinleriniz ve resmî tatiller" : `${personName} — görevler, onaylı izinler ve resmî tatiller`}
      action={
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={goToday} className="px-2.5 py-1 rounded-lg text-xs font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50">
            Bugün
          </button>
          <button type="button" onClick={() => shiftMonth(-1)} aria-label="Önceki ay" className="w-7 h-7 rounded-lg text-gray-500 hover:bg-gray-100 flex items-center justify-center">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <span className="text-sm font-bold text-gray-800 w-28 text-center tabular-nums" aria-live="polite">
            {MONTHS[cursor.month0]} {cursor.year}
          </span>
          <button type="button" onClick={() => shiftMonth(1)} aria-label="Sonraki ay" className="w-7 h-7 rounded-lg text-gray-500 hover:bg-gray-100 flex items-center justify-center">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      }
    >
      {/* Filtreler + açıklama */}
      <div className="px-5 pt-3 pb-2 flex flex-wrap items-center gap-2">
        {(
          [
            { k: "tasks", label: "Görevler", swatch: { backgroundColor: "var(--badge-orange-bg)", borderColor: "var(--badge-orange-border)" } },
            { k: "leaves", label: "İzinler", swatch: { backgroundColor: LEAVE_STYLE.bg, borderColor: LEAVE_STYLE.border } },
            { k: "holidays", label: "Resmî Tatiller", swatch: { backgroundColor: "var(--cal-holiday-bg)", borderColor: "var(--cal-holiday-border)" } },
          ] as { k: FilterKey; label: string; swatch: React.CSSProperties }[]
        ).map((f) => (
          <button
            key={f.k}
            type="button"
            aria-pressed={filters[f.k]}
            onClick={() => toggleFilter(f.k)}
            className={clsx(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition",
              filters[f.k] ? "border-gray-300 text-gray-700" : "border-gray-200 text-gray-400 line-through"
            )}
          >
            <span className="w-2.5 h-2.5 rounded-sm border" style={f.swatch} aria-hidden />
            {f.label}
          </button>
        ))}
        <span className="ml-auto hidden md:flex items-center gap-3 text-[11px] text-gray-400">
          <span className="flex items-center gap-1"><FlagIcon /> Son tarih</span>
          <span className="flex items-center gap-1"><StartIcon /> Yalnız başlangıç</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2.5 border-l-2 border-red-500" aria-hidden /> Gecikmiş</span>
        </span>
      </div>

      {error && <p className="mx-5 mb-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
      {shown?.truncated && (
        <p className="mx-5 mb-2 text-[11px] text-gray-500">Bu ayda çok sayıda görev var; ilk {shown.tasks.length} görev gösteriliyor.</p>
      )}

      <div className="overflow-x-auto">
        <div className="min-w-[720px] px-3 pb-3" aria-busy={!shown}>
          <div className="grid grid-cols-7 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
            {WEEKDAYS.map((d) => (
              <div key={d} className="px-2 py-1.5">{d}</div>
            ))}
          </div>
          <div className={clsx("rounded-xl border border-gray-100 overflow-hidden", !shown && "animate-pulse")}>
            {weeks.map((week, wi) => (
              <div key={week.keys[0]} className={clsx("relative", wi > 0 && "border-t border-gray-100")}>
                {/* Gün hücreleri (zemin) */}
                <div className="grid grid-cols-7">
                  {week.keys.map((key, di) => {
                    const inMonth = keyMonth0(key) === cursor.month0;
                    const holidays = holidaysByDay.get(key) ?? [];
                    const isHoliday = holidays.length > 0;
                    const weekend = keyWeekdayMon0(key) >= 5;
                    const isToday = key === todayKey;
                    return (
                      <div
                        key={key}
                        className={clsx("h-[116px] px-1.5 pt-1 min-w-0", di > 0 && "border-l border-gray-100")}
                        style={{ backgroundColor: isHoliday ? "var(--cal-holiday-bg)" : weekend ? "var(--cal-weekend-bg)" : undefined }}
                      >
                        <div className="flex items-center gap-1 h-[20px] min-w-0">
                          <span
                            className={clsx(
                              "flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] tabular-nums",
                              isToday ? "bg-[#F57C28] text-white font-bold" : inMonth ? "text-gray-700 font-semibold" : "text-gray-300"
                            )}
                            aria-label={isToday ? `Bugün, ${formatKeyTR(key)}` : undefined}
                          >
                            {keyDay(key)}
                          </span>
                          {isHoliday && (
                            <button
                              type="button"
                              onClick={(e) => setPopover({ kind: "holiday", key, rect: e.currentTarget.getBoundingClientRect() })}
                              className={clsx("min-w-0 truncate text-[10px] font-semibold text-left hover:underline", !inMonth && "opacity-60")}
                              style={{ color: "var(--cal-holiday-text)" }}
                              title={holidays.map((h) => `${h.name} — Resmî Tatil (${holidayDayTypeText(h.dayType, h.halfDayPeriod)})`).join("\n")}
                            >
                              {holidays[0].dayType === "HALF" ? "½ " : ""}
                              {holidays[0].name}
                              {holidays.length > 1 ? ` +${holidays.length - 1}` : ""}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Etkinlik barları */}
                <div
                  className="absolute inset-x-0 top-[24px] grid grid-cols-7 gap-y-[3px] pointer-events-none"
                  style={{ gridAutoRows: "19px" }}
                >
                  {week.segments.map((seg) => renderBar(seg, week.keys[0]))}
                  {week.hiddenByDay.map((n, di) =>
                    n > 0 ? (
                      <button
                        key={`more-${di}`}
                        type="button"
                        onClick={(e) => setPopover({ kind: "day", key: week.keys[di], rect: e.currentTarget.getBoundingClientRect() })}
                        style={{ gridColumn: di + 1, gridRow: MAX_LANES + 1 }}
                        className="pointer-events-auto mx-1 text-left text-[11px] font-semibold text-gray-500 hover:text-[#F57C28] hover:underline"
                      >
                        +{n} daha
                      </button>
                    ) : null
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-gray-400">
            Takvim yalnız görüntüleme içindir; görev tarihini değiştirmek için görevi açıp <strong>Düzenle</strong>&apos;yi kullanın.
            {!isSelf && " Yalnız sizin görebildiğiniz görevler gösterilir."}
          </p>
        </div>
      </div>

      {hover && !popover && <HoverCard hover={hover} todayKey={todayKey} />}

      {popover?.kind === "day" && (
        <PopoverPanel rect={popover.rect} onClose={() => setPopover(null)} label={`${formatKeyTR(popover.key)} etkinlikleri`}>
          <p className="px-3.5 pt-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{formatKeyTR(popover.key)}</p>
          <HolidayLines holidays={holidaysByDay.get(popover.key) ?? []} />
          <ul className="py-1">
            {dayPopoverEvents.map((ev) => (
              <li key={ev.id}>
                <button
                  type="button"
                  onClick={(e) => activate(ev, e.currentTarget.getBoundingClientRect())}
                  className="w-full text-left px-3.5 py-2 hover:bg-gray-50 flex items-start gap-2"
                >
                  <span
                    className="mt-1 w-2 h-2 rounded-sm border flex-shrink-0"
                    style={ev.type === "leave" ? { backgroundColor: LEAVE_STYLE.bg, borderColor: LEAVE_STYLE.border } : { backgroundColor: TASK_STYLE[ev.task.status].bg, borderColor: TASK_STYLE[ev.task.status].border }}
                    aria-hidden
                  />
                  <span className="min-w-0">
                    {ev.type === "leave" ? (
                      <>
                        <span className="block font-semibold" style={{ color: LEAVE_STYLE.text }}>
                          İzinli{ev.leave.detail ? ` · ${ev.leave.detail.typeLabel}` : ""}
                        </span>
                        <span className="block text-gray-500">{leaveDateText(ev.leave)}</span>
                      </>
                    ) : (
                      <>
                        <span className="block font-medium text-gray-800 truncate">{ev.task.title}</span>
                        <span className={clsx("block", isOverdue(ev.task, todayKey) ? "text-red-600" : "text-gray-500")}>
                          {statusLabel(ev.task.status)} · {taskDateText(ev.task)}
                        </span>
                      </>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </PopoverPanel>
      )}

      {popover?.kind === "holiday" && (
        <PopoverPanel rect={popover.rect} onClose={() => setPopover(null)} label="Resmî tatil">
          <HolidayLines holidays={holidaysByDay.get(popover.key) ?? []} />
        </PopoverPanel>
      )}

      {popover?.kind === "leave" && (
        <PopoverPanel rect={popover.rect} onClose={() => setPopover(null)} label="İzin">
          <div className="px-3.5 py-2.5">
            <p className="text-sm font-semibold" style={{ color: LEAVE_STYLE.text }}>İzinli</p>
            <p className="mt-0.5 text-gray-600">{leaveDateText(popover.leave)}</p>
            <p className="mt-1 text-gray-400">İzin ayrıntılarını görüntüleme yetkiniz yok.</p>
          </div>
        </PopoverPanel>
      )}
    </Panel>
  );
}
