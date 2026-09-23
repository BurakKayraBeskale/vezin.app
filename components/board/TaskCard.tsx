"use client";

import { useState } from "react";
import clsx from "clsx";
import PriorityBadge from "../PriorityBadge";
import SubmitReviewModal from "../SubmitReviewModal";
import { canSubmitForReview, canReviewTask, WorkflowUser } from "@/lib/task-permissions";
import { BoardTask, isOverdueTask } from "./types";

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function fmtDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

interface Props {
  task: BoardTask;
  currentUserId: string;
  userIdentity: WorkflowUser;
  onOpen: (taskId: string) => void;
  /** Panonun arka planda yeniden yüklenmesini tetikler — hard refresh gerekmez (#43). */
  onActionDone: () => void;
}

/**
 * Görev kartı — sade tutulur (#21): başlık, açıklama önizlemesi, proje/projesiz,
 * öncelik, son tarih/gecikmiş, atanan, alt görev göstergesi. created_by,
 * review_owner, dosya/feedback/history gibi ayrıntılar Task Detail'de.
 *
 * Kart üzerinde EN FAZLA bir contextual quick action bulunur (#30) — durum ve
 * yetkiye göre mevcut Task Core fonksiyonlarıyla (canSubmitForReview,
 * canReviewTask) hesaplanır; hiçbir yeni iş kuralı üretilmez. Aksiyonlar
 * mevcut PATCH /api/tasks/[id] ve SubmitReviewModal üzerinden yürür.
 */
export default function TaskCard({ task, currentUserId, userIdentity, onOpen, onActionDone }: Props) {
  const [starting, setStarting] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);
  const [actionError, setActionError] = useState("");

  const overdue = isOverdueTask(task);
  const isAssignee = task.assignedToId === currentUserId;
  const canSubmit = canSubmitForReview(userIdentity, { assignedToId: task.assignedToId });
  const canReview =
    canReviewTask(userIdentity, { reviewOwnerId: task.reviewOwnerId, assignedToId: task.assignedToId }) && !isAssignee;

  // #31-#34: durum + yetkiye göre TEK contextual quick action.
  let quickAction: "start" | "submit" | "review" | null = null;
  if (task.status === "TODO" && isAssignee) quickAction = "start";
  else if (task.status === "IN_PROGRESS" && canSubmit) quickAction = "submit";
  else if (task.status === "REVIEW" && canReview) quickAction = "review";

  async function handleStart(e: React.MouseEvent) {
    e.stopPropagation();
    setStarting(true);
    setActionError("");
    try {
      // #31: mevcut Task Core workflow'u (PATCH /api/tasks/[id]) üzerinden — doğrudan DB update değil.
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "IN_PROGRESS" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setActionError(data.error || "İşlem başarısız");
        return;
      }
      onActionDone();
    } catch {
      setActionError("Sunucu hatası");
    } finally {
      setStarting(false);
    }
  }

  const parentLabel =
    task.parent && "restricted" in task.parent ? "Erişim Kısıtlı" : task.parent?.title ?? null;

  return (
    <>
      <div
        onClick={() => onOpen(task.id)}
        className="group relative bg-white rounded-xl border border-gray-200 p-3.5 transition-all cursor-pointer hover:shadow-md hover:border-gray-300"
      >
        {/* 1. Başlık */}
        <p className="text-sm font-semibold text-gray-800 leading-snug mb-1.5">{task.title}</p>

        {/* 2. Açıklama önizlemesi — en fazla 2 satır */}
        {task.description && (
          <p className="text-xs text-gray-400 mb-2 line-clamp-2">{task.description}</p>
        )}

        {/* 8/9. Alt görev göstergesi + üst görev */}
        {task.parent && (
          <div className="flex items-center gap-1 mb-2 text-[10px] font-medium text-violet-600 bg-violet-50 border border-violet-100 rounded-md px-1.5 py-1 w-fit">
            <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span>Alt Görev{parentLabel ? ` — Üst Görev: ${parentLabel}` : ""}</span>
          </div>
        )}

        {/* 3. Proje / Projesiz */}
        <p className="text-[11px] text-gray-400 mb-2 truncate">
          {task.project ? task.project.name : "Projesiz"}
        </p>

        {/* 4/5/6. Öncelik + son tarih/gecikmiş */}
        <div className="flex items-center justify-between mb-2">
          <PriorityBadge priority={task.priority} />
          {task.dueDate && (
            <span className={clsx("text-[10px] font-medium", overdue ? "text-red-500" : "text-gray-400")}>
              {overdue && "⚠ Gecikmiş · "}{fmtDate(task.dueDate)}
            </span>
          )}
        </div>

        {/* 7. Atanan kişi */}
        <div className="flex items-center justify-between gap-2">
          {task.assignedTo ? (
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-5 h-5 rounded-full bg-[#F57C28] flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0">
                {initials(task.assignedTo.name)}
              </div>
              <span className="text-[11px] text-gray-500 truncate">{task.assignedTo.name}</span>
            </div>
          ) : (
            <span className="text-[11px] text-gray-300 italic">Atanmamış</span>
          )}

          {/* #30: kart üzerinde en fazla bir hızlı aksiyon */}
          {quickAction === "start" && (
            <button
              type="button"
              onClick={handleStart}
              disabled={starting}
              className="flex-shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-[#F57C28] text-white hover:bg-[#D96A1A] disabled:opacity-60 transition-colors"
            >
              {starting ? "..." : "Çalışmaya Başla"}
            </button>
          )}
          {quickAction === "submit" && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowSubmit(true); }}
              className="flex-shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
            >
              İncelemeye Gönder
            </button>
          )}
          {quickAction === "review" && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onOpen(task.id); }}
              className="flex-shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition-colors"
            >
              İncele
            </button>
          )}
        </div>

        {actionError && (
          <p className="mt-2 text-[10px] text-red-500">{actionError}</p>
        )}
      </div>

      {showSubmit && (
        <SubmitReviewModal
          taskId={task.id}
          onClose={() => setShowSubmit(false)}
          onSubmitted={() => { setShowSubmit(false); onActionDone(); }}
        />
      )}
    </>
  );
}
