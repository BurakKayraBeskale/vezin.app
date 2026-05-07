"use client";

import { useState, useRef } from "react";
import { useTheme } from "@/components/ThemeProvider";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import clsx from "clsx";
import PriorityBadge from "./PriorityBadge";
import TaskModal, { TaskFull } from "./TaskModal";

type Status = "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";

const COLUMNS: { id: Status; label: string; color: string; bg: string; darkBg: string; ring: string }[] = [
  { id: "TODO",        label: "Yapılacak",    color: "#6B7280", bg: "#F3F4F6", darkBg: "rgba(107,114,128,0.1)", ring: "ring-gray-300" },
  { id: "IN_PROGRESS", label: "Devam Ediyor", color: "#F57C28", bg: "#FFF3E9", darkBg: "rgba(245,124,40,0.1)",  ring: "ring-[#F57C28]/40" },
  { id: "REVIEW",      label: "İncelemede",   color: "#6366F1", bg: "#EEF2FF", darkBg: "rgba(99,102,241,0.1)",  ring: "ring-indigo-300" },
  { id: "DONE",        label: "Tamamlandı",   color: "#10B981", bg: "#ECFDF5", darkBg: "rgba(16,185,129,0.1)",  ring: "ring-emerald-300" },
];

interface User { id: string; name: string; email?: string; }

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function fmtDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

function isOverdue(d: string | null, status: Status) {
  if (!d || status === "DONE") return false;
  return new Date(d) < new Date();
}

// ─── Card content (shared between draggable card and drag overlay) ───────────
function CardContent({ task }: { task: TaskFull }) {
  const overdue = isOverdue(task.dueDate, task.status as Status);
  return (
    <>
      <p className="text-sm font-semibold text-gray-800 leading-snug mb-2">{task.title}</p>
      {task.description && (
        <p className="text-xs text-gray-400 mb-2 line-clamp-2">{task.description}</p>
      )}
      <div className="flex items-center justify-between">
        <PriorityBadge priority={task.priority as "HIGH" | "MEDIUM" | "LOW"} />
        <div className="flex items-center gap-2">
          {task.dueDate && (
            <span className={clsx("text-[10px] font-medium", overdue ? "text-red-500" : "text-gray-400")}>
              {overdue && "⚠ "}{fmtDate(task.dueDate)}
            </span>
          )}
          {task.files.length > 0 && (
            <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              {task.files.length}
            </span>
          )}
          {task.assignedTo && (
            <div
              className="w-6 h-6 rounded-full bg-[#F57C28] flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
              title={task.assignedTo.name}
            >
              {initials(task.assignedTo.name)}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Draggable card ───────────────────────────────────────────────────────────
function DraggableCard({
  task,
  onCardClick,
  anyDragging,
}: {
  task: TaskFull;
  onCardClick: (task: TaskFull) => void;
  anyDragging: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => onCardClick(task)}
      className={clsx(
        "bg-white rounded-xl border p-3.5 transition-all select-none touch-none",
        isDragging
          ? "opacity-30 border-gray-200 shadow-none"
          : "border-gray-200 cursor-grab active:cursor-grabbing hover:shadow-md hover:border-gray-300",
        anyDragging && !isDragging ? "cursor-default" : ""
      )}
    >
      <CardContent task={task} />
    </div>
  );
}

// ─── Droppable column ─────────────────────────────────────────────────────────
function DroppableColumn({
  col,
  tasks,
  onCardClick,
  anyDragging,
  isDark,
}: {
  col: typeof COLUMNS[number];
  tasks: TaskFull[];
  onCardClick: (task: TaskFull) => void;
  anyDragging: boolean;
  isDark: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });

  return (
    <div className="flex flex-col w-64 flex-shrink-0">
      {/* Column header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: col.color }} />
          <h3 className="text-sm font-bold text-gray-700">{col.label}</h3>
        </div>
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ backgroundColor: col.bg, color: col.color }}
        >
          {tasks.length}
        </span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={clsx(
          "flex-1 rounded-2xl p-2 space-y-2.5 min-h-[420px] transition-all duration-150",
          isOver
            ? `ring-2 ${col.ring} bg-white/60`
            : "",
        )}
        style={{ backgroundColor: isOver ? undefined : (isDark ? col.darkBg : col.bg + "60") }}
      >
        {tasks.map((task) => (
          <DraggableCard
            key={task.id}
            task={task}
            onCardClick={onCardClick}
            anyDragging={anyDragging}
          />
        ))}
        {tasks.length === 0 && (
          <div
            className={clsx(
              "flex flex-col items-center justify-center h-24 rounded-xl border-2 border-dashed transition-colors text-xs",
              isOver ? "border-current text-gray-400" : "border-gray-200 text-gray-300"
            )}
            style={{ borderColor: isOver ? col.color : undefined, color: isOver ? col.color : undefined }}
          >
            {isOver ? "Buraya bırak" : "Görev yok"}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Board ────────────────────────────────────────────────────────────────────
interface Props {
  initialTasks: TaskFull[];
  users: User[];
  isAdmin: boolean;
}

export default function KanbanBoard({ initialTasks, users, isAdmin }: Props) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [tasks, setTasks] = useState<TaskFull[]>(initialTasks);
  const [search, setSearch] = useState("");
  const [selectedTask, setSelectedTask] = useState<TaskFull | null>(null);
  const [activeTask, setActiveTask] = useState<TaskFull | null>(null);

  // Track whether a drag actually fired to prevent the subsequent click event
  // from opening the modal after a drop.
  const wasDragged = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const visibleTasks = search.trim()
    ? tasks.filter((t) => {
        const q = search.toLowerCase();
        return (
          t.title.toLowerCase().includes(q) ||
          (t.assignedTo?.name ?? "").toLowerCase().includes(q)
        );
      })
    : tasks;

  const columns = COLUMNS.reduce<Record<Status, TaskFull[]>>(
    (acc, col) => {
      acc[col.id] = visibleTasks.filter((t) => t.status === col.id);
      return acc;
    },
    { TODO: [], IN_PROGRESS: [], REVIEW: [], DONE: [] }
  );

  function handleDragStart({ active }: DragStartEvent) {
    wasDragged.current = true;
    const task = tasks.find((t) => t.id === active.id) ?? null;
    setActiveTask(task);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveTask(null);

    // Defer the flag reset so the click event (which fires synchronously
    // after pointerup, before this setTimeout callback) gets suppressed.
    setTimeout(() => { wasDragged.current = false; }, 0);

    if (!over) return;
    const destStatus = over.id as Status;
    const task = tasks.find((t) => t.id === active.id);
    if (!task || task.status === destStatus) return;

    // Optimistic UI update
    const updated = { ...task, status: destStatus };
    setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));

    // Sync to server — use response to update logs
    fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: destStatus }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((serverTask: TaskFull) => {
        setTasks((prev) => prev.map((t) => (t.id === task.id ? serverTask : t)));
      })
      .catch(() => {
        // Rollback on error
        setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
      });
  }

  function handleCardClick(task: TaskFull) {
    if (wasDragged.current) return;
    setSelectedTask(task);
  }

  function handleModalUpdate(updated: TaskFull) {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    setSelectedTask(updated);
  }

  return (
    <>
      {/* Search bar */}
      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs w-full">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Görev başlığı veya kişi ara..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28] transition-all"
          />
        </div>
        {search && (
          <>
            <span className="text-xs text-gray-400">{visibleTasks.length} görev</span>
            <button
              onClick={() => setSearch("")}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              Temizle
            </button>
          </>
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 -mx-4 sm:mx-0 px-4 sm:px-0">
          {COLUMNS.map((col) => (
            <DroppableColumn
              key={col.id}
              col={col}
              tasks={columns[col.id]}
              onCardClick={handleCardClick}
              anyDragging={!!activeTask}
              isDark={isDark}
            />
          ))}
        </div>

        {/* Ghost card shown while dragging */}
        <DragOverlay dropAnimation={{ duration: 180, easing: "ease" }}>
          {activeTask && (
            <div className="bg-white rounded-xl border border-[#F57C28]/60 p-3.5 shadow-2xl w-64 rotate-1 opacity-95 cursor-grabbing">
              <CardContent task={activeTask} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {selectedTask && (
        <TaskModal
          task={selectedTask}
          users={users}
          isAdmin={isAdmin}
          onClose={() => setSelectedTask(null)}
          onUpdate={handleModalUpdate}
        />
      )}
    </>
  );
}
