"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { canDeleteTask } from "@/lib/task-permissions";
import StatusBadge from "./StatusBadge";
import PriorityBadge from "./PriorityBadge";
import TaskFormModal from "./TaskFormModal";
import { TaskFull } from "./TaskModal";

const STATUS_LABELS: Record<string, string> = {
  TODO: "Yapılacak",
  IN_PROGRESS: "Devam Ediyor",
  REVIEW: "İncelemede",
  DONE: "Tamamlandı",
};

const STATUS_TRANSITIONS: Record<
  string,
  { status: string; label: string; secondary?: boolean }[]
> = {
  TODO: [{ status: "IN_PROGRESS", label: "Başlat" }],
  IN_PROGRESS: [{ status: "REVIEW", label: "İncelemeye Gönder" }],
  REVIEW: [
    { status: "DONE", label: "Tamamla" },
    { status: "IN_PROGRESS", label: "Geri Gönder", secondary: true },
  ],
  DONE: [{ status: "IN_PROGRESS", label: "Yeniden Aç", secondary: true }],
};

const ACTION_LABELS: Record<string, string> = {
  STARTED: "başlattı",
  COMPLETED: "tamamladı",
  STATUS_CHANGED: "durumu değiştirdi",
  CREATED: "oluşturdu",
  ASSIGNED: "atandı",
  UPDATED: "güncelledi",
};

interface Props {
  taskId: string;
  initialTask?: TaskFull;
  users?: { id: string; name: string }[];
  isAdmin?: boolean;
  onClose: () => void;
  onUpdate?: (task: TaskFull) => void;
  onDelete?: (taskId: string) => void;
}

export default function TaskDetail({
  taskId,
  initialTask,
  users = [],
  isAdmin = false,
  onClose,
  onUpdate,
  onDelete,
}: Props) {
  const { data: session } = useSession();
  const [task, setTask] = useState<TaskFull | null>(initialTask ?? null);
  const [loading, setLoading] = useState(!initialTask);
  const [loadError, setLoadError] = useState("");
  const [showEdit, setShowEdit] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (initialTask) return;
    setLoading(true);
    setLoadError("");
    fetch(`/api/tasks/${taskId}`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => setTask(data))
      .catch(() => setLoadError("Görev yüklenemedi"))
      .finally(() => setLoading(false));
  }, [taskId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function changeStatus(newStatus: string) {
    if (!task) return;
    setStatusLoading(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const updated: TaskFull = await res.json();
        setTask(updated);
        onUpdate?.(updated);
      }
    } finally {
      setStatusLoading(false);
    }
  }

  async function handleDelete() {
    if (!task || !confirm(`"${task.title}" görevi kalıcı olarak silinecek. Emin misiniz?`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      if (res.ok) {
        onDelete?.(task.id);
        onClose();
      }
    } finally {
      setDeleting(false);
    }
  }

  const userIdentity = session
    ? {
        id: (session.user as any).id as string,
        role: (session.user as any).role as string,
        canViewAllProjects:
          ((session.user as any).canViewAllProjects as boolean) ?? false,
        overseesDepartment:
          ((session.user as any).overseesDepartment as string | null) ?? null,
      }
    : null;

  const canDelete =
    userIdentity && task
      ? canDeleteTask(
          userIdentity,
          {
            createdById: task.createdBy.id,
            assignedToId: task.assignedToId ?? null,
          },
          task.project ?? null
        )
      : false;

  const isOverdue =
    !!task?.dueDate && task.status !== "DONE" && new Date(task.dueDate) < new Date();

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col"
          style={{ maxHeight: "90vh" }}
        >
          {/* Header bar */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
              Görev Detayı
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Body */}
          {loading ? (
            <div className="flex-1 flex items-center justify-center py-16 text-gray-400 text-sm">
              Yükleniyor...
            </div>
          ) : loadError ? (
            <div className="flex-1 flex items-center justify-center py-16 text-red-400 text-sm">
              {loadError}
            </div>
          ) : task ? (
            <div className="flex-1 overflow-y-auto">
              {/* ── Üst bilgi ── */}
              <div className="px-6 py-5 border-b border-gray-100">
                <h1 className="text-xl font-bold text-gray-900 mb-3 leading-snug">
                  {task.title}
                </h1>

                {/* Rozetler */}
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <StatusBadge status={task.status} />
                  <PriorityBadge priority={task.priority} />
                  {isOverdue && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                      Gecikmiş
                    </span>
                  )}
                </div>

                {/* Meta bilgiler */}
                <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm mb-5">
                  <div>
                    <dt className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                      Atanan
                    </dt>
                    <dd className="text-gray-800 font-medium">
                      {task.assignedTo?.name ?? "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                      Oluşturan
                    </dt>
                    <dd className="text-gray-800 font-medium">{task.createdBy.name}</dd>
                  </div>
                  {task.project && (task.project as any).name && (
                    <div>
                      <dt className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                        Proje
                      </dt>
                      <dd className="text-gray-800 font-medium">
                        {(task.project as any).name}
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                      Son Tarih
                    </dt>
                    <dd
                      className={`font-medium ${
                        isOverdue ? "text-red-600" : "text-gray-800"
                      }`}
                    >
                      {task.dueDate
                        ? new Date(task.dueDate).toLocaleDateString("tr-TR", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })
                        : "—"}
                    </dd>
                  </div>
                </dl>

                {/* Aksiyon butonları */}
                <div className="flex flex-wrap items-center gap-2">
                  {(STATUS_TRANSITIONS[task.status] ?? []).map((t) => (
                    <button
                      key={t.status}
                      onClick={() => changeStatus(t.status)}
                      disabled={statusLoading}
                      className={`px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60 ${
                        t.secondary
                          ? "border border-gray-200 text-gray-600 hover:bg-gray-50"
                          : "bg-[#F57C28] text-white hover:bg-[#D96A1A] shadow-sm shadow-[#F57C28]/25"
                      }`}
                    >
                      {statusLoading ? "..." : t.label}
                    </button>
                  ))}
                  {isAdmin && (
                    <button
                      onClick={() => setShowEdit(true)}
                      className="px-3.5 py-2 rounded-lg text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      Düzenle
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="px-3.5 py-2 rounded-lg text-sm font-semibold border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-60 transition-colors"
                    >
                      {deleting ? "Siliniyor..." : "Sil"}
                    </button>
                  )}
                </div>
              </div>

              {/* ── 1. Açıklama ── */}
              <section className="px-6 py-4 border-b border-gray-50">
                <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  Açıklama
                </h3>
                {task.description ? (
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {task.description}
                  </p>
                ) : (
                  <p className="text-sm text-gray-400 italic">Açıklama yok</p>
                )}
              </section>

              {/* ── 2. Kaynaklar (yer tutucu) ── */}
              <section className="px-6 py-4 border-b border-gray-50">
                <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  Kaynaklar
                </h3>
                <p className="text-sm text-gray-400 italic">Yakında eklenecek</p>
              </section>

              {/* ── 3. Alt Görevler ── */}
              <section className="px-6 py-4 border-b border-gray-50">
                <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  Alt Görevler
                </h3>
                {task.parent && (
                  <p className="text-xs text-gray-500 mb-2">
                    Üst görev:{" "}
                    <span className="font-medium text-gray-700">{task.parent.title}</span>
                  </p>
                )}
                {(task.children?.length ?? 0) > 0 ? (
                  <ul className="space-y-1.5">
                    {task.children!.map((c) => (
                      <li key={c.id} className="flex items-center gap-2 text-sm text-gray-700">
                        <StatusBadge status={c.status as any} />
                        <span>{c.title}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  !task.parent && (
                    <p className="text-sm text-gray-400 italic">Alt görev yok</p>
                  )
                )}
              </section>

              {/* ── 4. İnceleme & Revizyon Geçmişi (yer tutucu) ── */}
              <section className="px-6 py-4 border-b border-gray-50">
                <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  İnceleme & Revizyon Geçmişi
                </h3>
                {task.feedbacks?.length > 0 ? (
                  <ul className="space-y-3">
                    {task.feedbacks.map((f: any) => (
                      <li key={f.id}>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-semibold text-gray-800">
                            {f.fromUser.name}
                          </span>
                          <span className="text-xs text-gray-400">
                            {new Date(f.createdAt).toLocaleDateString("tr-TR")}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">{f.message}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-400 italic">Yakında eklenecek</p>
                )}
              </section>

              {/* ── 5. Görev Geçmişi (accordion, kapalı) ── */}
              <section className="px-6 py-4">
                <button
                  type="button"
                  onClick={() => setHistoryOpen((v) => !v)}
                  className="flex items-center gap-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide hover:text-gray-600 transition-colors"
                >
                  Görev Geçmişi
                  <svg
                    className={`w-3.5 h-3.5 transition-transform ${
                      historyOpen ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {historyOpen && (
                  <ul className="mt-3 space-y-2">
                    {(task.logs?.length ?? 0) > 0 ? (
                      task.logs!.map((l: any) => (
                        <li key={l.id} className="flex items-start gap-3 text-sm">
                          <span className="text-xs text-gray-400 whitespace-nowrap mt-0.5">
                            {new Date(l.timestamp).toLocaleDateString("tr-TR", {
                              day: "numeric",
                              month: "short",
                            })}
                          </span>
                          <span className="text-gray-600">
                            <span className="font-medium text-gray-800">{l.user.name}</span>{" "}
                            {ACTION_LABELS[l.action] ?? l.action}
                            {l.fromStatus && l.toStatus && (
                              <span className="text-gray-400">
                                {" "}
                                ({STATUS_LABELS[l.fromStatus] ?? l.fromStatus} →{" "}
                                {STATUS_LABELS[l.toStatus] ?? l.toStatus})
                              </span>
                            )}
                          </span>
                        </li>
                      ))
                    ) : (
                      <p className="text-sm text-gray-400 italic">Geçmiş yok</p>
                    )}
                  </ul>
                )}
              </section>
            </div>
          ) : null}
        </div>
      </div>

      {showEdit && task && (
        <TaskFormModal
          task={task}
          users={users}
          onClose={() => setShowEdit(false)}
          onUpdate={(updated) => {
            setTask(updated);
            onUpdate?.(updated);
            setShowEdit(false);
          }}
        />
      )}
    </>
  );
}
