"use client";

/**
 * Sistem Ayarları → Resmî Tatiller (yalnız Admin). Liste, yıl filtresi,
 * aktif/pasif, yeni tatil, düzenle. Yetki ve doğrulama sunucuda:
 * /api/admin/holidays (loadHolidayAdmin + validateHolidayInput).
 * Silme yok — kayıt pasife alınır; pasif tatil takvimde ve izin hesabında kullanılmaz.
 */

import { useCallback, useEffect, useState, type FormEvent } from "react";
import clsx from "clsx";
import { HOLIDAY_MAX_SPAN_DAYS, holidayDayTypeText, type HolidayDayType, type HolidayHalfPeriod } from "@/lib/holidays";

interface HolidayRow {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  dayType: string;
  halfDayPeriod: string | null;
  description: string | null;
  isRecurringAnnually: boolean;
  isActive: boolean;
  createdBy: { id: string; name: string } | null;
  updatedAt: string;
}

type StatusFilter = "all" | "active" | "passive";

const fmt = (iso: string) => iso.slice(0, 10).split("-").reverse().join(".");
const fmtDayMonth = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("tr-TR", { timeZone: "UTC", day: "numeric", month: "long" });
};

function dateText(h: HolidayRow): string {
  if (h.isRecurringAnnually) {
    const s = fmtDayMonth(h.startDate);
    return h.startDate.slice(0, 10) === h.endDate.slice(0, 10) ? s : `${s} – ${fmtDayMonth(h.endDate)}`;
  }
  return h.startDate.slice(0, 10) === h.endDate.slice(0, 10) ? fmt(h.startDate) : `${fmt(h.startDate)} – ${fmt(h.endDate)}`;
}

export default function PublicHolidaysAdmin() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(currentYear);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [rows, setRows] = useState<HolidayRow[] | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<HolidayRow | "new" | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch(`/api/admin/holidays?year=${year}`);
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "Liste yüklenemedi");
        setRows([]);
        return;
      }
      setRows(body.holidays);
    } catch {
      setError("Sunucuya ulaşılamadı");
      setRows([]);
    }
  }, [year]);

  useEffect(() => {
    setRows(null);
    load();
  }, [load]);

  async function toggleActive(h: HolidayRow) {
    setTogglingId(h.id);
    setError("");
    try {
      const res = await fetch(`/api/admin/holidays/${h.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !h.isActive }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) setError(body?.error ?? "Güncellenemedi");
      else setRows((prev) => prev?.map((r) => (r.id === h.id ? body : r)) ?? prev);
    } finally {
      setTogglingId(null);
    }
  }

  const visible = (rows ?? []).filter((r) => (status === "all" ? true : status === "active" ? r.isActive : !r.isActive));
  const years = Array.from({ length: 6 }, (_, i) => currentYear - 2 + i);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor="holiday-year" className="text-xs font-semibold text-gray-500">Yıl</label>
          <select
            id="holiday-year"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div className="flex rounded-xl border border-gray-200 overflow-hidden text-xs font-semibold" role="group" aria-label="Durum filtresi">
          {(
            [
              ["all", "Tümü"],
              ["active", "Aktif"],
              ["passive", "Pasif"],
            ] as [StatusFilter, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              aria-pressed={status === k}
              onClick={() => setStatus(k)}
              className={clsx("px-3 py-2 transition-colors", status === k ? "bg-[#F57C28] text-white" : "text-gray-600 hover:bg-gray-50")}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="sm:ml-auto px-4 py-2 rounded-xl bg-[#F57C28] text-white text-sm font-semibold hover:bg-[#D96A1A] shadow-sm shadow-[#F57C28]/25"
        >
          + Yeni Tatil
        </button>
      </div>

      <p className="text-xs text-gray-400">
        Sabit tarihli tatiller (29 Ekim, 23 Nisan, 1 Mayıs…) için <strong>Her Yıl Tekrarla</strong> kullanın. Tarihi yıldan
        yıla değişen dini bayramları her yıl ayrı kayıt olarak ekleyin. Bu liste Dashboard takviminde ve izin iş günü
        hesabında kullanılır; pasif kayıtlar hiçbir yerde dikkate alınmaz.
      </p>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">{error}</p>}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {rows === null ? (
          <div className="p-6 space-y-3 animate-pulse">
            {[0, 1, 2].map((i) => <div key={i} className="h-8 bg-gray-100 rounded-lg" />)}
          </div>
        ) : visible.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-gray-400">{year} yılı için kayıt bulunmuyor.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400 border-b border-gray-100">
                  <th className="px-5 py-3">Tatil</th>
                  <th className="px-3 py-3">Tarih</th>
                  <th className="px-3 py-3">Gün</th>
                  <th className="px-3 py-3">Durum</th>
                  <th className="px-5 py-3 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {visible.map((h) => (
                  <tr key={h.id} className={clsx(!h.isActive && "opacity-60")}>
                    <td className="px-5 py-3 min-w-[200px]">
                      <p className="font-medium text-gray-800">{h.name}</p>
                      {h.description && <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-1">{h.description}</p>}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-gray-700">
                      {dateText(h)}
                      {h.isRecurringAnnually && (
                        <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-600">
                          Her yıl · {h.startDate.slice(0, 4)}&apos;den
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-gray-600">{holidayDayTypeText(h.dayType, h.halfDayPeriod)}</td>
                    <td className="px-3 py-3">
                      <span
                        className={clsx(
                          "text-[11px] font-semibold px-2 py-0.5 rounded-md",
                          h.isActive ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-500"
                        )}
                      >
                        {h.isActive ? "Aktif" : "Pasif"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <button type="button" onClick={() => setEditing(h)} className="text-xs font-semibold text-[#F57C28] hover:underline">
                        Düzenle
                      </button>
                      <button
                        type="button"
                        disabled={togglingId === h.id}
                        onClick={() => toggleActive(h)}
                        className="ml-3 text-xs font-semibold text-gray-500 hover:underline disabled:opacity-50"
                      >
                        {h.isActive ? "Pasife Al" : "Aktifleştir"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <HolidayFormModal
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function HolidayFormModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: HolidayRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [startDate, setStartDate] = useState(initial?.startDate.slice(0, 10) ?? "");
  const [endDate, setEndDate] = useState(initial?.endDate.slice(0, 10) ?? "");
  const [dayType, setDayType] = useState<HolidayDayType>(initial?.dayType === "HALF" ? "HALF" : "FULL");
  const [halfDayPeriod, setHalfDayPeriod] = useState<HolidayHalfPeriod>(initial?.halfDayPeriod === "MORNING" ? "MORNING" : "AFTERNOON");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [isRecurringAnnually, setIsRecurringAnnually] = useState(initial?.isRecurringAnnually ?? false);
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) return setError("Tatil adı zorunludur");
    if (!startDate) return setError("Başlangıç tarihi zorunludur");
    setSaving(true);
    try {
      const payload = {
        name,
        startDate,
        endDate: dayType === "HALF" ? startDate : endDate || startDate,
        dayType,
        halfDayPeriod: dayType === "HALF" ? halfDayPeriod : null,
        description,
        isRecurringAnnually,
        isActive,
      };
      const res = await fetch(initial ? `/api/admin/holidays/${initial.id}` : "/api/admin/holidays", {
        method: initial ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "Kaydedilemedi");
        return;
      }
      onSaved();
    } catch {
      setError("Sunucuya ulaşılamadı");
    } finally {
      setSaving(false);
    }
  }

  const input =
    "w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28]";

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="holiday-form-title"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 id="holiday-form-title" className="text-base font-bold text-gray-800">{initial ? "Tatili Düzenle" : "Yeni Resmî Tatil"}</h2>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label htmlFor="h-name" className="block text-sm font-medium text-gray-700 mb-1.5">Tatil Adı</label>
            <input id="h-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="ör. Cumhuriyet Bayramı" className={input} autoFocus />
          </div>

          <div>
            <span className="block text-sm font-medium text-gray-700 mb-1.5">Gün Tipi</span>
            <div className="flex gap-2">
              {(["FULL", "HALF"] as HolidayDayType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={dayType === t}
                  onClick={() => setDayType(t)}
                  className={clsx(
                    "flex-1 px-3 py-2 rounded-xl border text-sm font-medium transition-colors",
                    dayType === t ? "border-[#F57C28] bg-[#FFF3E9] text-[#F57C28]" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  )}
                >
                  {t === "FULL" ? "Tam Gün" : "Yarım Gün"}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="h-start" className="block text-sm font-medium text-gray-700 mb-1.5">{dayType === "HALF" ? "Tarih" : "Başlangıç Tarihi"}</label>
              <input
                id="h-start"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (!endDate || endDate < e.target.value) setEndDate(e.target.value);
                }}
                className={input}
              />
            </div>
            {dayType === "FULL" ? (
              <div>
                <label htmlFor="h-end" className="block text-sm font-medium text-gray-700 mb-1.5">Bitiş Tarihi</label>
                <input id="h-end" type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} className={input} />
              </div>
            ) : (
              <div>
                <label htmlFor="h-period" className="block text-sm font-medium text-gray-700 mb-1.5">Yarım Gün</label>
                <select id="h-period" value={halfDayPeriod} onChange={(e) => setHalfDayPeriod(e.target.value as HolidayHalfPeriod)} className={input}>
                  <option value="MORNING">Öğleden Önce</option>
                  <option value="AFTERNOON">Öğleden Sonra</option>
                </select>
              </div>
            )}
          </div>
          {dayType === "FULL" && <p className="-mt-2 text-[11px] text-gray-400">Çok günlü bayramlar için bitiş tarihini seçin (en fazla {HOLIDAY_MAX_SPAN_DAYS} gün).</p>}

          <div>
            <label htmlFor="h-desc" className="block text-sm font-medium text-gray-700 mb-1.5">
              Açıklama <span className="text-gray-400 font-normal">(opsiyonel)</span>
            </label>
            <textarea id="h-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={2} className={clsx(input, "resize-none")} />
          </div>

          <label className="flex items-start gap-2.5 cursor-pointer">
            <input type="checkbox" checked={isRecurringAnnually} onChange={(e) => setIsRecurringAnnually(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[#F57C28]" />
            <span className="text-sm text-gray-700">
              Her Yıl Tekrarla
              <span className="block text-[11px] text-gray-400">
                Yalnız sabit tarihli tatiller için (29 Ekim, 23 Nisan…). Başlangıç yılından itibaren her yıl aynı gün uygulanır.
                Dini bayramlarda kullanmayın.
              </span>
            </span>
          </label>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4 accent-[#F57C28]" />
            <span className="text-sm text-gray-700">Aktif</span>
          </label>

          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100">
            Vazgeç
          </button>
          <button type="submit" disabled={saving} className="px-4 py-2 rounded-xl bg-[#F57C28] text-white text-sm font-semibold hover:bg-[#D96A1A] disabled:opacity-60">
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </div>
      </form>
    </div>
  );
}
