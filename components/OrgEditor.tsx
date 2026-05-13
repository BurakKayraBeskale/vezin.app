"use client";

import { useState, useCallback } from "react";
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
import { useRouter } from "next/navigation";
import type { OrgUser } from "./OrgChart";

const DEPT_COLORS: Record<string, string> = {
  OUTSOURCE:            "#6B7280",
  BAGIMSIZ_DENETIM:     "#6366F1",
  MUHASEBE:             "#10B981",
  YEMINLI_MALI_MUSAVIR: "#F57C28",
  ADMIN:                "#EF4444",
};

const DEPT_LABELS: Record<string, string> = {
  OUTSOURCE:            "Outsource",
  BAGIMSIZ_DENETIM:     "Bağımsız Denetim",
  MUHASEBE:             "Muhasebe",
  YEMINLI_MALI_MUSAVIR: "YMM",
  ADMIN:                "Yönetim",
};

const RELATION_OPTIONS = [
  { value: "SUBORDINATE", label: "Altı (Ast)" },
  { value: "PEER",        label: "Dengi (Eş seviye)" },
  { value: "SUPERIOR",    label: "Üstü (Üst)" },
];

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

// ── Tek kullanıcı kartı: hem draggable hem droppable ──────────────────────────
function DndCard({
  user,
  isOver,
  isDragging,
}: {
  user: OrgUser;
  isOver: boolean;
  isDragging: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    transform,
  } = useDraggable({ id: user.id });

  const { setNodeRef: setDropRef } = useDroppable({ id: user.id });

  // İki ref'i aynı elemente bağla
  const ref = useCallback(
    (el: HTMLDivElement | null) => {
      setDragRef(el);
      setDropRef(el);
    },
    [setDragRef, setDropRef]
  );

  const color = DEPT_COLORS[user.department] ?? "#6B7280";

  return (
    <div
      ref={ref}
      {...listeners}
      {...attributes}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.35 : 1,
        borderColor: isOver ? "#F57C28" : color + "40",
        boxShadow: isOver
          ? "0 0 0 2px #F57C28, 0 8px 24px -4px rgba(245,124,40,0.25)"
          : undefined,
        transition: isDragging ? undefined : "box-shadow 0.15s, border-color 0.15s, transform 0.15s",
      }}
      className="relative bg-white border-2 rounded-2xl p-3 flex flex-col items-center gap-1.5 w-36 cursor-grab active:cursor-grabbing select-none hover:shadow-md"
    >
      {isOver && (
        <div className="absolute inset-0 rounded-2xl bg-[#F57C28]/5 pointer-events-none" />
      )}

      {/* Avatar */}
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
        style={{ backgroundColor: color }}
      >
        {initials(user.name)}
      </div>

      <p className="text-xs font-bold text-gray-800 text-center leading-snug line-clamp-2">
        {user.name}
      </p>

      <span
        className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
        style={{ backgroundColor: color + "20", color }}
      >
        {DEPT_LABELS[user.department] ?? user.department}
      </span>

      {/* Sürükleme tutamacı göstergesi */}
      <div className="flex gap-0.5 opacity-30">
        {[0, 1, 2].map((col) => (
          <div key={col} className="flex flex-col gap-0.5">
            <div className="w-0.5 h-0.5 rounded-full bg-gray-500" />
            <div className="w-0.5 h-0.5 rounded-full bg-gray-500" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Sürükleme sırasında gösterilen overlay kartı
function OverlayCard({ user }: { user: OrgUser }) {
  const color = DEPT_COLORS[user.department] ?? "#6B7280";
  return (
    <div className="bg-white border-2 border-[#F57C28] rounded-2xl p-3 flex flex-col items-center gap-1.5 w-36 shadow-2xl shadow-[#F57C28]/30 rotate-3 opacity-95">
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

// ── İlişki onay modalı ────────────────────────────────────────────────────────
function RelationModal({
  managerUser,
  subUser,
  relationType,
  saving,
  onChangeType,
  onConfirm,
  onCancel,
}: {
  managerUser: OrgUser;
  subUser: OrgUser;
  relationType: string;
  saving: boolean;
  onChangeType: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const managerColor = DEPT_COLORS[managerUser.department] ?? "#6B7280";
  const subColor = DEPT_COLORS[subUser.department] ?? "#6B7280";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
        <h3 className="text-base font-bold text-gray-800 mb-1">İlişki Kur</h3>
        <p className="text-xs text-gray-400 mb-5">
          Sürüklenen kişinin bırakılan kişiyle ilişkisini seçin.
        </p>

        {/* Kişiler */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold"
              style={{ backgroundColor: subColor }}
            >
              {initials(subUser.name)}
            </div>
            <p className="text-xs font-semibold text-gray-700 text-center truncate w-full px-1">
              {subUser.name}
            </p>
            <span className="text-[10px] text-gray-400">Sürüklenen</span>
          </div>

          <svg
            className="w-5 h-5 text-[#F57C28] flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M17 8l4 4m0 0l-4 4m4-4H3"
            />
          </svg>

          <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold"
              style={{ backgroundColor: managerColor }}
            >
              {initials(managerUser.name)}
            </div>
            <p className="text-xs font-semibold text-gray-700 text-center truncate w-full px-1">
              {managerUser.name}
            </p>
            <span className="text-[10px] text-gray-400">Bırakılan (Yönetici)</span>
          </div>
        </div>

        {/* İlişki türü seçimi */}
        <div className="mb-5">
          <label className="block text-xs font-semibold text-gray-500 mb-2">
            {subUser.name} için ilişki türü:
          </label>
          <div className="space-y-2">
            {RELATION_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className="flex items-center gap-2.5 cursor-pointer group"
              >
                <input
                  type="radio"
                  name="relationType"
                  value={opt.value}
                  checked={relationType === opt.value}
                  onChange={() => onChangeType(opt.value)}
                  className="accent-[#F57C28] w-3.5 h-3.5"
                />
                <span className="text-sm text-gray-700 group-hover:text-gray-900">
                  {opt.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            İptal
          </button>
          <button
            onClick={onConfirm}
            disabled={saving}
            className="flex-1 px-4 py-2.5 rounded-xl bg-[#F57C28] hover:bg-[#D96A1A] text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {saving ? "Kaydediliyor..." : "Onayla"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Ana bileşen ───────────────────────────────────────────────────────────────
export default function OrgEditor({ users }: { users: OrgUser[] }) {
  const router = useRouter();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [pending, setPending] = useState<{ managerId: string; subordinateId: string } | null>(null);
  const [relationType, setRelationType] = useState("SUBORDINATE");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const userMap = new Map(users.map((u) => [u.id, u]));
  const activeUser = activeId ? userMap.get(activeId) : null;

  function handleDragStart(e: DragStartEvent) {
    setActiveId(e.active.id as string);
  }

  function handleDragOver(e: DragOverEvent) {
    setOverId((e.over?.id as string) ?? null);
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveId(null);
    setOverId(null);
    if (!over || active.id === over.id) return;

    // over (bırakılan) = yönetici, active (sürüklenen) = ast
    setPending({
      managerId: over.id as string,
      subordinateId: active.id as string,
    });
    setRelationType("SUBORDINATE");
  }

  async function confirmRelation() {
    if (!pending) return;
    setSaving(true);

    const res = await fetch(`/api/users/${pending.managerId}/relations`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subordinateId: pending.subordinateId,
        relationType,
      }),
    });

    setSaving(false);
    setPending(null);

    if (res.ok) {
      const mgr = userMap.get(pending.managerId)?.name ?? "—";
      const sub = userMap.get(pending.subordinateId)?.name ?? "—";
      const label = RELATION_OPTIONS.find((o) => o.value === relationType)?.label ?? relationType;
      setToast(`${sub} → ${mgr} (${label}) kaydedildi`);
      setTimeout(() => setToast(null), 3500);
      router.refresh();
    }
  }

  const managerUser = pending ? userMap.get(pending.managerId) : null;
  const subUser = pending ? userMap.get(pending.subordinateId) : null;

  return (
    <div className="relative">
      {/* Kullanım talimatı */}
      <div className="mb-5 px-4 py-3 bg-orange-50 border border-orange-100 rounded-xl flex items-start gap-2.5">
        <svg
          className="w-4 h-4 text-[#F57C28] flex-shrink-0 mt-0.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <p className="text-xs text-orange-700">
          Bir kişiyi sürükleyip başka bir kişinin üzerine bırakın.
          Bırakılan kişi, sürüklenenin yöneticisi olur.
          İlişki türünü sonraki adımda seçebilirsiniz.
        </p>
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-wrap gap-4 p-2 min-h-[120px]">
          {users.map((user) => (
            <DndCard
              key={user.id}
              user={user}
              isOver={overId === user.id && activeId !== user.id}
              isDragging={activeId === user.id}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeUser ? <OverlayCard user={activeUser} /> : null}
        </DragOverlay>
      </DndContext>

      {/* Onay modalı */}
      {pending && managerUser && subUser && (
        <RelationModal
          managerUser={managerUser}
          subUser={subUser}
          relationType={relationType}
          saving={saving}
          onChangeType={setRelationType}
          onConfirm={confirmRelation}
          onCancel={() => setPending(null)}
        />
      )}

      {/* Toast bildirimi */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-5 py-3 rounded-xl shadow-xl z-50 whitespace-nowrap animate-fade-in">
          ✓ {toast}
        </div>
      )}
    </div>
  );
}
