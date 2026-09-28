"use client";

/**
 * Dört liste (Formlarım / Onay Bekleyenler / Muhasebe İşlemleri / Tüm Formlar)
 * için ortak tablo + filtre çubuğu. Kolonlar bağlama göre seçilir. Listede
 * aksiyon butonu YOK — satır tıklanınca form detayı açılır.
 */

import { useRouter } from "next/navigation";
import { formatTRY } from "@/lib/expense/calc";
import { EXPENSE_STATUSES, EXPENSE_STATUS_LABELS, expenseDepartmentLabel } from "@/lib/expense/constants";
import type { ExpenseListRow } from "./types";
import { ExpenseStatusBadge, NetAmount, formatCreatedDate, formatDateTime, inputCls } from "./ui";

export type ExpenseColumn =
  | "formNo"
  | "owner"
  | "department"
  | "createdAt"
  | "total"
  | "advance"
  | "net"
  | "status"
  | "progress"
  | "lastAction";

const HEADERS: Record<ExpenseColumn, { label: string; align?: "right" }> = {
  formNo:     { label: "Form No" },
  owner:      { label: "Personel" },
  department: { label: "Departman" },
  createdAt:  { label: "Oluşturma Tarihi" },
  total:      { label: "Toplam Harcama", align: "right" },
  advance:    { label: "Nakit Avans", align: "right" },
  net:        { label: "Net Durum", align: "right" },
  status:     { label: "Durum" },
  progress:   { label: "Onay" },
  lastAction: { label: "Son İşlem" },
};

function Cell({ row, col }: { row: ExpenseListRow; col: ExpenseColumn }) {
  switch (col) {
    case "formNo":
      return <span className="font-semibold text-gray-800 tabular-nums">{row.formNo}</span>;
    case "owner":
      return <span className="text-gray-700">{row.ownerName}</span>;
    case "department":
      return <span className="text-gray-500">{expenseDepartmentLabel(row.department)}</span>;
    case "createdAt":
      return <span className="text-gray-500 tabular-nums">{formatCreatedDate(row.createdAt)}</span>;
    case "total":
      return <span className="tabular-nums text-gray-700">{formatTRY(row.totalAmount)}</span>;
    case "advance":
      return <span className="tabular-nums text-gray-500">{formatTRY(row.cashAdvance)}</span>;
    case "net":
      return <NetAmount amount={row.netAmount} />;
    case "status":
      return <ExpenseStatusBadge status={row.status} />;
    case "progress":
      return row.approvalProgress ? (
        <span className="tabular-nums text-xs font-semibold text-gray-600">
          {row.approvalProgress.approved}/{row.approvalProgress.required}
        </span>
      ) : (
        <span className="text-gray-300">—</span>
      );
    case "lastAction":
      return <span className="text-gray-500 tabular-nums text-xs">{formatDateTime(row.lastActionAt)}</span>;
  }
}

export function ExpenseListTable({
  rows,
  columns,
  loading,
  emptyText,
}: {
  rows: ExpenseListRow[] | null;
  columns: ExpenseColumn[];
  loading: boolean;
  emptyText: string;
}) {
  const router = useRouter();

  if (rows === null || (loading && rows.length === 0)) {
    return (
      <div className="divide-y divide-gray-50">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="px-5 py-4 animate-pulse flex items-center gap-4">
            <div className="h-4 w-28 bg-gray-100 rounded" />
            <div className="h-4 w-20 bg-gray-100 rounded" />
            <div className="h-4 w-24 bg-gray-100 rounded ml-auto" />
          </div>
        ))}
      </div>
    );
  }
  if (rows.length === 0) {
    return <div className="px-5 py-12 text-center text-sm text-gray-400">{emptyText}</div>;
  }

  return (
    <div className={loading ? "overflow-x-auto opacity-60 transition-opacity" : "overflow-x-auto"}>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
            {columns.map((c) => (
              <th key={c} className={`px-4 py-2.5 whitespace-nowrap ${HEADERS[c].align === "right" ? "text-right" : ""}`}>
                {HEADERS[c].label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => router.push(`/harcama/${row.id}`)}
              className="cursor-pointer hover:bg-gray-50 transition-colors"
            >
              {columns.map((c) => (
                <td key={c} className={`px-4 py-3 whitespace-nowrap ${HEADERS[c].align === "right" ? "text-right" : ""}`}>
                  <Cell row={row} col={c} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Filtreler ────────────────────────────────────────────────────────────────

export interface ExpenseFilterValue {
  q: string;
  status: string;
  dateFrom: string;
  dateTo: string;
  department: string;
  ownerId: string;
}

export const EMPTY_FILTERS: ExpenseFilterValue = { q: "", status: "", dateFrom: "", dateTo: "", department: "", ownerId: "" };

export function ExpenseFilters({
  value,
  onChange,
  showDepartmentAndOwner,
  facets,
}: {
  value: ExpenseFilterValue;
  onChange: (v: ExpenseFilterValue) => void;
  showDepartmentAndOwner: boolean;
  facets: { departments: string[]; owners: { id: string; name: string }[] } | null;
}) {
  const set = (patch: Partial<ExpenseFilterValue>) => onChange({ ...value, ...patch });
  const hasAny = Object.values(value).some(Boolean);
  const small = `${inputCls} !py-1.5 text-xs`;

  return (
    <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap items-end gap-2.5">
      <div className="w-56">
        <label className="block text-[11px] font-semibold text-gray-400 mb-1">Ara</label>
        <input
          value={value.q}
          onChange={(e) => set({ q: e.target.value })}
          placeholder="Form no, personel, açıklama…"
          className={small}
        />
      </div>
      <div className="w-44">
        <label className="block text-[11px] font-semibold text-gray-400 mb-1">Durum</label>
        <select value={value.status} onChange={(e) => set({ status: e.target.value })} className={small}>
          <option value="">Tümü</option>
          {EXPENSE_STATUSES.map((s) => (
            <option key={s} value={s}>{EXPENSE_STATUS_LABELS[s]}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-[11px] font-semibold text-gray-400 mb-1">Oluşturma tarihi</label>
        <div className="flex items-center gap-1.5">
          <input type="date" value={value.dateFrom} onChange={(e) => set({ dateFrom: e.target.value })} className={`${small} w-36`} />
          <span className="text-gray-300 text-xs">–</span>
          <input type="date" value={value.dateTo} min={value.dateFrom || undefined} onChange={(e) => set({ dateTo: e.target.value })} className={`${small} w-36`} />
        </div>
      </div>
      {showDepartmentAndOwner && (
        <>
          <div className="w-44">
            <label className="block text-[11px] font-semibold text-gray-400 mb-1">Departman</label>
            <select value={value.department} onChange={(e) => set({ department: e.target.value })} className={small}>
              <option value="">Tümü</option>
              {(facets?.departments ?? []).map((d) => (
                <option key={d} value={d}>{expenseDepartmentLabel(d)}</option>
              ))}
            </select>
          </div>
          <div className="w-48">
            <label className="block text-[11px] font-semibold text-gray-400 mb-1">Personel</label>
            <select value={value.ownerId} onChange={(e) => set({ ownerId: e.target.value })} className={small}>
              <option value="">Tümü</option>
              {(facets?.owners ?? []).map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
        </>
      )}
      {hasAny && (
        <button type="button" onClick={() => onChange(EMPTY_FILTERS)} className="text-xs font-medium text-gray-400 hover:text-[#F57C28] pb-2">
          Filtreleri temizle
        </button>
      )}
    </div>
  );
}
