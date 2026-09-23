"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { PRIORITY_OPTIONS } from "@/lib/task-fields";
import type { BoardFilters, BoardMeta, BoardQuickView } from "./types";
import { DEPARTMENT_FILTER_OPTIONS } from "./types";

const QUICK_VIEWS: { value: BoardQuickView; label: string }[] = [
  { value: "mine", label: "Bana Atananlar" },
  { value: "given", label: "Benim Verdiğim" },
  { value: "all", label: "Tüm Görevler" },
];

const OVERDUE_OPTIONS: { value: "" | "yes" | "no"; label: string }[] = [
  { value: "", label: "Tümü" },
  { value: "yes", label: "Gecikmiş" },
  { value: "no", label: "Gecikmemiş" },
];

interface Props {
  filters: BoardFilters;
  onChange: (patch: Partial<BoardFilters>) => void;
  meta: BoardMeta;
  isAdmin: boolean;
}

const selectCls =
  "text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#F57C28]/40";

export default function BoardFilters({ filters, onChange, meta, isAdmin }: Props) {
  // Arama alanı: her tuş vuruşunda API çağırmamak için hafif debounce.
  const [searchInput, setSearchInput] = useState(filters.q);
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput !== filters.q) onChange({ q: searchInput });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);
  useEffect(() => setSearchInput(filters.q), [filters.q]);

  return (
    <div className="mb-4 space-y-3">
      {/* #7-#11: hızlı görünüm seçici */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-gray-100 w-fit">
        {QUICK_VIEWS.map((v) => (
          <button
            key={v.value}
            type="button"
            onClick={() => onChange({ view: v.value })}
            className={clsx(
              "text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors",
              filters.view === v.value ? "bg-white text-[#F57C28] shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* #12-#18: filtreler */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 sm:max-w-xs w-full">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Başlık, açıklama, proje veya kişi ara..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28] transition-all"
          />
        </div>

        <select value={filters.projectId} onChange={(e) => onChange({ projectId: e.target.value })} className={selectCls}>
          <option value="">Proje: Tümü</option>
          <option value="none">Projesiz</option>
          {meta.projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <select value={filters.personId} onChange={(e) => onChange({ personId: e.target.value })} className={selectCls}>
          <option value="">Kişi: Tümü</option>
          {meta.people.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <select value={filters.priority} onChange={(e) => onChange({ priority: e.target.value })} className={selectCls}>
          <option value="">Öncelik: Tümü</option>
          {PRIORITY_OPTIONS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>

        <select value={filters.overdue} onChange={(e) => onChange({ overdue: e.target.value as "" | "yes" | "no" })} className={selectCls}>
          {OVERDUE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.value ? o.label : "Gecikme: Tümü"}</option>
          ))}
        </select>

        {/* #18: yalnızca ADMIN — normal kullanıcının erişimi zaten kendi departmanıyla sınırlı */}
        {isAdmin && (
          <select value={filters.department} onChange={(e) => onChange({ department: e.target.value })} className={selectCls}>
            <option value="">Departman: Tümü</option>
            {DEPARTMENT_FILTER_OPTIONS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
