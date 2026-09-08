"use client";

import { useEffect, useState } from "react";

interface PersonPerf {
  id: string;
  name: string;
  email: string;
  department: string;
  onTime: number;
  late: number;
  total: number;
  pct: number | null;
}

interface TaskItem {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  completedAt: string | null;
  project: { name: string } | null;
}

interface Breakdown {
  userId: string;
  userName: string;
  from: string;
  to: string;
  pct: number | null;
  onTimeCount: number;
  lateCount: number;
  onTime: TaskItem[];
  late: TaskItem[];
  upcoming: TaskItem[];
}

const DEPT_LABELS: Record<string, string> = {
  BAGIMSIZ_DENETIM:     "Bağımsız Denetim",
  YEMINLI_MALI_MUSAVIR: "YMM",
};

function toDateInputStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("tr-TR");
}

function barBg(pct: number): string {
  if (pct >= 80) return "bg-emerald-500";
  if (pct >= 50) return "bg-amber-500";
  return "bg-red-500";
}

function textCls(pct: number): string {
  if (pct >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (pct >= 50) return "text-amber-500 dark:text-amber-400";
  return "text-red-500 dark:text-red-400";
}

// ── Görev listesi bölümü ───────────────────────────────────────────────────

const SECTION_STYLE = {
  green: {
    header: "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20",
    dot:    "bg-emerald-500",
  },
  amber: {
    header: "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20",
    dot:    "bg-amber-500",
  },
  red: {
    header: "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20",
    dot:    "bg-red-500",
  },
} as const;

function TaskSection({
  title,
  tasks,
  color,
  emptyMsg,
}: {
  title: string;
  tasks: TaskItem[];
  color: keyof typeof SECTION_STYLE;
  emptyMsg: string;
}) {
  const s = SECTION_STYLE[color];
  return (
    <div>
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg mb-2 ${s.header}`}>
        <div className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
        <span className="text-xs font-semibold">{title}</span>
        <span className="ml-auto text-xs opacity-70">{tasks.length}</span>
      </div>
      {tasks.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-600 italic px-3">{emptyMsg}</p>
      ) : (
        <div className="space-y-1">
          {tasks.map((t) => (
            <div
              key={t.id}
              className="px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 text-xs"
            >
              <div className="font-medium text-gray-800 dark:text-gray-100 truncate">{t.title}</div>
              <div className="flex flex-wrap items-center gap-x-3 mt-0.5 text-gray-400 dark:text-gray-500">
                <span>Son: {formatDate(t.dueDate)}</span>
                {t.completedAt && (
                  <span>Tamamlandı: {formatDate(t.completedAt)}</span>
                )}
                {t.project && <span>{t.project.name}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Ana bileşen ────────────────────────────────────────────────────────────

export default function PerformancePanel() {
  const [data, setData] = useState<PersonPerf[] | null>(null);
  const [selected, setSelected] = useState<PersonPerf | null>(null);
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null);
  const [bdLoading, setBdLoading] = useState(false);

  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return toDateInputStr(d);
  });
  const [to, setTo] = useState(() => toDateInputStr(new Date()));

  // Performans listesini çek
  useEffect(() => {
    fetch("/api/performance")
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setData)
      .catch(() => setData([]));
  }, []);

  // Seçili kişi veya tarih aralığı değişince döküm getir
  useEffect(() => {
    if (!selected) return;
    setBdLoading(true);
    setBreakdown(null);
    const controller = new AbortController();
    fetch(
      `/api/performance/${selected.id}?from=${from}&to=${to}`,
      { signal: controller.signal }
    )
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d) => { setBreakdown(d); setBdLoading(false); })
      .catch((err) => { if (err.name !== "AbortError") setBdLoading(false); });
    return () => controller.abort();
  }, [selected, from, to]);

  // Escape tuşuyla kapat
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSelected(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  // Yükleniyor
  if (data === null) {
    return (
      <div className="mt-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 animate-pulse">
        <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-48 mb-4" />
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 bg-gray-50 dark:bg-gray-700 rounded" />
          ))}
        </div>
      </div>
    );
  }

  // Hata veya boş liste — sessizce gizle
  if (data.length === 0) return null;

  return (
    <>
      {/* ── Performans listesi ─────────────────────────────────────────────── */}
      <div className="mt-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
        <h2 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">
          <svg
            className="w-4 h-4 text-[#F57C28]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          Personel Başarı Oranı
        </h2>

        <div className="space-y-3">
          {data.map((p) => (
            <div key={p.id} className="flex items-center gap-3 min-w-0">
              {/* İsim — tıklanabilir */}
              <button
                onClick={() => setSelected(p)}
                className="w-36 shrink-0 text-left text-sm font-medium text-gray-800 dark:text-gray-100 hover:text-[#F57C28] dark:hover:text-[#F57C28] truncate transition-colors"
                title={p.name}
              >
                {p.name}
              </button>

              {/* Departman */}
              <span className="w-28 shrink-0 text-xs text-gray-400 dark:text-gray-500 truncate">
                {DEPT_LABELS[p.department] ?? p.department}
              </span>

              {/* Çubuk + etiket */}
              <div className="flex flex-1 items-center gap-2 min-w-0">
                {p.pct === null ? (
                  <>
                    <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full" />
                    <span className="text-xs text-gray-300 dark:text-gray-600 italic shrink-0">
                      veri yok
                    </span>
                  </>
                ) : (
                  <>
                    <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${barBg(p.pct)}`}
                        style={{ width: `${p.pct}%` }}
                      />
                    </div>
                    <span className={`text-xs font-semibold shrink-0 ${textCls(p.pct)}`}>
                      %{p.pct} — {p.onTime}/{p.total}
                    </span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Görev dökümü paneli (drawer) ──────────────────────────────────── */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-label={`${selected.name} görev dökümü`}
        >
          {/* Arka plan örtüsü */}
          <div
            className="absolute inset-0 bg-black/30 dark:bg-black/50"
            onClick={() => setSelected(null)}
          />

          {/* Panel */}
          <div className="relative z-10 w-full max-w-xl bg-white dark:bg-gray-900 h-full overflow-y-auto shadow-2xl flex flex-col">
            {/* Başlık */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700 shrink-0">
              <div>
                <h3 className="font-bold text-gray-800 dark:text-gray-100">{selected.name}</h3>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  {DEPT_LABELS[selected.department] ?? selected.department}
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
                aria-label="Kapat"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tarih aralığı filtresi */}
            <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 shrink-0">
              <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">Dönem:</span>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/40"
              />
              <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/40"
              />
            </div>

            {/* İçerik */}
            <div className="flex-1 p-5 space-y-5">
              {bdLoading && (
                <div className="space-y-2 animate-pulse">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-8 bg-gray-100 dark:bg-gray-800 rounded-lg" />
                  ))}
                </div>
              )}

              {!bdLoading && !breakdown && (
                <p className="text-xs text-gray-400 dark:text-gray-600 italic">
                  Döküm yüklenemedi.
                </p>
              )}

              {!bdLoading && breakdown && (
                <>
                  {/* Özet çubuğu */}
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Başarı oranı (seçili dönem)
                      </span>
                      {breakdown.pct !== null ? (
                        <span className={`text-sm font-bold ${textCls(breakdown.pct)}`}>
                          %{breakdown.pct}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300 dark:text-gray-600 italic">
                          veri yok
                        </span>
                      )}
                    </div>
                    <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      {breakdown.pct !== null && (
                        <div
                          className={`h-full rounded-full ${barBg(breakdown.pct)}`}
                          style={{ width: `${breakdown.pct}%` }}
                        />
                      )}
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
                      {breakdown.onTimeCount} zamanında · {breakdown.lateCount} gecikti
                    </p>
                  </div>

                  {/* Süresi dolmak üzere */}
                  <TaskSection
                    title="Süresi Dolmak Üzere"
                    tasks={breakdown.upcoming}
                    color="amber"
                    emptyMsg="Süresi dolmak üzere görev yok."
                  />

                  {/* Geciken */}
                  <TaskSection
                    title="Geciken"
                    tasks={breakdown.late}
                    color="red"
                    emptyMsg="Geciken görev yok."
                  />

                  {/* Zamanında */}
                  <TaskSection
                    title="Zamanında Tamamlanan"
                    tasks={breakdown.onTime}
                    color="green"
                    emptyMsg="Zamanında tamamlanan görev yok."
                  />
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
