"use client";

import { useMemo, useState } from "react";
import { LEAVE_TYPES, LEAVE_TYPE_LABELS, LeaveType, isGunuSayisi } from "@/lib/leave";
import { LeaveRequestRecord } from "./types";

interface Props {
  onClose: () => void;
  onCreated: (created: LeaveRequestRecord) => void;
}

export default function NewLeaveRequestModal({ onClose, onCreated }: Props) {
  const [type, setType] = useState<LeaveType>("ANNUAL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const today = useMemo(() => new Date().toISOString().split("T")[0], []);

  const dayPreview = useMemo(() => {
    if (!startDate || !endDate) return null;
    const s = new Date(startDate);
    const e = new Date(endDate);
    if (e < s) return null;
    return isGunuSayisi(s, e);
  }, [startDate, endDate]);

  function addFiles(list: FileList | null) {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
  }
  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!startDate || !endDate) {
      setError("Başlangıç ve bitiş tarihi zorunludur");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate, type, note: note.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Bir hata oluştu");
        setSubmitting(false);
        return;
      }

      let created: LeaveRequestRecord = data;

      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        const fileRes = await fetch(`/api/leave/${created.id}/attachments`, { method: "POST", body: fd });
        if (fileRes.ok) {
          const refreshed = await fetch(`/api/leave/${created.id}`);
          if (refreshed.ok) created = await refreshed.json();
        }
      }

      onCreated(created);
    } catch {
      setError("Sunucu hatası");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[95vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">Yeni İzin Talebi</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* İzin Türü */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">İzin Türü *</label>
            <div className="flex gap-2 flex-wrap">
              {LEAVE_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    type === t
                      ? "border-[#F57C28] bg-[#FFF3E9] text-[#F57C28]"
                      : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
                  }`}
                >
                  {LEAVE_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Tarih aralığı */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Başlangıç Tarihi *</label>
              <input
                type="date"
                value={startDate}
                min={today}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28] transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Bitiş Tarihi *</label>
              <input
                type="date"
                value={endDate}
                min={startDate || today}
                onChange={(e) => setEndDate(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28] transition-all"
              />
            </div>
          </div>

          {dayPreview !== null && (
            <p className="text-xs text-gray-400">
              {dayPreview > 0 ? `${dayPreview} iş günü (hafta sonları hariç)` : "Seçilen aralıkta iş günü yok"}
            </p>
          )}

          {/* Açıklama */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Açıklama <span className="font-normal text-gray-400">(opsiyonel)</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Varsa açıklama ekleyin..."
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28] transition-all"
            />
          </div>

          {/* Ek Dosya */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Ek Dosya <span className="font-normal text-gray-400">(opsiyonel, birden fazla)</span>
            </label>
            <label className="flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2.5 rounded-lg cursor-pointer transition-colors w-full bg-[#F57C28]/10 text-[#F57C28] hover:bg-[#F57C28]/20">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Dosya Ekle
              <input type="file" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
            </label>
            {files.length > 0 && (
              <ul className="mt-2 space-y-1">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center justify-between text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-1.5">
                    <span className="truncate">{f.name}</span>
                    <button type="button" onClick={() => removeFile(i)} className="text-gray-400 hover:text-red-500 ml-2 flex-shrink-0">×</button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-2.5">{error}</div>
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
              disabled={submitting}
              className="flex-1 px-4 py-2.5 rounded-xl bg-[#F57C28] hover:bg-[#D96A1A] disabled:opacity-60 text-white text-sm font-semibold transition-colors shadow-md shadow-[#F57C28]/25"
            >
              {submitting ? "Gönderiliyor..." : "Talep Oluştur"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
