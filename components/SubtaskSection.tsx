"use client";

import { useState } from "react";
import TaskForm from "./TaskForm";
import StatusBadge from "./StatusBadge";
import { TaskFull } from "./TaskModal";

interface Props {
  task: TaskFull;
  canCreateSubtask: boolean;
  onNavigate: (taskId: string) => void;
  onChildAdded: (child: { id: string; title: string; status: string }) => void;
}

export default function SubtaskSection({ task, canCreateSubtask, onNavigate, onChildAdded }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const children = task.children ?? [];
  const parent = task.parent;

  return (
    <section className="px-6 py-4 border-b border-gray-50">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
          Alt Görevler {children.length > 0 && `(${children.length})`}
        </h3>
        {canCreateSubtask && (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="text-xs font-semibold text-[#F57C28] hover:text-[#D96A1A] transition-colors"
          >
            + Alt Görev Ekle
          </button>
        )}
      </div>

      {parent && (
        <button
          type="button"
          onClick={() => {
            if (!("restricted" in parent)) onNavigate(parent.id);
          }}
          disabled={"restricted" in parent}
          className="mb-2.5 flex items-center gap-1 text-xs text-gray-500 hover:text-[#F57C28] disabled:hover:text-gray-400 disabled:cursor-default transition-colors"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Üst görev:{" "}
          {"restricted" in parent ? (
            <span className="italic text-gray-400">erişim kısıtlı</span>
          ) : (
            <span className="font-medium text-gray-700">{parent.title}</span>
          )}
        </button>
      )}

      {children.length > 0 ? (
        <ul className="space-y-1">
          {children.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onNavigate(c.id)}
                className="w-full flex items-center gap-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg px-2 py-1.5 -mx-2 transition-colors text-left"
              >
                <StatusBadge status={c.status as any} />
                <span className="flex-1 truncate">{c.title}</span>
                <svg className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        !parent && <p className="text-sm text-gray-400 italic">Alt görev yok</p>
      )}

      {showAdd && (
        <TaskForm
          mode="create"
          parentTaskId={task.id}
          parentTaskTitle={task.title}
          fixedProjectId={task.project?.id}
          fixedProjectName={task.project?.name}
          fixedDepartmentId={task.project ? undefined : task.departmentId ?? undefined}
          onClose={() => setShowAdd(false)}
          onCreate={(created) => {
            onChildAdded({ id: created.id, title: created.title, status: created.status });
            setShowAdd(false);
          }}
        />
      )}
    </section>
  );
}
