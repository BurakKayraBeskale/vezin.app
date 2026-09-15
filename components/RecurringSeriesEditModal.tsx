"use client";

import { useEffect, useState } from "react";

export interface SeriesDetail {
  id: string;
  ownerId: string;
  recurringType: string;
  recurringDay: number | null;
  endType: string;
  endDate: string | null;
  isStopped: boolean;
  title: string;
  description: string | null;
  priority: string;
  assignedToId: string;
  projectId: string | null;
  departmentId: string | null;
}

interface AssignableUser { id: string; name: string; }

interface Props {
  series: SeriesDetail;
  onClose: () => void;
  onSaved: (series: SeriesDetail) => void;
}

export default function RecurringSeriesEditModal({ series, onClose, onSaved }: Props) {
  const [title, setTitle] = useState(series.title);
  const [description, setDescription] = useState(series.description ?? "");
  const [priority, setPriority] = useState(series.priority);
  const [assignedToId, setAssignedToId] = useState(series.assignedToId);
  const [endType, setEndType] = useState(series.endType);
  const [endDate, setEndDate] = useState(series.endDate ? series.endDate.slice(0, 10) : "");
  const [recurringDay, setRecurringDay] = useState(series.recurringDay?.toString() ?? "");
  const [assignees, setAssignees] = useState<AssignableUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams();
    if (series.projectId) params.set("projectId", series.projectId);
    else if (series.departmentId) params.set("departmentId", series.departmentId);
    fetch(`/api/users/assignable?${params}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: AssignableUser[]) => {
        if (Array.isArray(data)) setAssignees(data);
      })
      .catch(() => {});
  }, [series.projectId, series.departmentId]);

  async function handleSubmit() {
    if (!title.trim()) {
      setError("Başlık zorunlu");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/recurring-series/${series.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "edit",
          title: title.trim(),
          description: description.trim() || null,
          priority,
          assignedToId,
          endType,
          endDate: endType === "SPECIFIC_DATE" ? endDate || null : null,
          recurringDay: recurringDay ? Number(recurringDay) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Seri güncellenemedi");
        return;
      }
      onSaved({ ...series, ...data });
    } catch {
      setError("Sunucu hatası");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[95vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">Seriyi Düzenle</h2>
          <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-amber-50 border border-amber-100 text-amber-700 text-xs rounded-xl px-4 py-3 leading-relaxed">
            Bu değişiklikler yalnızca gelecekte üretilecek görevleri etkiler. Bu seriden
            önceden oluşmuş görevler değişmez.
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Başlık *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Açıklama</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Öncelik</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28]"
              >
                <option value="LOW">Düşük</option>
                <option value="MEDIUM">Orta</option>
                <option value="HIGH">Yüksek</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Atanan Kişi</label>
              <select
                value={assignedToId}
                onChange={(e) => setAssignedToId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28]"
              >
                {!assignees.find((a) => a.id === assignedToId) && (
                  <option value={assignedToId}>Mevcut atanan</option>
                )}
                {assignees.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          </div>

          {(series.recurringType === "MONTHLY" || series.recurringType === "WEEKLY") && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {series.recurringType === "MONTHLY" ? "Ayın Günü (1-31)" : "Haftanın Günü (1=Pt)"}
              </label>
              <input
                type="number"
                min="1"
                max={series.recurringType === "MONTHLY" ? 31 : 7}
                value={recurringDay}
                onChange={(e) => setRecurringDay(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28]"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Bitiş</label>
            <select
              value={endType}
              onChange={(e) => setEndType(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28] mb-2"
            >
              <option value="INDEFINITE">Süresiz</option>
              <option value="SPECIFIC_DATE">Belirli Tarihte Bitir</option>
            </select>
            {endType === "SPECIFIC_DATE" && (
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28]"
              />
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-2.5">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-60 transition-colors"
            >
              Vazgeç
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-xl bg-[#F57C28] hover:bg-[#D96A1A] disabled:opacity-60 text-white text-sm font-semibold transition-colors shadow-md shadow-[#F57C28]/25"
            >
              {loading ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
