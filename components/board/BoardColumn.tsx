"use client";

import clsx from "clsx";
import { WorkflowUser } from "@/lib/task-permissions";
import TaskCard from "./TaskCard";
import { BOARD_COLUMN_DEFS, BoardColumnState, BoardCompletedRange, BoardStatus } from "./types";

interface Props {
  column: BoardColumnState;
  currentUserId: string;
  userIdentity: WorkflowUser;
  onOpen: (taskId: string) => void;
  onActionDone: () => void;
  onLoadMore: (status: BoardStatus) => void;
  loadingMore: boolean;
  isDark: boolean;
  /** Yalnızca DONE kolonu için (#36/#37/#38) */
  completedRange?: BoardCompletedRange;
  onCompletedRangeChange?: (range: BoardCompletedRange) => void;
}

export default function BoardColumn({
  column, currentUserId, userIdentity, onOpen, onActionDone, onLoadMore, loadingMore, isDark,
  completedRange, onCompletedRangeChange,
}: Props) {
  const def = BOARD_COLUMN_DEFS.find((c) => c.id === column.status)!;

  return (
    <div className="flex flex-col w-72 flex-shrink-0">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: def.color }} />
          <h3 className="text-sm font-bold text-gray-700">{def.label}</h3>
        </div>
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ backgroundColor: def.bg, color: def.color }}
        >
          {column.total}
        </span>
      </div>

      {/* #37: DONE kolonu — Son 30 Gün / Tümünü Göster seçici */}
      {column.status === "DONE" && completedRange && onCompletedRangeChange && (
        <div className="flex items-center gap-1 mb-2.5 p-0.5 rounded-lg bg-gray-100 w-fit">
          {([
            { value: "30d" as const, label: "Son 30 Gün" },
            { value: "all" as const, label: "Tümünü Göster" },
          ]).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onCompletedRangeChange(opt.value)}
              className={clsx(
                "text-[10px] font-semibold px-2 py-1 rounded-md transition-colors",
                completedRange === opt.value ? "bg-white text-gray-800 shadow-sm" : "text-gray-400 hover:text-gray-600"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      <div
        className="flex-1 rounded-2xl p-2 space-y-2.5 min-h-[420px]"
        style={{ backgroundColor: isDark ? def.darkBg : def.bg + "60" }}
      >
        {column.items.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            currentUserId={currentUserId}
            userIdentity={userIdentity}
            onOpen={onOpen}
            onActionDone={onActionDone}
          />
        ))}

        {column.items.length === 0 && (
          <div className="flex flex-col items-center justify-center h-24 rounded-xl border-2 border-dashed border-gray-200 text-gray-300 text-xs">
            Görev yok
          </div>
        )}

        {column.hasMore && (
          <button
            type="button"
            onClick={() => onLoadMore(column.status)}
            disabled={loadingMore}
            className="w-full text-xs font-semibold text-gray-500 hover:text-[#F57C28] disabled:opacity-50 py-2 rounded-lg border border-dashed border-gray-300 hover:border-[#F57C28]/40 transition-colors"
          >
            {loadingMore ? "Yükleniyor..." : "Daha Fazla Göster"}
          </button>
        )}
      </div>
    </div>
  );
}
