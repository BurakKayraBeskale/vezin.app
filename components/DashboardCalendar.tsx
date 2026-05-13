"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

interface DayTask { title: string; status: string; }

interface CalendarData {
  tasksByDay: Record<string, DayTask[]>;
  leavesByDay: Record<string, string[]>;
}

const STATUS_COLOR: Record<string, string> = {
  TODO: "#9CA3AF",
  IN_PROGRESS: "#F57C28",
  REVIEW: "#6366F1",
  DONE: "#10B981",
};

const STATUS_LABEL: Record<string, string> = {
  TODO: "Yapılacak",
  IN_PROGRESS: "Devam Ediyor",
  REVIEW: "İncelemede",
  DONE: "Tamamlandı",
};

// Türkiye resmi tatilleri (MM-DD formatı)
const HOLIDAYS: Record<string, string> = {
  "01-01": "Yılbaşı",
  "04-23": "Ulusal Egemenlik ve Çocuk Bayramı",
  "05-01": "Emek ve Dayanışma Bayramı",
  "05-19": "Atatürk'ü Anma, Gençlik ve Spor Bayramı",
  "07-15": "Demokrasi ve Millî Birlik Günü",
  "08-30": "Zafer Bayramı",
  "10-29": "Cumhuriyet Bayramı",
};

const WEEKDAYS = ["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pz"];
const MONTHS = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

interface TooltipProps {
  tasks: DayTask[];
  leaves: string[];
  day: number;
}

interface TooltipPropsExtended extends TooltipProps {
  holiday?: string;
}

function DayTooltip({ tasks, leaves, holiday }: TooltipPropsExtended) {
  const shown = tasks.slice(0, 3);
  const extra = tasks.length - 3;
  return (
    <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 bg-white rounded-xl shadow-xl border border-gray-100 p-3 pointer-events-none">
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-white" />
      {holiday && (
        <div className="flex items-center gap-1.5 mb-2 pb-2 border-b border-gray-100">
          <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
          <p className="text-[11px] font-semibold text-green-700">{holiday}</p>
        </div>
      )}
      {shown.map((t, i) => (
        <div key={i} className="flex items-start gap-1.5 mb-1.5 last:mb-0">
          <span
            className="mt-0.5 w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: STATUS_COLOR[t.status] ?? "#9CA3AF" }}
          />
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-800 truncate">{t.title}</p>
            <p className="text-[10px] text-gray-400">{STATUS_LABEL[t.status] ?? t.status}</p>
          </div>
        </div>
      ))}
      {extra > 0 && (
        <p className="text-[10px] text-gray-400 mt-1">+{extra} görev daha</p>
      )}
      {leaves.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <p className="text-[10px] font-semibold text-emerald-600 mb-1">İzinde</p>
          {leaves.slice(0, 3).map((name, i) => (
            <p key={i} className="text-[10px] text-gray-500">{name}</p>
          ))}
          {leaves.length > 3 && (
            <p className="text-[10px] text-gray-400">+{leaves.length - 3} kişi</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function DashboardCalendar() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1); // 1-based
  const [data, setData] = useState<CalendarData | null>(null);
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dashboard/calendar?year=${year}&month=${month}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); });
  }, [year, month]);

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }

  // Build calendar grid
  const firstDay = new Date(year, month - 1, 1).getDay(); // 0=Sun
  // Convert to Mon-based: Mon=0 ... Sun=6
  const startOffset = (firstDay === 0 ? 6 : firstDay - 1);
  const daysInMonth = new Date(year, month, 0).getDate();

  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-gray-800">
          {MONTHS[month - 1]} {year}
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={prevMonth}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          {!isCurrentMonth && (
            <button
              onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth() + 1); }}
              className="text-xs font-medium text-[#F57C28] hover:underline px-1"
            >
              Bugün
            </button>
          )}
          <button
            onClick={nextMonth}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-center text-[10px] font-semibold text-gray-400 py-1">{d}</div>
        ))}
      </div>

      {/* Days grid */}
      {loading ? (
        <div className="grid grid-cols-7 gap-px">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="h-10 bg-gray-50 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-px">
          {cells.map((day, idx) => {
            if (!day) return <div key={idx} className="h-10" />;

            const key = isoDate(year, month, day);
            const dayTasks = data?.tasksByDay[key] ?? [];
            const dayLeaves = data?.leavesByDay[key] ?? [];
            const isToday = isCurrentMonth && day === today.getDate();
            const hasLeave = dayLeaves.length > 0;
            const hasTasks = dayTasks.length > 0;
            const holidayKey = `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const holidayName = HOLIDAYS[holidayKey];
            const isHoliday = !!holidayName;
            const showTooltip = hoveredDay === idx && (hasTasks || hasLeave || isHoliday);

            return (
              <div
                key={idx}
                className="relative"
                onMouseEnter={() => (hasTasks || hasLeave || isHoliday) ? setHoveredDay(idx) : undefined}
                onMouseLeave={() => setHoveredDay(null)}
              >
                <div
                  className={clsx(
                    "h-10 flex flex-col items-center justify-center rounded-lg cursor-default select-none transition-colors",
                    isToday && "bg-[#F57C28] text-white font-bold shadow-md shadow-[#F57C28]/30",
                    !isToday && isHoliday && "bg-green-100",
                    !isToday && !isHoliday && (hasTasks || hasLeave ? "hover:bg-orange-50" : "hover:bg-gray-50"),
                  )}
                >
                  <span className={clsx(
                    "text-xs leading-none",
                    isToday ? "text-white" : "text-gray-700"
                  )}>
                    {day}
                  </span>
                  {/* Dot indicators */}
                  {!isToday && (hasTasks || hasLeave || isHoliday) && (
                    <div className="flex gap-0.5 mt-0.5">
                      {hasTasks && (
                        <span className="w-1 h-1 rounded-full bg-[#F57C28]" />
                      )}
                      {hasLeave && (
                        <span className="w-1 h-1 rounded-full bg-emerald-500" />
                      )}
                    </div>
                  )}
                </div>

                {showTooltip && (
                  <DayTooltip tasks={dayTasks} leaves={dayLeaves} day={day} holiday={holidayName} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-50">
        <span className="flex items-center gap-1.5 text-[10px] text-gray-400">
          <span className="w-2 h-2 rounded-full bg-[#F57C28]" /> Görev
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-gray-400">
          <span className="w-2 h-2 rounded-full bg-emerald-500" /> Onaylı İzin
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-gray-400">
          <span className="w-3.5 h-3.5 rounded-md bg-green-100 border border-green-300 inline-block" /> Resmi Tatil
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-gray-400">
          <span className="w-4 h-4 rounded-lg bg-[#F57C28] inline-block" /> Bugün
        </span>
      </div>
    </div>
  );
}
