"use client";

import { useState } from "react";
import Link from "next/link";

type Member = {
  user: { id: string; name: string; title?: string | null };
};

type Task = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  assignedTo: { id: string; name: string } | null;
  createdAt: string;
};

const STATUS_LABELS: Record<string, string> = {
  TODO: "Yapılacak",
  IN_PROGRESS: "Devam Ediyor",
  REVIEW: "İncelemede",
  DONE: "Tamamlandı",
};

export default function ProjeDetayClient({
  tasks: initialTasks,
  members,
  canEdit,
}: {
  tasks: Task[];
  members: Member[];
  canEdit: boolean;
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [completing, setCompleting] = useState<string | null>(null);

  const now = new Date();
  const visibleTasks = selectedMemberId
    ? tasks.filter((t) => t.assignedTo?.id === selectedMemberId)
    : tasks;

  const statusGroups = {
    IN_PROGRESS: visibleTasks.filter((t) => t.status === "IN_PROGRESS"),
    REVIEW: visibleTasks.filter((t) => t.status === "REVIEW"),
    TODO: visibleTasks.filter((t) => t.status === "TODO"),
    DONE: visibleTasks.filter((t) => t.status === "DONE"),
  };

  async function markDone(taskId: string) {
    setCompleting(taskId);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DONE" }),
      });
      if (res.ok) {
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: "DONE" } : t))
        );
      }
    } finally {
      setCompleting(null);
    }
  }

  return (
    <>
      {/* Members */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Proje Üyeleri
          </p>
          {selectedMemberId && (
            <button
              onClick={() => setSelectedMemberId(null)}
              className="text-xs text-[#F57C28] hover:underline"
            >
              Tümünü Göster
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {members.map((m) => {
            const isSelected = selectedMemberId === m.user.id;
            if (canEdit) {
              return (
                <button
                  key={m.user.id}
                  onClick={() =>
                    setSelectedMemberId(isSelected ? null : m.user.id)
                  }
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-colors ${
                    isSelected
                      ? "bg-[#F57C28] text-white"
                      : "bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold flex-shrink-0 ${
                      isSelected
                        ? "bg-white text-[#F57C28]"
                        : "bg-[#F57C28] text-white"
                    }`}
                  >
                    {m.user.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="text-left">
                    <p
                      className={`text-xs font-medium leading-none ${
                        isSelected
                          ? "text-white"
                          : "text-gray-900 dark:text-white"
                      }`}
                    >
                      {m.user.name}
                    </p>
                    {m.user.title && (
                      <p
                        className={`text-[9px] mt-0.5 ${
                          isSelected ? "text-orange-100" : "text-gray-400"
                        }`}
                      >
                        {m.user.title}
                      </p>
                    )}
                  </div>
                </button>
              );
            }
            return (
              <div
                key={m.user.id}
                className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-700 rounded-lg px-2.5 py-1.5"
              >
                <div className="w-5 h-5 rounded-full bg-[#F57C28] flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0">
                  {m.user.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-900 dark:text-white leading-none">
                    {m.user.name}
                  </p>
                  {m.user.title && (
                    <p className="text-[9px] text-gray-400 mt-0.5">{m.user.title}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tasks */}
      <div className="space-y-4">
        {(["IN_PROGRESS", "REVIEW", "TODO", "DONE"] as const).map((status) => {
          const group = statusGroups[status];
          if (group.length === 0) return null;
          return (
            <div
              key={status}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700"
            >
              <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {STATUS_LABELS[status]}
                </h2>
                <span className="text-xs font-medium text-gray-400">
                  {group.length}
                </span>
              </div>
              <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {group.map((task) => {
                  const isOverdue =
                    task.dueDate &&
                    new Date(task.dueDate) < now &&
                    task.status !== "DONE";
                  return (
                    <div
                      key={task.id}
                      className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                    >
                      <Link
                        href={`/backlog?task=${task.id}`}
                        className="flex-1 min-w-0"
                      >
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {task.title}
                        </p>
                        {task.assignedTo && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {task.assignedTo.name}
                          </p>
                        )}
                      </Link>
                      <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                        {task.dueDate && (
                          <span
                            className={`text-xs ${
                              isOverdue
                                ? "text-red-500 font-semibold"
                                : "text-gray-400"
                            }`}
                          >
                            {new Date(task.dueDate).toLocaleDateString("tr-TR", {
                              day: "numeric",
                              month: "short",
                            })}
                          </span>
                        )}
                        {canEdit && task.status !== "DONE" && (
                          <button
                            onClick={() => markDone(task.id)}
                            disabled={completing === task.id}
                            title="Tamamlandı olarak işaretle"
                            className="p-1 rounded-md text-gray-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors disabled:opacity-40"
                          >
                            {completing === task.id ? (
                              <svg
                                className="w-4 h-4 animate-spin"
                                fill="none"
                                viewBox="0 0 24 24"
                              >
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                />
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8v8H4z"
                                />
                              </svg>
                            ) : (
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                strokeWidth={2}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {visibleTasks.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p>
            {selectedMemberId
              ? "Bu üyeye atanmış görev yok"
              : "Bu projede henüz görev yok"}
          </p>
        </div>
      )}
    </>
  );
}
