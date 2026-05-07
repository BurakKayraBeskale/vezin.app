"use client";

import { useState, useMemo } from "react";
import clsx from "clsx";
import PriorityBadge from "./PriorityBadge";
import StatusBadge from "./StatusBadge";
import TaskModal, { TaskFull } from "./TaskModal";
import TaskFormModal from "./TaskFormModal";

type Priority = "HIGH" | "MEDIUM" | "LOW";
type Status = "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";
type SortCol = "title" | "priority" | "status" | "assignedTo" | "dueDate" | "files";
type SortDir = "asc" | "desc";

const PRIORITY_ORDER: Record<Priority, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
const STATUS_ORDER: Record<Status, number> = { TODO: 0, IN_PROGRESS: 1, REVIEW: 2, DONE: 3 };

interface User { id: string; name: string; email?: string; }

interface Props {
  initialTasks: TaskFull[];
  users: User[];
  isAdmin: boolean;
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
}

function isOverdue(d: string | null, status: Status) {
  if (!d || status === "DONE") return false;
  return new Date(d) < new Date();
}

function SortIcon({ col, sortCol, sortDir }: { col: SortCol; sortCol: SortCol; sortDir: SortDir }) {
  if (col !== sortCol) {
    return (
      <svg className="w-3 h-3 text-gray-300 ml-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    );
  }
  return sortDir === "asc" ? (
    <svg className="w-3 h-3 text-[#F57C28] ml-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
    </svg>
  ) : (
    <svg className="w-3 h-3 text-[#F57C28] ml-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

export default function BacklogTable({ initialTasks, users, isAdmin }: Props) {
  const [tasks, setTasks] = useState<TaskFull[]>(initialTasks);
  const [search, setSearch] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterAssignee, setFilterAssignee] = useState("");
  const [sortCol, setSortCol] = useState<SortCol>("priority");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [viewTask, setViewTask] = useState<TaskFull | null>(null);
  const [editTask, setEditTask] = useState<TaskFull | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  function handleSort(col: SortCol) {
    if (col === sortCol) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  }

  const filtered = useMemo(() => {
    const result = tasks.filter((t) => {
      const q = search.toLowerCase();
      const matchQ = !q || t.title.toLowerCase().includes(q) || (t.description ?? "").toLowerCase().includes(q) || (t.assignedTo?.name ?? "").toLowerCase().includes(q);
      const matchP = !filterPriority || t.priority === filterPriority;
      const matchS = !filterStatus || t.status === filterStatus;
      const matchA = !filterAssignee || (filterAssignee === "__none__" ? !t.assignedToId : t.assignedToId === filterAssignee);
      return matchQ && matchP && matchS && matchA;
    });

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case "title":
          cmp = a.title.localeCompare(b.title, "tr");
          break;
        case "priority":
          cmp = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
          break;
        case "status":
          cmp = STATUS_ORDER[a.status as Status] - STATUS_ORDER[b.status as Status];
          break;
        case "assignedTo":
          cmp = (a.assignedTo?.name ?? "").localeCompare(b.assignedTo?.name ?? "", "tr");
          break;
        case "dueDate":
          if (!a.dueDate && !b.dueDate) cmp = 0;
          else if (!a.dueDate) cmp = 1;
          else if (!b.dueDate) cmp = -1;
          else cmp = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
          break;
        case "files":
          cmp = a.files.length - b.files.length;
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [tasks, search, filterPriority, filterStatus, filterAssignee, sortCol, sortDir]);

  function handleUpdate(updated: TaskFull) {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    if (viewTask?.id === updated.id) setViewTask(updated);
  }

  function handleCreate(created: TaskFull) {
    setTasks((prev) => [created, ...prev]);
  }

  async function handleDelete(id: string) {
    if (!confirm("Bu görevi silmek istediğinizden emin misiniz?")) return;
    setDeleting(id);
    try {
      await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } finally {
      setDeleting(null);
    }
  }

  const thClass = "px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap select-none";
  const thSortable = `${thClass} cursor-pointer hover:text-[#F57C28] transition-colors`;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-2 sm:gap-3">
        {/* Row 1: search + action button */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Ara: başlık, açıklama, kişi..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28]"
            />
          </div>
          <span className="text-sm text-gray-400 whitespace-nowrap hidden sm:block">{filtered.length} görev</span>
          {isAdmin && (
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 bg-[#F57C28] hover:bg-[#D96A1A] text-white text-sm font-semibold px-3 sm:px-4 py-2.5 rounded-xl shadow-md shadow-[#F57C28]/25 transition-colors flex-shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">Yeni Görev</span>
            </button>
          )}
        </div>

        {/* Row 2: filters */}
        <div className="flex flex-wrap items-center gap-2">
          <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}
            className="flex-1 min-w-[110px] px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28]">
            <option value="">Tüm Öncelikler</option>
            <option value="HIGH">Yüksek</option>
            <option value="MEDIUM">Orta</option>
            <option value="LOW">Düşük</option>
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
            className="flex-1 min-w-[120px] px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28]">
            <option value="">Tüm Durumlar</option>
            <option value="TODO">Yapılacak</option>
            <option value="IN_PROGRESS">Devam Ediyor</option>
            <option value="REVIEW">İncelemede</option>
            <option value="DONE">Tamamlandı</option>
          </select>
          <select value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)}
            className="flex-1 min-w-[120px] px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28]">
            <option value="">Tüm Kişiler</option>
            <option value="__none__">Atanmamış</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          <span className="text-sm text-gray-400 sm:hidden">{filtered.length} görev</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className={thSortable} onClick={() => handleSort("title")}>
                  Başlık <SortIcon col="title" sortCol={sortCol} sortDir={sortDir} />
                </th>
                <th className={thSortable} onClick={() => handleSort("priority")}>
                  Öncelik <SortIcon col="priority" sortCol={sortCol} sortDir={sortDir} />
                </th>
                <th className={thSortable} onClick={() => handleSort("status")}>
                  Durum <SortIcon col="status" sortCol={sortCol} sortDir={sortDir} />
                </th>
                <th className={thSortable} onClick={() => handleSort("assignedTo")}>
                  Atanan <SortIcon col="assignedTo" sortCol={sortCol} sortDir={sortDir} />
                </th>
                <th className={thSortable} onClick={() => handleSort("dueDate")}>
                  Son Tarih <SortIcon col="dueDate" sortCol={sortCol} sortDir={sortDir} />
                </th>
                <th className={thSortable} onClick={() => handleSort("files")}>
                  Dosya <SortIcon col="files" sortCol={sortCol} sortDir={sortDir} />
                </th>
                {isAdmin && <th className={thClass}>İşlemler</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((task) => {
                const overdue = isOverdue(task.dueDate, task.status);
                return (
                  <tr key={task.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3.5 max-w-xs">
                      <button onClick={() => setViewTask(task)} className="text-left">
                        <p className="text-sm font-medium text-gray-800 hover:text-[#F57C28] transition-colors line-clamp-1">
                          {task.title}
                        </p>
                        {task.description && (
                          <p className="text-[11px] text-gray-400 line-clamp-1">{task.description}</p>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3.5"><PriorityBadge priority={task.priority} /></td>
                    <td className="px-4 py-3.5"><StatusBadge status={task.status} /></td>
                    <td className="px-4 py-3.5">
                      {task.assignedTo ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[#F57C28] flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">
                            {task.assignedTo.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                          </div>
                          <span className="text-sm text-gray-600 whitespace-nowrap">{task.assignedTo.name}</span>
                        </div>
                      ) : <span className="text-sm text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={clsx("text-sm font-medium whitespace-nowrap", overdue ? "text-red-500" : "text-gray-600")}>
                        {overdue && "⚠ "}{fmtDate(task.dueDate)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-xs text-gray-400">{task.files.length}</span>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setEditTask(task)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-[#F57C28] hover:bg-orange-50 transition-colors"
                            title="Düzenle">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button onClick={() => handleDelete(task.id)} disabled={deleting === task.id}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                            title="Sil">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-16 text-center text-gray-400 text-sm">Sonuç bulunamadı</div>
          )}
        </div>
      </div>

      {/* Modals */}
      {viewTask && (
        <TaskModal task={viewTask} users={users} isAdmin={isAdmin}
          onClose={() => setViewTask(null)} onUpdate={handleUpdate} />
      )}
      {editTask && (
        <TaskFormModal task={editTask} users={users}
          onClose={() => setEditTask(null)} onUpdate={handleUpdate} />
      )}
      {showCreate && (
        <TaskFormModal users={users}
          onClose={() => setShowCreate(false)} onCreate={handleCreate} />
      )}
    </div>
  );
}
