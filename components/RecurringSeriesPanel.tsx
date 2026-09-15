"use client";

import { useEffect, useState } from "react";
import ConfirmModal from "./ConfirmModal";
import RecurringSeriesEditModal, { SeriesDetail } from "./RecurringSeriesEditModal";

interface Props {
  recurringSeriesId: string;
  currentUserId: string;
  /** ADMIN veya canViewAllProjects — seri sahibi olmasa da yönetebilir */
  isManager: boolean;
}

export default function RecurringSeriesPanel({ recurringSeriesId, currentUserId, isManager }: Props) {
  const [series, setSeries] = useState<SeriesDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [showStop, setShowStop] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [stopError, setStopError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    fetch(`/api/recurring-series/${recurringSeriesId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setSeries)
      .finally(() => setLoading(false));
  }, [recurringSeriesId]);

  if (loading || !series) return null;

  const canManageSeries = isManager || series.ownerId === currentUserId;
  if (!canManageSeries) return null;

  async function handleStop() {
    setStopping(true);
    setStopError("");
    try {
      const res = await fetch(`/api/recurring-series/${recurringSeriesId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStopError(data.error || "Seri durdurulamadı");
        return;
      }
      setSeries((prev) => (prev ? { ...prev, isStopped: true } : prev));
      setShowStop(false);
      showToast("Seri durduruldu");
    } catch {
      setStopError("Sunucu hatası");
    } finally {
      setStopping(false);
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  return (
    <section className="px-6 py-4 border-b border-gray-50">
      <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
        Tekrarlayan Görev Serisi
      </h3>

      {series.isStopped ? (
        <p className="text-sm text-gray-400 italic">Bu seri durduruldu — yeni görev üretilmeyecek</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowEdit(true)}
            className="px-3.5 py-2 rounded-lg text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Seriyi Düzenle
          </button>
          <button
            type="button"
            onClick={() => setShowStop(true)}
            className="px-3.5 py-2 rounded-lg text-sm font-semibold border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
          >
            Seriyi Durdur
          </button>
          {toast && <span className="text-xs text-emerald-600 font-medium">{toast}</span>}
        </div>
      )}

      {showStop && (
        <ConfirmModal
          title="Seriyi Durdur"
          message={
            "Bu tekrarlayan görev serisi durdurulacak; artık yeni görev üretilmeyecek.\n\n" +
            "Geçmişte oluşmuş görevler SİLİNMEZ, olduğu gibi kalır."
          }
          confirmLabel="Seriyi Durdur"
          danger
          loading={stopping}
          error={stopError}
          onConfirm={handleStop}
          onCancel={() => setShowStop(false)}
        />
      )}

      {showEdit && (
        <RecurringSeriesEditModal
          series={series}
          onClose={() => setShowEdit(false)}
          onSaved={(updated) => {
            setSeries(updated);
            setShowEdit(false);
            showToast("Seri güncellendi");
          }}
        />
      )}
    </section>
  );
}
