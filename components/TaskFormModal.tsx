"use client";

import { useState, FormEvent } from "react";
import { TaskFull } from "./TaskModal";

interface User { id: string; name: string; }

interface Template {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  estimatedDays: number | null;
}

interface Props {
  task?: TaskFull | null;
  users: User[];
  templates?: Template[];
  onClose: () => void;
  onCreate?: (task: TaskFull) => void;
  onUpdate?: (task: TaskFull) => void;
}

export default function TaskFormModal({ task, users, templates, onClose, onCreate, onUpdate }: Props) {
  const isEdit = !!task;
  const [fromTemplate, setFromTemplate] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [priority, setPriority] = useState<string>(task?.priority ?? "MEDIUM");
  const [assignedToId, setAssignedToId] = useState(task?.assignedToId ?? "");
  const [dueDate, setDueDate] = useState(task?.dueDate ? task.dueDate.slice(0, 10) : "");
  const [isRecurring, setIsRecurring] = useState((task as any)?.isRecurring ?? false);
  const [recurringType, setRecurringType] = useState((task as any)?.recurringType ?? "WEEKLY");
  const [recurringDay, setRecurringDay] = useState<string>((task as any)?.recurringDay?.toString() ?? "1");
  const [nextOccurrence, setNextOccurrence] = useState(
    (task as any)?.nextOccurrence ? new Date((task as any).nextOccurrence).toISOString().slice(0, 10) : ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function applyTemplate(id: string) {
    setSelectedTemplateId(id);
    const tpl = templates?.find((t) => t.id === id);
    if (!tpl) return;
    setTitle(tpl.title);
    setDescription(tpl.description ?? "");
    setPriority(tpl.priority);
    if (tpl.estimatedDays) {
      const d = new Date();
      d.setDate(d.getDate() + tpl.estimatedDays);
      setDueDate(d.toISOString().slice(0, 10));
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Başlık zorunlu"); return; }
    setLoading(true);
    setError("");

    const payload: Record<string, unknown> = {
      title: title.trim(),
      description: description.trim() || null,
      priority,
      assignedToId: assignedToId || null,
      dueDate: dueDate || null,
      isRecurring,
    };

    if (isRecurring) {
      payload.recurringType = recurringType;
      payload.recurringDay = recurringDay ? Number(recurringDay) : null;
      payload.nextOccurrence = nextOccurrence || null;
    }

    try {
      let res: Response;
      if (isEdit) {
        res = await fetch(`/api/tasks/${task!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Bir hata oluştu");
        return;
      }

      const result: TaskFull = await res.json();
      if (isEdit) onUpdate?.(result);
      else onCreate?.(result);
      onClose();
    } catch {
      setError("Sunucu hatası");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[95vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">
            {isEdit ? "Görevi Düzenle" : "Yeni Görev Oluştur"}
          </h2>
          <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Template selector */}
          {!isEdit && templates && templates.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setFromTemplate((v) => !v)}
                  className="text-xs text-[#F57C28] hover:underline font-medium flex items-center gap-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                  </svg>
                  {fromTemplate ? "Şablonsuz devam et" : "Şablondan doldur"}
                </button>
              </div>
              {fromTemplate && (
                <select
                  value={selectedTemplateId}
                  onChange={(e) => applyTemplate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#F57C28]/40 bg-[#FFF9F5] text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28]"
                >
                  <option value="">— Şablon seçin —</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Başlık *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Görev başlığı"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Açıklama</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Görev hakkında detaylar..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28] resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Öncelik</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28] bg-white"
              >
                <option value="LOW">Düşük</option>
                <option value="MEDIUM">Orta</option>
                <option value="HIGH">Yüksek</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Son Tarih</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Atanan Kişi</label>
            <select
              value={assignedToId}
              onChange={(e) => setAssignedToId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28] bg-white"
            >
              <option value="">— Atanmamış —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          {/* Recurring task */}
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-3.5">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="w-4 h-4 rounded accent-[#F57C28]"
              />
              <span className="text-sm font-medium text-gray-700">Tekrarlayan görev</span>
            </label>

            {isRecurring && (
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Tekrar Türü</label>
                    <select value={recurringType} onChange={(e) => setRecurringType(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28] bg-white">
                      <option value="DAILY">Her Gün</option>
                      <option value="WEEKLY">Haftalık</option>
                      <option value="MONTHLY">Aylık</option>
                      <option value="YEARLY">Yıllık</option>
                    </select>
                  </div>
                  {(recurringType === "MONTHLY" || recurringType === "WEEKLY") && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        {recurringType === "MONTHLY" ? "Ayın Günü (1-31)" : "Haftanın Günü (1=Pt)"}
                      </label>
                      <input type="number" min="1" max={recurringType === "MONTHLY" ? 31 : 7}
                        value={recurringDay}
                        onChange={(e) => setRecurringDay(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28]" />
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">İlk Tekrar Tarihi</label>
                  <input type="date" value={nextOccurrence} onChange={(e) => setNextOccurrence(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28]" />
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-2.5">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              İptal
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-xl bg-[#F57C28] hover:bg-[#D96A1A] disabled:opacity-60 text-white text-sm font-semibold transition-colors shadow-md shadow-[#F57C28]/25">
              {loading ? "Kaydediliyor..." : isEdit ? "Güncelle" : "Oluştur"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
