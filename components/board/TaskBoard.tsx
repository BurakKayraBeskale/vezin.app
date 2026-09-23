"use client";

import { useCallback, useRef, useState } from "react";
import { useTheme } from "@/components/ThemeProvider";
import TaskDetail from "@/components/TaskDetail";
import TaskForm from "@/components/TaskForm";
import { TaskFull } from "@/components/TaskModal";
import { WorkflowUser } from "@/lib/task-permissions";
import BoardFiltersBar from "./BoardFilters";
import BoardColumn from "./BoardColumn";
import { BoardCompletedRange, BoardData, BoardFilters, BoardStatus } from "./types";

const VIEW_COOKIE = "vezin-board-view";

interface Props {
  initialData: BoardData;
  initialFilters: BoardFilters;
  currentUserId: string;
  userIdentity: WorkflowUser;
  isAdmin: boolean;
  canCreate: boolean;
}

function buildQuery(filters: BoardFilters, extra?: Record<string, string>): string {
  const p = new URLSearchParams();
  p.set("view", filters.view);
  if (filters.q) p.set("q", filters.q);
  if (filters.projectId) p.set("projectId", filters.projectId);
  if (filters.personId) p.set("personId", filters.personId);
  if (filters.priority) p.set("priority", filters.priority);
  if (filters.overdue) p.set("overdue", filters.overdue);
  if (filters.department) p.set("department", filters.department);
  p.set("completedRange", filters.completedRange);
  if (extra) for (const [k, v] of Object.entries(extra)) p.set(k, v);
  return p.toString();
}

/**
 * Görev Takip — Kanban çalışma alanı (GÖREV TAKİP YENİDEN YAPILANDIRMASI).
 *
 * Bu bileşen kendi permission/workflow kuralını ÜRETMEZ; yalnızca mevcut
 * Task Core'un (lib/task-permissions.ts, PATCH /api/tasks/[id], review
 * modalleri, TaskDetail) üzerinde çalışan bir görselleştirme/etkileşim
 * katmanıdır. Sürükle-bırak yoktur — durum geçişleri yalnızca ilgili Task
 * Core workflow aksiyonlarıyla (Çalışmaya Başla / İncelemeye Gönder / Task
 * Detail'deki Onayla-Revizyon İste-Yeniden Aç) yapılır.
 */
export default function TaskBoard({ initialData, initialFilters, currentUserId, userIdentity, isAdmin, canCreate }: Props) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [filters, setFilters] = useState(initialFilters);
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [loadingMoreStatus, setLoadingMoreStatus] = useState<BoardStatus | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");

  // #42: filtre değişince eski istek cevabı yeni state'i ezmesin diye sıra numarası.
  const requestSeq = useRef(0);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  const reload = useCallback(async (nextFilters: BoardFilters) => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch(`/api/tasks/board?${buildQuery(nextFilters)}`);
      if (!res.ok) throw new Error();
      const fresh: BoardData = await res.json();
      if (seq !== requestSeq.current) return; // daha yeni bir istek zaten yolda/geldi
      setData(fresh);
    } catch {
      if (seq === requestSeq.current) setLoadError("Görevler yüklenemedi");
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, []);

  function updateFilters(patch: Partial<BoardFilters>) {
    const next = { ...filters, ...patch };
    setFilters(next);
    if (patch.view) {
      try { document.cookie = `${VIEW_COOKIE}=${patch.view}; path=/; max-age=31536000`; } catch {}
    }
    reload(next);
  }

  function handleCompletedRangeChange(range: BoardCompletedRange) {
    updateFilters({ completedRange: range });
  }

  // #43/#45: görev oluşturma/güncelleme/silme sonrası panoyu arka planda yeniden yükle —
  // hard refresh yok, mevcut filtreler/seçili görünüm/scroll pozisyonu korunur.
  const refreshBoard = useCallback(() => { reload(filters); }, [reload, filters]);

  async function loadMore(status: BoardStatus) {
    setLoadingMoreStatus(status);
    try {
      const offset = data.columns.find((c) => c.status === status)?.items.length ?? 0;
      const res = await fetch(`/api/tasks/board?${buildQuery(filters, { column: status, offset: String(offset) })}`);
      if (!res.ok) throw new Error();
      const page = await res.json();
      setData((prev) => ({
        ...prev,
        columns: prev.columns.map((c) =>
          c.status === status
            ? { ...c, items: [...c.items, ...page.items], total: page.total, hasMore: page.hasMore }
            : c
        ),
      }));
    } catch {
      showToast("Görevler yüklenemedi");
    } finally {
      setLoadingMoreStatus(null);
    }
  }

  function handleCreated() {
    setShowCreate(false);
    showToast("Görev oluşturuldu");
    refreshBoard();
  }

  function handleDetailUpdate(_updated: TaskFull) {
    refreshBoard();
  }

  function handleDetailDelete(_taskId: string) {
    setSelectedTaskId(null);
    showToast("Görev silindi");
    refreshBoard();
  }

  return (
    <>
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-gray-900 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-xl">
          <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          {toast}
        </div>
      )}

      {/* #6: sade header — sol başlık, sağ Yeni Görev */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Görev Takip</h1>
          <p className="text-sm text-gray-400 mt-1">Görevlere tıklayarak detay ve işlemleri görüntüleyin</p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 text-sm bg-[#F57C28] hover:bg-[#D96A1A] text-white font-semibold px-3.5 py-2.5 rounded-xl transition-colors shadow-md shadow-[#F57C28]/25 w-fit"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Yeni Görev
          </button>
        )}
      </div>

      <BoardFiltersBar filters={filters} onChange={updateFilters} meta={data.meta} isAdmin={isAdmin} />

      {loadError && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-2.5">
          {loadError}
        </div>
      )}

      <div className={loading ? "opacity-60 pointer-events-none transition-opacity" : "transition-opacity"}>
        <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 -mx-4 sm:mx-0 px-4 sm:px-0">
          {data.columns.map((column) => (
            <BoardColumn
              key={column.status}
              column={column}
              currentUserId={currentUserId}
              userIdentity={userIdentity}
              onOpen={setSelectedTaskId}
              onActionDone={refreshBoard}
              onLoadMore={loadMore}
              loadingMore={loadingMoreStatus === column.status}
              isDark={isDark}
              completedRange={column.status === "DONE" ? filters.completedRange : undefined}
              onCompletedRangeChange={column.status === "DONE" ? handleCompletedRangeChange : undefined}
            />
          ))}
        </div>
      </div>

      {selectedTaskId && (
        <TaskDetail
          taskId={selectedTaskId}
          isAdmin={isAdmin}
          onClose={() => setSelectedTaskId(null)}
          onUpdate={handleDetailUpdate}
          onDelete={handleDetailDelete}
        />
      )}

      {showCreate && (
        <TaskForm mode="create" onClose={() => setShowCreate(false)} onCreate={handleCreated} />
      )}
    </>
  );
}
