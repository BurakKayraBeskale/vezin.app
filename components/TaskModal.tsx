"use client";

import { useState, useRef, ChangeEvent } from "react";
import PriorityBadge from "./PriorityBadge";

type Status = "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";
type Priority = "LOW" | "MEDIUM" | "HIGH";
type Tab = "detay" | "dosyalar" | "yorumlar" | "aktivite";

interface User { id: string; name: string; email?: string; }
interface FileRecord { id: string; filename: string; comment?: string | null; uploadedBy: { name: string }; createdAt: string; }
interface FeedbackRecord { id: string; message: string; fromUser: { name: string; role: string }; createdAt: string; }
interface LogRecord {
  id: string;
  user: { name: string };
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  timestamp: string;
  durationMinutes: number | null;
}

export interface TaskFull {
  id: string;
  title: string;
  description: string | null;
  status: Status;
  priority: Priority;
  assignedTo: User | null;
  assignedToId: string | null;
  dueDate: string | null;
  createdBy: { name: string };
  createdAt: string;
  files: FileRecord[];
  feedbacks: FeedbackRecord[];
  logs: LogRecord[];
}

const STATUS_LABELS: Record<Status, string> = {
  TODO: "Yapılacak",
  IN_PROGRESS: "Devam Ediyor",
  REVIEW: "İncelemede",
  DONE: "Tamamlandı",
};

const STATUS_COLORS: Record<string, string> = {
  TODO: "text-gray-500",
  IN_PROGRESS: "text-orange-500",
  REVIEW: "text-indigo-500",
  DONE: "text-emerald-500",
};

const ACTION_LABELS: Record<string, string> = {
  STARTED: "başlattı",
  COMPLETED: "tamamladı",
  STATUS_CHANGED: "durumu değiştirdi",
};

const ACTION_ICONS: Record<string, string> = {
  STARTED: "▶",
  COMPLETED: "✓",
  STATUS_CHANGED: "↔",
};

const ACTION_COLORS: Record<string, string> = {
  STARTED: "bg-orange-100 text-orange-600",
  COMPLETED: "bg-emerald-100 text-emerald-600",
  STATUS_CHANGED: "bg-gray-100 text-gray-500",
};

interface Props {
  task: TaskFull;
  users: User[];
  isAdmin: boolean;
  onClose: () => void;
  onUpdate: (task: TaskFull) => void;
}

export default function TaskModal({ task, users, isAdmin, onClose, onUpdate }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("detay");
  const [status, setStatus] = useState<Status>(task.status);
  const [assignedToId, setAssignedToId] = useState<string>(task.assignedToId ?? "");
  const [dueDate, setDueDate] = useState<string>(task.dueDate ? task.dueDate.slice(0, 10) : "");
  const [files, setFiles] = useState<FileRecord[]>(task.files);
  const [feedbacks, setFeedbacks] = useState<FeedbackRecord[]>(task.feedbacks);
  const [logs, setLogs] = useState<LogRecord[]>(task.logs ?? []);
  const [feedbackMsg, setFeedbackMsg] = useState("");
  const [fileComment, setFileComment] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingFb, setSendingFb] = useState(false);
  const [toast, setToast] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  async function patchTask(data: Record<string, unknown>) {
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Güncelleme başarısız");
    return res.json() as Promise<TaskFull>;
  }

  async function handleStatusChange(newStatus: Status) {
    setStatus(newStatus);
    try {
      const updated = await patchTask({ status: newStatus });
      setLogs(updated.logs ?? []);
      onUpdate(updated);
      showToast("Durum güncellendi");
    } catch {
      setStatus(task.status);
    }
  }

  async function handleAdminSave() {
    setSaving(true);
    try {
      const updated = await patchTask({ assignedToId: assignedToId || null, dueDate: dueDate || null });
      onUpdate(updated);
      showToast("Kaydedildi");
    } catch {
      showToast("Hata oluştu");
    } finally {
      setSaving(false);
    }
  }

  async function handleFileUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    if (fileComment.trim()) fd.append("comment", fileComment.trim());
    try {
      const res = await fetch(`/api/tasks/${task.id}/files`, { method: "POST", body: fd });
      if (!res.ok) throw new Error();
      const newFile = await res.json();
      setFiles((prev) => [newFile, ...prev]);
      setFileComment("");
      showToast("Dosya yüklendi");
    } catch {
      showToast("Yükleme başarısız");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleSendFeedback() {
    if (!feedbackMsg.trim()) return;
    setSendingFb(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.id, message: feedbackMsg.trim() }),
      });
      if (!res.ok) throw new Error();
      const fb = await res.json();
      setFeedbacks((prev) => [...prev, fb]);
      setFeedbackMsg("");
      showToast("Mesaj gönderildi");
    } catch {
      showToast("Gönderilemedi");
    } finally {
      setSendingFb(false);
    }
  }

  function fmtDate(d: string) {
    return new Date(d).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
  }
  function fmtDateTime(d: string) {
    return new Date(d).toLocaleString("tr-TR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }
  function fmtDuration(minutes: number | null): string {
    if (!minutes || minutes <= 0) return "< 1 dk";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m} dk`;
    if (m === 0) return `${h} sa`;
    return `${h} sa ${m} dk`;
  }

  const totalMinutes = logs.filter((l) => l.action === "COMPLETED" && l.durationMinutes).reduce((sum, l) => sum + (l.durationMinutes ?? 0), 0);
  const startedLog = logs.find((l) => l.action === "STARTED");
  const completedLog = [...logs].reverse().find((l) => l.action === "COMPLETED");

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "detay", label: "Detay" },
    { key: "dosyalar", label: "Dosyalar", count: files.length },
    { key: "yorumlar", label: "Yorumlar", count: feedbacks.length },
    { key: "aktivite", label: "Aktivite", count: logs.length },
  ];

  return (
    /* Wrapper: bottom-sheet on mobile, centered on sm+ */
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 sm:p-4">
      <div className="bg-white w-full sm:max-w-2xl max-h-[95vh] sm:max-h-[92vh] flex flex-col rounded-t-2xl sm:rounded-2xl shadow-2xl">

        {/* Header */}
        <div className="flex items-start justify-between p-4 sm:p-6 pb-0 border-b border-gray-100 flex-shrink-0">
          <div className="flex-1 min-w-0 pr-4 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-gray-400">{task.id.slice(0, 8)}</span>
              <PriorityBadge priority={task.priority} />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-gray-800 leading-snug">{task.title}</h2>
            {task.description && (
              <p className="text-sm text-gray-500 mt-1 line-clamp-2">{task.description}</p>
            )}
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors flex-shrink-0 mt-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab bar — scrollable on narrow screens */}
        <div className="flex border-b border-gray-100 px-4 sm:px-6 flex-shrink-0 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
                activeTab === t.key
                  ? "border-[#F57C28] text-[#F57C28]"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  activeTab === t.key ? "bg-[#F57C28]/15 text-[#F57C28]" : "bg-gray-100 text-gray-500"
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">

          {/* ── DETAY ── */}
          {activeTab === "detay" && (
            <div className="space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Durum</label>
                  <select
                    value={status}
                    onChange={(e) => handleStatusChange(e.target.value as Status)}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28] bg-white"
                  >
                    {(Object.keys(STATUS_LABELS) as Status[]).map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
                {isAdmin ? (
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Atanan Kişi</label>
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
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Atanan</label>
                    <p className="text-sm text-gray-700 py-2">{task.assignedTo?.name ?? "—"}</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Son Tarih</label>
                  {isAdmin ? (
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28]"
                    />
                  ) : (
                    <p className="text-sm text-gray-700 py-2">{task.dueDate ? fmtDate(task.dueDate) : "—"}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Oluşturan</label>
                  <p className="text-sm text-gray-700 py-2">{task.createdBy.name} · {fmtDate(task.createdAt)}</p>
                </div>
              </div>

              {isAdmin && (
                <button
                  onClick={handleAdminSave}
                  disabled={saving}
                  className="flex items-center gap-2 bg-[#F57C28] hover:bg-[#D96A1A] disabled:opacity-60 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-md shadow-[#F57C28]/25"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {saving ? "Kaydediliyor..." : "Kaydet"}
                </button>
              )}
            </div>
          )}

          {/* ── DOSYALAR ── */}
          {activeTab === "dosyalar" && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Dosyalar ({files.length})
              </h3>
              <div className="mb-4 p-3.5 rounded-xl border border-dashed border-gray-200 bg-gray-50 space-y-2.5">
                <textarea
                  value={fileComment}
                  onChange={(e) => setFileComment(e.target.value)}
                  placeholder="Dosya hakkında not ekleyin... (opsiyonel)"
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs text-gray-700 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28] bg-white"
                />
                <label className={`flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2.5 rounded-lg cursor-pointer transition-colors w-full ${uploading ? "opacity-50 cursor-not-allowed bg-gray-100 text-gray-400" : "bg-[#F57C28]/10 text-[#F57C28] hover:bg-[#F57C28]/20"}`}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  {uploading ? "Yükleniyor..." : "Dosya Seç ve Yükle"}
                  <input type="file" className="hidden" ref={fileRef} disabled={uploading} onChange={handleFileUpload} />
                </label>
              </div>
              {files.length === 0 ? (
                <p className="text-xs text-gray-400 py-8 text-center border border-dashed border-gray-200 rounded-xl">
                  Henüz dosya yüklenmedi
                </p>
              ) : (
                <div className="space-y-2">
                  {files.map((f) => (
                    <div key={f.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50 hover:bg-gray-100 transition-colors">
                      <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-700 truncate">{f.filename}</p>
                        <p className="text-[10px] text-gray-400">{f.uploadedBy.name} · {fmtDate(f.createdAt)}</p>
                        {f.comment && (
                          <p className="text-[10px] text-indigo-600 mt-0.5 italic">"{f.comment}"</p>
                        )}
                      </div>
                      <a
                        href={`/api/files/${f.id}/download`}
                        download={f.filename}
                        className="flex items-center gap-1 text-xs text-[#F57C28] hover:text-[#D96A1A] font-medium flex-shrink-0 py-1 px-2 rounded-lg hover:bg-orange-50 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        İndir
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── YORUMLAR ── */}
          {activeTab === "yorumlar" && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Yorumlar ({feedbacks.length})
              </h3>
              {feedbacks.length > 0 && (
                <div className="space-y-2.5 mb-4">
                  {feedbacks.map((fb) => {
                    const isAdminMsg = fb.fromUser.role === "ADMIN";
                    return (
                      <div key={fb.id} className={`rounded-xl p-3 border ${isAdminMsg ? "bg-[#FFF3E9] border-[#F57C28]/20" : "bg-indigo-50 border-indigo-100"}`}>
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <span className={`text-[10px] font-bold ${isAdminMsg ? "text-[#F57C28]" : "text-indigo-600"}`}>{fb.fromUser.name}</span>
                          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${isAdminMsg ? "bg-[#F57C28]/15 text-[#F57C28]" : "bg-indigo-100 text-indigo-500"}`}>
                            {isAdminMsg ? "Admin" : "Çalışan"}
                          </span>
                          <span className={`text-[10px] ml-auto ${isAdminMsg ? "text-[#F57C28]/50" : "text-indigo-400"}`}>{fmtDate(fb.createdAt)}</span>
                        </div>
                        <p className={`text-sm ${isAdminMsg ? "text-orange-900" : "text-indigo-800"}`}>{fb.message}</p>
                      </div>
                    );
                  })}
                </div>
              )}
              {feedbacks.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-8 border border-dashed border-gray-200 rounded-xl mb-4">Henüz yorum yok</p>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={feedbackMsg}
                  onChange={(e) => setFeedbackMsg(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendFeedback()}
                  placeholder="Yorum yaz..."
                  className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28]"
                />
                <button
                  onClick={handleSendFeedback}
                  disabled={sendingFb || !feedbackMsg.trim()}
                  className="px-4 py-2.5 bg-[#F57C28] hover:bg-[#D96A1A] disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors flex-shrink-0 min-w-[72px]"
                >
                  {sendingFb ? "..." : "Gönder"}
                </button>
              </div>
            </div>
          )}

          {/* ── AKTİVİTE ── */}
          {activeTab === "aktivite" && (
            <div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 mb-5">
                <div className="bg-orange-50 border border-orange-100 rounded-xl p-3">
                  <p className="text-[10px] font-semibold text-orange-400 uppercase tracking-wide mb-1">Başlangıç</p>
                  {startedLog ? (
                    <>
                      <p className="text-xs font-bold text-orange-700">{startedLog.user.name}</p>
                      <p className="text-[10px] text-orange-500 mt-0.5">{fmtDateTime(startedLog.timestamp)}</p>
                    </>
                  ) : <p className="text-xs text-orange-300">Henüz başlanmadı</p>}
                </div>
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                  <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wide mb-1">Tamamlanma</p>
                  {completedLog ? (
                    <>
                      <p className="text-xs font-bold text-emerald-700">{completedLog.user.name}</p>
                      <p className="text-[10px] text-emerald-500 mt-0.5">{fmtDateTime(completedLog.timestamp)}</p>
                    </>
                  ) : <p className="text-xs text-emerald-300">Henüz tamamlanmadı</p>}
                </div>
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
                  <p className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wide mb-1">Toplam Çalışma</p>
                  {totalMinutes > 0
                    ? <p className="text-sm font-bold text-indigo-700">{fmtDuration(totalMinutes)}</p>
                    : <p className="text-xs text-indigo-300">Veri yok</p>}
                </div>
              </div>

              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Geçmiş ({logs.length})</h3>
              {logs.length === 0 ? (
                <p className="text-xs text-gray-400 py-8 text-center border border-dashed border-gray-200 rounded-xl">Henüz aktivite kaydı yok</p>
              ) : (
                <div className="space-y-2">
                  {logs.map((log, i) => (
                    <div key={log.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${ACTION_COLORS[log.action] ?? "bg-gray-100 text-gray-500"}`}>
                          {ACTION_ICONS[log.action] ?? "•"}
                        </span>
                        {i < logs.length - 1 && <div className="w-px flex-1 bg-gray-100 mt-1" />}
                      </div>
                      <div className="pb-4 flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-semibold text-gray-700">{log.user.name}</span>
                          <span className="text-xs text-gray-400">{ACTION_LABELS[log.action] ?? log.action}</span>
                          {log.fromStatus && log.toStatus && (
                            <span className="text-[10px] text-gray-400 flex items-center gap-1">
                              <span className={`font-medium ${STATUS_COLORS[log.fromStatus] ?? ""}`}>{STATUS_LABELS[log.fromStatus as Status] ?? log.fromStatus}</span>
                              <span>→</span>
                              <span className={`font-medium ${STATUS_COLORS[log.toStatus] ?? ""}`}>{STATUS_LABELS[log.toStatus as Status] ?? log.toStatus}</span>
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-gray-400">{fmtDateTime(log.timestamp)}</span>
                          {log.durationMinutes !== null && log.durationMinutes > 0 && (
                            <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                              {fmtDuration(log.durationMinutes)} çalışıldı
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Toast */}
        {toast && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs font-medium px-4 py-2 rounded-full shadow-lg whitespace-nowrap">
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}
