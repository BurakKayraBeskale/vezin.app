"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import clsx from "clsx";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Meeting {
  id: string;
  title: string;
  description?: string | null;
  date: string;
  time: string;
  duration: number;
  department: string;
  createdById: string;
  createdAt: string;
  createdBy: { id: string; name: string };
  attendees?: Array<{
    id: string;
    status: string;
    user: { id: string; name: string; email: string; department: string };
  }>;
}

type MeetingsByDay = Record<string, Meeting[]>;

// ─── Constants ─────────────────────────────────────────────────────────────────

const WEEKDAYS = ["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pz"];
const MONTHS = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

const DEPT_LABELS: Record<string, string> = {
  OUTSOURCE:            "Outsource",
  BAGIMSIZ_DENETIM:     "Bağımsız Denetim",
  MUHASEBE:             "Muhasebe",
  YEMINLI_MALI_MUSAVIR: "YMM",
  ADMIN:                "Yönetim",
};

const DURATION_LABELS: Record<number, string> = {
  30: "30 dakika",
  60: "1 saat",
  120: "2 saat",
};

const DEPARTMENTS = [
  "OUTSOURCE", "BAGIMSIZ_DENETIM", "MUHASEBE", "YEMINLI_MALI_MUSAVIR", "ADMIN",
] as const;

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatDateTR(dateStr: string) {
  // dateStr is YYYY-MM-DD — add noon time to avoid timezone shift
  return new Date(dateStr + "T12:00:00").toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function MeetingCard({
  meeting,
  onClick,
}: {
  meeting: Meeting;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 rounded-xl border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/40 transition-all group"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-200 transition-colors">
          <svg
            className="w-5 h-5 text-indigo-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate">{meeting.title}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {meeting.time} · {DURATION_LABELS[meeting.duration] ?? `${meeting.duration} dk`} ·{" "}
            {DEPT_LABELS[meeting.department] ?? meeting.department}
          </p>
          {meeting.description && (
            <p className="text-xs text-gray-400 mt-1 line-clamp-1">{meeting.description}</p>
          )}
        </div>
        <svg
          className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 flex-shrink-0 mt-0.5 transition-colors"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  );
}

function MeetingDetailModal({
  meetingId,
  onClose,
}: {
  meetingId: string;
  onClose: () => void;
}) {
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/meetings/${meetingId}`)
      .then((r) => r.json())
      .then((d) => { setMeeting(d); setLoading(false); });
  }, [meetingId]);

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-800">Toplantı Detayı</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-5 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : !meeting ? (
          <div className="p-6 text-center text-gray-400 text-sm">Toplantı bulunamadı.</div>
        ) : (
          <div className="p-6 space-y-5">
            {/* Title */}
            <div>
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-800 leading-tight">{meeting.title}</h3>
                  <p className="text-sm text-indigo-600 font-medium mt-0.5">
                    {formatDateTR(meeting.date)} · {meeting.time}
                  </p>
                </div>
              </div>
            </div>

            {/* Meta */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Süre</p>
                <p className="text-sm font-semibold text-gray-700">
                  {DURATION_LABELS[meeting.duration] ?? `${meeting.duration} dk`}
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Departman</p>
                <p className="text-sm font-semibold text-gray-700">
                  {DEPT_LABELS[meeting.department] ?? meeting.department}
                </p>
              </div>
            </div>

            {/* Description */}
            {meeting.description && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Açıklama</p>
                <p className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3 leading-relaxed">
                  {meeting.description}
                </p>
              </div>
            )}

            {/* Creator */}
            <div className="flex items-center gap-2 pt-1 border-t border-gray-50">
              <div className="w-7 h-7 rounded-full bg-[#F57C28] flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                {meeting.createdBy.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="text-[10px] text-gray-400">Oluşturan</p>
                <p className="text-xs font-semibold text-gray-700">{meeting.createdBy.name}</p>
              </div>
            </div>

            {/* Attendees */}
            {meeting.attendees && meeting.attendees.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  Katılımcılar ({meeting.attendees.length})
                </p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {meeting.attendees.map((a) => (
                    <div key={a.id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-gray-50">
                      <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-[10px] font-bold flex-shrink-0">
                        {a.user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-700 truncate">{a.user.name}</p>
                        <p className="text-[10px] text-gray-400">{DEPT_LABELS[a.user.department] ?? a.user.department}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface CreateForm {
  title: string;
  description: string;
  date: string;
  time: string;
  duration: number;
  department: string;
}

function CreateMeetingModal({
  form,
  setForm,
  onSubmit,
  onClose,
  loading,
  error,
  isAdmin,
}: {
  form: CreateForm;
  setForm: React.Dispatch<React.SetStateAction<CreateForm>>;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  loading: boolean;
  error: string;
  isAdmin: boolean;
}) {
  const today = new Date().toISOString().split("T")[0];

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-md max-h-[95vh] sm:max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">Toplantı Oluştur</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-6 space-y-4">
          {/* Başlık */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Başlık *</label>
            <input
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Haftalık değerlendirme toplantısı"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
            />
          </div>

          {/* Açıklama */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Açıklama{" "}
              <span className="text-gray-400 font-normal">(opsiyonel)</span>
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              placeholder="Toplantı hakkında kısa not..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 resize-none"
            />
          </div>

          {/* Tarih + Saat */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tarih *</label>
              <input
                type="date"
                required
                min={today}
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Saat *</label>
              <input
                type="time"
                required
                value={form.time}
                onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
              />
            </div>
          </div>

          {/* Süre */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Süre</label>
            <div className="flex gap-2">
              {([30, 60, 120] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, duration: d }))}
                  className={clsx(
                    "flex-1 py-2 rounded-lg text-xs font-semibold border transition-all",
                    form.duration === d
                      ? "border-indigo-400 bg-indigo-50 text-indigo-700"
                      : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
                  )}
                >
                  {DURATION_LABELS[d]}
                </button>
              ))}
            </div>
          </div>

          {/* Departman */}
          {isAdmin ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Departman *</label>
              <select
                required
                value={form.department}
                onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 bg-white"
              >
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>{DEPT_LABELS[d]}</option>
                ))}
              </select>
              <p className="text-[11px] text-gray-400 mt-1">
                Seçilen departmandaki tüm çalışanlara bildirim gönderilir.
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Departman</label>
              <div className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 bg-gray-50">
                {DEPT_LABELS[form.department] ?? form.department}
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                Kendi departmanınızdaki tüm çalışanlara bildirim gönderilir.
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-2.5">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors shadow-md shadow-indigo-500/25"
            >
              {loading ? "Oluşturuluyor..." : "Oluştur"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function MeetingsPage() {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role as string | undefined;
  const userDepartment = (session?.user as any)?.department as string | undefined;
  const canCreate = userRole === "ADMIN" || userRole === "MANAGER";

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [meetingsByDay, setMeetingsByDay] = useState<MeetingsByDay>({});
  const [loading, setLoading] = useState(true);

  // UI state
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>({
    title: "",
    description: "",
    date: "",
    time: "09:00",
    duration: 60,
    department: userDepartment || "OUTSOURCE",
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");

  const fetchMeetings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/meetings?year=${year}&month=${month}`);
      if (res.ok) {
        const data = await res.json();
        setMeetingsByDay(data.meetingsByDay ?? {});
      }
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    fetchMeetings();
    setSelectedDay(null);
  }, [fetchMeetings]);

  // Update department in form when session loads
  useEffect(() => {
    if (userDepartment) {
      setCreateForm((f) => ({ ...f, department: userDepartment }));
    }
  }, [userDepartment]);

  function prevMonth() {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
  }

  // Build calendar grid (Mon-based)
  const firstDay = new Date(year, month - 1, 1).getDay();
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1;

  // Upcoming meetings: all meetings on/after today in fetched data, sorted
  const upcomingMeetings: Meeting[] = Object.entries(meetingsByDay)
    .filter(([d]) => d >= isoDate(today.getFullYear(), today.getMonth() + 1, today.getDate()))
    .flatMap(([, ms]) => ms)
    .sort((a, b) => {
      const da = a.date + a.time;
      const db = b.date + b.time;
      return da < db ? -1 : da > db ? 1 : 0;
    })
    .slice(0, 8);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError("");
    try {
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      if (!res.ok) {
        let errorMsg = "Bir hata oluştu";
        try {
          const data = await res.json();
          errorMsg = data.error || errorMsg;
        } catch {}
        setCreateError(errorMsg);
        return;
      }
      setShowCreate(false);
      setCreateForm({ title: "", description: "", date: "", time: "09:00", duration: 60, department: userDepartment || "OUTSOURCE" });
      await fetchMeetings();
    } finally {
      setCreateLoading(false);
    }
  }

  const selectedDayMeetings = selectedDay ? (meetingsByDay[selectedDay] ?? []) : [];

  return (
    <div className="max-w-4xl mx-auto">
      {/* ── Header ──────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6 sm:mb-8 flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Toplantılar</h1>
          <p className="text-sm text-gray-400 mt-1">Planlanan toplantıları görüntüleyin</p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-md shadow-indigo-500/25 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Toplantı Oluştur
          </button>
        )}
      </div>

      {/* ── Calendar ─────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
        {/* Month nav */}
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
                className="text-xs font-medium text-indigo-600 hover:underline px-1"
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

        {/* Day cells */}
        {loading ? (
          <div className="grid grid-cols-7 gap-px">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="h-12 bg-gray-50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-px">
            {cells.map((day, idx) => {
              if (!day) return <div key={idx} className="h-12" />;

              const key = isoDate(year, month, day);
              const dayMeetings = meetingsByDay[key] ?? [];
              const isToday = isCurrentMonth && day === today.getDate();
              const isSelected = selectedDay === key;
              const hasMeetings = dayMeetings.length > 0;

              return (
                <div
                  key={idx}
                  onClick={() => hasMeetings ? setSelectedDay(isSelected ? null : key) : setSelectedDay(null)}
                  className={clsx(
                    "h-12 flex flex-col items-center justify-center rounded-lg select-none transition-all",
                    isToday && "bg-[#F57C28] text-white font-bold shadow-md shadow-[#F57C28]/30",
                    isSelected && !isToday && "bg-indigo-50 ring-2 ring-inset ring-indigo-300",
                    !isToday && !isSelected && hasMeetings && "hover:bg-indigo-50 cursor-pointer",
                    !isToday && !isSelected && !hasMeetings && "hover:bg-gray-50 cursor-default",
                  )}
                >
                  <span
                    className={clsx(
                      "text-xs leading-none",
                      isToday ? "text-white" : isSelected ? "text-indigo-700 font-semibold" : "text-gray-700"
                    )}
                  >
                    {day}
                  </span>
                  {/* Meeting dots */}
                  {hasMeetings && (
                    <div className="flex gap-0.5 mt-0.5">
                      {dayMeetings.slice(0, 3).map((_, mi) => (
                        <span
                          key={mi}
                          className={clsx(
                            "w-1 h-1 rounded-full",
                            isToday ? "bg-white/70" : isSelected ? "bg-indigo-500" : "bg-indigo-400"
                          )}
                        />
                      ))}
                      {dayMeetings.length > 3 && (
                        <span
                          className={clsx(
                            "text-[8px] leading-none font-bold",
                            isToday ? "text-white/70" : "text-indigo-400"
                          )}
                        >
                          +
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-50">
          <span className="flex items-center gap-1.5 text-[10px] text-gray-400">
            <span className="w-2 h-2 rounded-full bg-indigo-400" /> Toplantı
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-gray-400">
            <span className="w-4 h-4 rounded-lg bg-[#F57C28] inline-block" /> Bugün
          </span>
        </div>
      </div>

      {/* ── Selected day panel ───────────────────────── */}
      {selectedDay && selectedDayMeetings.length > 0 && (
        <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-800">
              {formatDateTR(selectedDay)} — {selectedDayMeetings.length} toplantı
            </h3>
            <button
              onClick={() => setSelectedDay(null)}
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="space-y-2">
            {selectedDayMeetings.map((m) => (
              <MeetingCard key={m.id} meeting={m} onClick={() => setDetailId(m.id)} />
            ))}
          </div>
        </div>
      )}

      {/* ── Upcoming meetings ────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-800">Yaklaşan Toplantılar</h3>
          <p className="text-xs text-gray-400 mt-0.5">Bu ay içindeki planlanmış toplantılar</p>
        </div>

        {loading ? (
          <div className="divide-y divide-gray-50">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="px-6 py-4 animate-pulse flex items-center gap-4">
                <div className="w-10 h-10 bg-gray-100 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-40 bg-gray-100 rounded" />
                  <div className="h-3 w-24 bg-gray-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : upcomingMeetings.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-sm text-gray-400">Bu ay için planlanmış toplantı yok.</p>
            {canCreate && (
              <button
                onClick={() => setShowCreate(true)}
                className="mt-3 text-sm font-medium text-indigo-600 hover:underline"
              >
                İlk toplantıyı oluştur
              </button>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {upcomingMeetings.map((m) => (
              <li key={m.id} className="px-4 sm:px-6 py-1">
                <MeetingCard meeting={m} onClick={() => setDetailId(m.id)} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Detail Modal ─────────────────────────────── */}
      {detailId && (
        <MeetingDetailModal meetingId={detailId} onClose={() => setDetailId(null)} />
      )}

      {/* ── Create Modal ─────────────────────────────── */}
      {showCreate && canCreate && (
        <CreateMeetingModal
          form={createForm}
          setForm={setCreateForm}
          onSubmit={handleCreate}
          onClose={() => { setShowCreate(false); setCreateError(""); }}
          loading={createLoading}
          error={createError}
          isAdmin={userRole === "ADMIN"}
        />
      )}
    </div>
  );
}
