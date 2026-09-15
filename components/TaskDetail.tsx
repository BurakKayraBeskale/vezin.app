"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  canDeleteTask,
  canManageTask,
  canManageTaskSource,
  canReviewTask,
  canTakeOverReview,
  canReopenTask,
  canCreateSubtask,
  canSubmitForReview,
} from "@/lib/task-permissions";
import StatusBadge from "./StatusBadge";
import PriorityBadge from "./PriorityBadge";
import TaskFormModal from "./TaskFormModal";
import ConfirmModal from "./ConfirmModal";
import SubmitReviewModal from "./SubmitReviewModal";
import RequestRevisionModal from "./RequestRevisionModal";
import ReopenModal from "./ReopenModal";
import ReassignModal from "./ReassignModal";
import TaskResourcesSection from "./TaskResourcesSection";
import SubtaskSection from "./SubtaskSection";
import ReviewHistoryTimeline from "./ReviewHistoryTimeline";
import RecurringSeriesPanel from "./RecurringSeriesPanel";
import { TaskFull } from "./TaskModal";

const STATUS_LABELS: Record<string, string> = {
  TODO: "Yapılacak",
  IN_PROGRESS: "Devam Ediyor",
  REVIEW: "İncelemede",
  DONE: "Tamamlandı",
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
  taskId: rootTaskId,
  initialTask,
  users = [],
  isAdmin = false,
  onClose,
  onUpdate,
  onDelete,
}: Props) {
  const { data: session } = useSession();

  // ── İç gezinme: alt/üst göreve tıklayınca aynı modal içinde açılır ─────────
  const [currentId, setCurrentId] = useState(rootTaskId);
  const [navStack, setNavStack] = useState<string[]>([]);

  const [task, setTask] = useState<TaskFull | null>(
    initialTask && initialTask.id === rootTaskId ? initialTask : null
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");

  const [showEdit, setShowEdit] = useState(false);
  const [showReassign, setShowReassign] = useState(false);
  const [showSubmitReview, setShowSubmitReview] = useState(false);
  const [showRequestRevision, setShowRequestRevision] = useState(false);
  const [showReopen, setShowReopen] = useState(false);
  const [showApprove, setShowApprove] = useState(false);
  const [showTakeOver, setShowTakeOver] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmError, setConfirmError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);

  const fetchTask = useCallback((id: string) => {
    setLoading(true);
    setLoadError("");
    setActionError("");
    fetch(`/api/tasks/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data: TaskFull) => setTask(data))
      .catch(() => setLoadError("Görev yüklenemedi"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchTask(currentId);
  }, [currentId, fetchTask]);

  function navigateTo(id: string) {
    if (id === currentId) return;
    setNavStack((prev) => [...prev, currentId]);
    setCurrentId(id);
  }

  function goBack() {
    setNavStack((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const prevId = next.pop() as string;
      setCurrentId(prevId);
      return next;
    });
  }

  /** Görevi günceller; kök görev (modal'ın açıldığı görev) değiştiyse çağıran bileşene bildirir. */
  function applyUpdate(updated: TaskFull) {
    setTask(updated);
    if (updated.id === rootTaskId) onUpdate?.(updated);
  }

  async function changeStatus(newStatus: string) {
    if (!task) return;
    setStatusLoading(true);
    setActionError("");
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || "İşlem başarısız");
        return;
      }
      applyUpdate(data);
    } catch {
      setActionError("Sunucu hatası");
    } finally {
      setStatusLoading(false);
    }
  }

  async function runConfirmAction(action: "approve" | "take_over_review") {
    if (!task) return;
    setConfirmLoading(true);
    setConfirmError("");
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setConfirmError(data.error || "İşlem başarısız");
        return;
      }
      applyUpdate(data);
      setShowApprove(false);
      setShowTakeOver(false);
    } catch {
      setConfirmError("Sunucu hatası");
    } finally {
      setConfirmLoading(false);
    }
  }

  async function handleDelete() {
    if (!task || !confirm(`"${task.title}" görevi kalıcı olarak silinecek. Emin misiniz?`)) return;
    setDeleting(true);
    setActionError("");
    try {
      const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      if (res.ok) {
        if (task.id === rootTaskId) {
          onDelete?.(task.id);
          onClose();
        } else {
          goBack();
        }
      } else {
        const data = await res.json().catch(() => ({}));
        setActionError(data.error || "Görev silinemedi");
      }
    } finally {
      setDeleting(false);
    }
  }

  const userIdentity = session
    ? {
        id: (session.user as any).id as string,
        role: (session.user as any).role as string,
        department: (session.user as any).department as string | undefined,
        seniorityLevel: (session.user as any).seniorityLevel as number | undefined,
        canViewAllProjects: ((session.user as any).canViewAllProjects as boolean) ?? false,
        overseesDepartment: ((session.user as any).overseesDepartment as string | null) ?? null,
      }
    : null;

  const isManager = !!userIdentity && (userIdentity.role === "ADMIN" || userIdentity.canViewAllProjects);

  // ── Yetki kararları — tek kaynak lib/task-permissions.ts (bileşen içinde kural yazılmaz) ──
  const isAssignee = !!userIdentity && !!task && task.assignedToId === userIdentity.id;
  const canSubmit =
    !!userIdentity && !!task && canSubmitForReview(userIdentity, { assignedToId: task.assignedToId });
  const canReview =
    !!userIdentity &&
    !!task &&
    canReviewTask(userIdentity, { reviewOwnerId: task.reviewOwnerId, assignedToId: task.assignedToId }) &&
    !isAssignee; // kendi görevini onaylayamaz/revizyona gönderemez (backend de bunu reddeder)
  const canManage =
    !!userIdentity &&
    !!task &&
    canManageTask(userIdentity, {
      assignedToId: task.assignedToId,
      reviewOwnerId: task.reviewOwnerId,
      status: task.status,
    });
  const canManageSource =
    !!userIdentity &&
    !!task &&
    canManageTaskSource(userIdentity, { assignedToId: task.assignedToId, reviewOwnerId: task.reviewOwnerId });
  const canTakeOver =
    !!userIdentity &&
    !!task &&
    canTakeOverReview(userIdentity, {
      reviewOwnerId: task.reviewOwnerId,
      reviewOwnerSeniorityLevel: task.reviewOwnerSeniorityLevel ?? null,
    });
  const canReopen = !!userIdentity && !!task && canReopenTask(userIdentity, { reviewOwnerId: task.reviewOwnerId });
  const canCreateSub =
    !!userIdentity &&
    !!task &&
    canCreateSubtask(userIdentity, {
      assignedToId: task.assignedToId,
      reviewOwnerId: task.reviewOwnerId,
      projectCreatedById: task.project?.createdById ?? null,
    });
  const canDelete =
    userIdentity && task
      ? canDeleteTask(
          userIdentity,
          { createdById: task.createdBy.id, assignedToId: task.assignedToId ?? null },
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
            <div className="flex items-center gap-1.5">
              {navStack.length > 0 && (
                <button
                  onClick={goBack}
                  title="Geri"
                  className="p-1.5 -ml-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                </button>
              )}
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
                Görev Detayı
              </h2>
            </div>
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

                {/* Aksiyon butonları — duruma VE yetkiye göre gösterilir (lib/task-permissions.ts) */}
                <div className="flex flex-wrap items-center gap-2">
                  {isAssignee && task.status === "TODO" && (
                    <button
                      onClick={() => changeStatus("IN_PROGRESS")}
                      disabled={statusLoading}
                      className="px-3.5 py-2 rounded-lg text-sm font-semibold bg-[#F57C28] text-white hover:bg-[#D96A1A] shadow-sm shadow-[#F57C28]/25 disabled:opacity-60 transition-colors"
                    >
                      {statusLoading ? "..." : "Çalışmaya Başla"}
                    </button>
                  )}

                  {canSubmit && task.status === "IN_PROGRESS" && (
                    <button
                      onClick={() => setShowSubmitReview(true)}
                      className="px-3.5 py-2 rounded-lg text-sm font-semibold bg-[#F57C28] text-white hover:bg-[#D96A1A] shadow-sm shadow-[#F57C28]/25 transition-colors"
                    >
                      İncelemeye Gönder
                    </button>
                  )}

                  {canReview && task.status === "REVIEW" && (
                    <>
                      <button
                        onClick={() => setShowApprove(true)}
                        className="px-3.5 py-2 rounded-lg text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-600/25 transition-colors"
                      >
                        Onayla
                      </button>
                      <button
                        onClick={() => setShowRequestRevision(true)}
                        className="px-3.5 py-2 rounded-lg text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        Revizyon İste
                      </button>
                    </>
                  )}

                  {canManage && (
                    <>
                      <button
                        onClick={() => setShowEdit(true)}
                        className="px-3.5 py-2 rounded-lg text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        Düzenle
                      </button>
                      <button
                        onClick={() => setShowReassign(true)}
                        className="px-3.5 py-2 rounded-lg text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        Atanan Kişiyi Değiştir
                      </button>
                    </>
                  )}

                  {canTakeOver && (
                    <button
                      onClick={() => setShowTakeOver(true)}
                      className="px-3.5 py-2 rounded-lg text-sm font-semibold border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition-colors"
                    >
                      İncelemeyi Devral
                    </button>
                  )}

                  {task.status === "DONE" && canReopen && (
                    <button
                      onClick={() => setShowReopen(true)}
                      className="px-3.5 py-2 rounded-lg text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      Yeniden Aç
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

                {actionError && (
                  <div className="mt-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-2.5">
                    {actionError}
                  </div>
                )}
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

              {/* ── 2. Kaynaklar ── */}
              <TaskResourcesSection
                taskId={task.id}
                files={task.files}
                sources={task.sources ?? []}
                canManage={canManageSource}
                onFileAdded={(file) =>
                  setTask((prev) => (prev ? { ...prev, files: [file, ...prev.files] } : prev))
                }
                onSourceAdded={(source) =>
                  setTask((prev) =>
                    prev ? { ...prev, sources: [...(prev.sources ?? []), source] } : prev
                  )
                }
              />

              {/* ── 3. Alt Görevler ── */}
              <SubtaskSection
                task={task}
                canCreateSubtask={canCreateSub}
                onNavigate={navigateTo}
                onChildAdded={(child) =>
                  setTask((prev) =>
                    prev ? { ...prev, children: [...(prev.children ?? []), child] } : prev
                  )
                }
              />

              {/* ── 4. Tekrarlayan Görev Serisi ── */}
              {task.isRecurring && task.recurringSeriesId && userIdentity && (
                <RecurringSeriesPanel
                  recurringSeriesId={task.recurringSeriesId}
                  currentUserId={userIdentity.id}
                  isManager={isManager}
                />
              )}

              {/* ── 5. İnceleme & Revizyon Geçmişi ── */}
              <section className="px-6 py-4 border-b border-gray-50">
                <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  İnceleme & Revizyon Geçmişi
                </h3>
                <ReviewHistoryTimeline taskId={task.id} rounds={task.reviewRounds ?? []} />
              </section>

              {/* ── 6. Görev Geçmişi (accordion, kapalı) ── */}
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
            applyUpdate(updated);
            setShowEdit(false);
          }}
        />
      )}

      {showReassign && task && (
        <ReassignModal
          taskId={task.id}
          projectId={task.project?.id}
          departmentId={task.departmentId ?? undefined}
          currentAssigneeId={task.assignedToId}
          onClose={() => setShowReassign(false)}
          onSubmitted={(updated) => {
            applyUpdate(updated);
            setShowReassign(false);
          }}
        />
      )}

      {showSubmitReview && task && (
        <SubmitReviewModal
          taskId={task.id}
          onClose={() => setShowSubmitReview(false)}
          onSubmitted={(updated) => {
            applyUpdate(updated);
            setShowSubmitReview(false);
          }}
        />
      )}

      {showRequestRevision && task && (
        <RequestRevisionModal
          taskId={task.id}
          onClose={() => setShowRequestRevision(false)}
          onSubmitted={(updated) => {
            applyUpdate(updated);
            setShowRequestRevision(false);
          }}
        />
      )}

      {showReopen && task && (
        <ReopenModal
          taskId={task.id}
          onClose={() => setShowReopen(false)}
          onSubmitted={(updated) => {
            applyUpdate(updated);
            setShowReopen(false);
          }}
        />
      )}

      {showApprove && (
        <ConfirmModal
          title="Görevi Onayla"
          message="Bu görevi onaylamak üzeresiniz. Onaylandıktan sonra görev Tamamlandı durumuna geçecektir."
          confirmLabel="Onayla"
          loading={confirmLoading}
          error={confirmError}
          onConfirm={() => runConfirmAction("approve")}
          onCancel={() => { setShowApprove(false); setConfirmError(""); }}
        />
      )}

      {showTakeOver && (
        <ConfirmModal
          title="İncelemeyi Devral"
          message="Bu görevin inceleme sorumluluğunu devralmak üzeresiniz. Mevcut inceleme sahibine bildirim gönderilecektir."
          confirmLabel="Devral"
          loading={confirmLoading}
          error={confirmError}
          onConfirm={() => runConfirmAction("take_over_review")}
          onCancel={() => { setShowTakeOver(false); setConfirmError(""); }}
        />
      )}
    </>
  );
}
