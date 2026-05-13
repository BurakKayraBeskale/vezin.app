"use client";

import { useState, useMemo, useCallback, createContext, useContext } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

const DEPT_LABELS: Record<string, string> = {
  OUTSOURCE:            "Outsource",
  BAGIMSIZ_DENETIM:     "Bağımsız Denetim",
  MUHASEBE:             "Muhasebe",
  YEMINLI_MALI_MUSAVIR: "YMM",
  ADMIN:                "Yönetim",
};

const DEPT_COLORS: Record<string, string> = {
  OUTSOURCE:            "#6B7280",
  BAGIMSIZ_DENETIM:     "#6366F1",
  MUHASEBE:             "#10B981",
  YEMINLI_MALI_MUSAVIR: "#F57C28",
  ADMIN:                "#EF4444",
};

export interface OrgUser {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "MANAGER" | "EMPLOYEE";
  department: string;
  createdAt: string;
  taskCount?: number;
  subordinateIds: string[];
  relations: Array<{ userId: string; relationType: string }>;
}

interface TreeNode {
  user: OrgUser;
  children: TreeNode[];
}

function buildTree(users: OrgUser[]): TreeNode[] {
  const userMap = new Map(users.map((u) => [u.id, u]));
  const allSubordinateIds = new Set(users.flatMap((u) => u.subordinateIds));
  const roots = users.filter((u) => !allSubordinateIds.has(u.id));

  function buildNode(user: OrgUser, visited = new Set<string>()): TreeNode {
    if (visited.has(user.id)) return { user, children: [] };
    visited.add(user.id);
    const children = user.subordinateIds
      .map((id) => userMap.get(id))
      .filter((u): u is OrgUser => !!u)
      .map((u) => buildNode(u, new Set(visited)));
    return { user, children };
  }

  return roots.map((u) => buildNode(u));
}

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

// ── DnD context (avoids prop-drilling through recursive tree) ─────────────
interface DragState {
  activeId: string | null;
  overInfo: { id: string; relationType: "SUBORDINATE" | "PEER" } | null;
}
const DragCtx = createContext<DragState>({ activeId: null, overInfo: null });

// Detect whether dragged card center is below target center → SUBORDINATE, else PEER
function detectRelation(
  translatedRect: { top: number; height: number } | null | undefined,
  overRect: { top: number; height: number } | null | undefined,
): "SUBORDINATE" | "PEER" {
  if (!translatedRect || !overRect) return "PEER";
  const activeCenter = translatedRect.top + translatedRect.height / 2;
  const overMidY = overRect.top + overRect.height / 2;
  return activeCenter > overMidY + 18 ? "SUBORDINATE" : "PEER";
}

// ── Single draggable + droppable card ─────────────────────────────────────
function OrgCard({ user }: { user: OrgUser }) {
  const { activeId, overInfo } = useContext(DragCtx);

  const { attributes, listeners, setNodeRef: setDragRef, transform } = useDraggable({ id: user.id });
  const { setNodeRef: setDropRef } = useDroppable({ id: user.id });

  const ref = useCallback(
    (el: HTMLDivElement | null) => {
      setDragRef(el);
      setDropRef(el);
    },
    [setDragRef, setDropRef],
  );

  const isDragging = activeId === user.id;
  const isTarget = !!overInfo && overInfo.id === user.id && activeId !== user.id;
  const relationType = overInfo?.relationType;
  const deptColor = DEPT_COLORS[user.department] ?? "#6B7280";

  return (
    <div
      ref={ref}
      {...listeners}
      {...attributes}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.25 : 1,
        borderColor: isTarget ? "#22c55e" : deptColor + "40",
        boxShadow: isTarget
          ? "0 0 0 2px #22c55e, 0 4px 16px -4px rgba(34,197,94,0.35)"
          : undefined,
        transition: isDragging ? undefined : "box-shadow 0.12s, border-color 0.12s, transform 0.12s",
        cursor: isDragging ? "grabbing" : "grab",
        position: "relative",
      }}
      className="bg-white border-2 rounded-2xl shadow-sm p-3 flex flex-col items-center gap-1.5 w-36 sm:w-40 select-none"
    >
      {/* Hover tint */}
      {isTarget && (
        <div className="absolute inset-0 rounded-2xl bg-green-500/5 pointer-events-none" />
      )}

      {/* Avatar */}
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
        style={{ backgroundColor: deptColor }}
      >
        {initials(user.name)}
      </div>

      <p className="text-xs font-bold text-gray-800 text-center leading-snug line-clamp-2">
        {user.name}
      </p>

      <span
        className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
        style={{ backgroundColor: deptColor + "20", color: deptColor }}
      >
        {DEPT_LABELS[user.department] ?? user.department}
      </span>

      {user.role === "ADMIN" && (
        <span className="text-[9px] font-bold bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded-full">
          Admin
        </span>
      )}

      {user.taskCount != null && user.taskCount > 0 && (
        <span className="text-[9px] text-gray-400">{user.taskCount} görev</span>
      )}

      {/* Drop relation badge */}
      {isTarget && (
        <span className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 text-[9px] font-bold bg-green-500 text-white px-2 py-0.5 rounded-full whitespace-nowrap z-10 pointer-events-none">
          {relationType === "SUBORDINATE" ? "↓ Alt" : "↔ Denk"}
        </span>
      )}
    </div>
  );
}

// ── Ghost card shown during drag ───────────────────────────────────────────
function OverlayCard({ user }: { user: OrgUser }) {
  const color = DEPT_COLORS[user.department] ?? "#6B7280";
  return (
    <div className="bg-white border-2 border-[#F57C28] rounded-2xl p-3 flex flex-col items-center gap-1.5 w-36 sm:w-40 shadow-2xl shadow-orange-400/30 rotate-2 opacity-90">
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold"
        style={{ backgroundColor: color }}
      >
        {initials(user.name)}
      </div>
      <p className="text-xs font-bold text-gray-800 text-center">{user.name}</p>
    </div>
  );
}

// ── Recursive tree node ────────────────────────────────────────────────────
function UserCard({ node, depth }: { node: TreeNode; depth: number }) {
  return (
    <div className="flex flex-col items-center">
      <OrgCard user={node.user} />

      {node.children.length > 0 && (
        <div className="flex flex-col items-center">
          <div className="w-px h-5 bg-gray-200" />
          {node.children.length > 1 && (
            <div
              className="h-px bg-gray-200"
              style={{ width: `${node.children.length * 160 - 16}px` }}
            />
          )}
          <div className="flex items-start gap-4">
            {node.children.map((child) => (
              <div key={child.user.id} className="flex flex-col items-center">
                <div className="w-px h-5 bg-gray-200" />
                <UserCard node={child} depth={depth + 1} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function OrgChart({ users: initialUsers }: { users: OrgUser[] }) {
  const [users, setUsers] = useState<OrgUser[]>(initialUsers);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overInfo, setOverInfo] = useState<{ id: string; relationType: "SUBORDINATE" | "PEER" } | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const tree = useMemo(() => buildTree(users), [users]);
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const activeUser = activeId ? userMap.get(activeId) : null;

  const inTree = useMemo(() => {
    const ids = new Set<string>();
    function collect(n: TreeNode) { ids.add(n.user.id); n.children.forEach(collect); }
    tree.forEach(collect);
    return ids;
  }, [tree]);

  const standalone = useMemo(
    () => users.filter((u) => !inTree.has(u.id)),
    [users, inTree],
  );

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3200);
  }

  function handleDragStart(e: DragStartEvent) {
    setActiveId(e.active.id as string);
  }

  function handleDragOver(e: DragOverEvent) {
    if (!e.over || e.active.id === e.over.id) { setOverInfo(null); return; }
    const rel = detectRelation(e.active.rect.current.translated, e.over.rect);
    setOverInfo({ id: e.over.id as string, relationType: rel });
  }

  async function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    setOverInfo(null);

    if (!e.over || e.active.id === e.over.id) return;

    const draggedId = e.active.id as string;
    const targetId  = e.over.id  as string;
    const relationType = detectRelation(e.active.rect.current.translated, e.over.rect);

    // Optimistic update (tree structure only changes for SUBORDINATE)
    const prevUsers = users;
    if (relationType === "SUBORDINATE") {
      setUsers((prev) =>
        prev.map((u) => {
          if (u.id === targetId)
            return { ...u, subordinateIds: [...new Set([...u.subordinateIds, draggedId])] };
          if (u.subordinateIds.includes(draggedId))
            return { ...u, subordinateIds: u.subordinateIds.filter((id) => id !== draggedId) };
          return u;
        }),
      );
    }

    const res = await fetch(`/api/users/${targetId}/relations`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subordinateId: draggedId, relationType }),
    });

    if (!res.ok) {
      if (relationType === "SUBORDINATE") setUsers(prevUsers);
      showToast("Bağlantı kaydedilemedi", false);
    } else {
      const draggedName = userMap.get(draggedId)?.name ?? "—";
      const targetName  = userMap.get(targetId)?.name  ?? "—";
      const label = relationType === "SUBORDINATE" ? "altı" : "dengi";
      showToast(`${draggedName} → ${targetName} (${label}) kaydedildi`, true);
    }
  }

  const ctxValue = useMemo(() => ({ activeId, overInfo }), [activeId, overInfo]);

  if (users.length === 0) {
    return <div className="py-16 text-center text-gray-400 text-sm">Kullanıcı bulunamadı</div>;
  }

  return (
    <div className="relative">
      {/* Hint */}
      <div className="mb-4 px-3 py-2.5 bg-blue-50 border border-blue-100 rounded-xl flex items-center gap-2">
        <svg className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-xs text-blue-600">
          Bir kartı sürükle: <strong>hedefin altına</strong> bırak → Alt (Ast) &nbsp;·&nbsp;
          <strong>yanına</strong> bırak → Denk
        </p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 justify-end mb-5">
        {Object.entries(DEPT_LABELS).map(([key, label]) => (
          <span key={key} className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: DEPT_COLORS[key] }} />
            {label}
          </span>
        ))}
      </div>

      <DragCtx.Provider value={ctxValue}>
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          {/* Hierarchy tree */}
          <div className="overflow-x-auto pb-8">
            {tree.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">
                Henüz hiyerarşi tanımlanmamış. Kartları sürükleyerek bağlantı kurun.
              </p>
            ) : (
              <div className="flex flex-wrap gap-12 justify-center min-w-max mx-auto px-4">
                {tree.map((root) => (
                  <UserCard key={root.user.id} node={root} depth={0} />
                ))}
              </div>
            )}
          </div>

          {/* Standalone (unassigned) users */}
          {standalone.length > 0 && (
            <div className="mt-6">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 px-1">
                Hiyerarşi Dışı Kullanıcılar
              </p>
              <div className="flex flex-wrap gap-4">
                {standalone.map((u) => (
                  <OrgCard key={u.id} user={u} />
                ))}
              </div>
            </div>
          )}

          <DragOverlay dropAnimation={null}>
            {activeUser ? <OverlayCard user={activeUser} /> : null}
          </DragOverlay>
        </DndContext>
      </DragCtx.Provider>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 text-white text-sm px-5 py-3 rounded-xl shadow-xl z-50 whitespace-nowrap transition-opacity ${
            toast.ok ? "bg-gray-900" : "bg-red-600"
          }`}
        >
          {toast.ok ? "✓" : "✕"} {toast.msg}
        </div>
      )}
    </div>
  );
}
