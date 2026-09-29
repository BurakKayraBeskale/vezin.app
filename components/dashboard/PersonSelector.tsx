"use client";

/**
 * "Görüntülenen Personel" seçicisi — aranabilir açılır liste.
 * Seçenekler /api/dashboard/people'dan gelir (yetki kuralı sunucuda,
 * lib/dashboard/people.ts). Tek seçenek varsa (Senior 2 ve altı) salt metin.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import type { DashboardPersonDTO } from "./types";

function fold(s: string) {
  return s.toLocaleLowerCase("tr");
}

export default function PersonSelector({
  people,
  selectedId,
  currentUserId,
  onSelect,
  disabled,
}: {
  people: DashboardPersonDTO[];
  selectedId: string;
  currentUserId: string;
  onSelect: (id: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = people.find((p) => p.id === selectedId);

  const filtered = useMemo(() => {
    const q = fold(query.trim());
    return q ? people.filter((p) => fold(p.name).includes(q)) : people;
  }, [people, query]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function choose(id: string) {
    setOpen(false);
    setQuery("");
    if (id !== selectedId) onSelect(id);
  }

  const label = (
    <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Görüntülenen Personel</span>
  );

  if (people.length <= 1) {
    return (
      <div className="flex flex-col items-start sm:items-end gap-1">
        {label}
        <span className="text-sm font-semibold text-gray-800">{selected?.name ?? "—"}</span>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative flex flex-col items-start sm:items-end gap-1">
      {label}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center gap-2 min-w-[220px] justify-between px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-800 hover:border-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F57C28]/40 disabled:opacity-60"
      >
        <span className="truncate">{selected?.name ?? "Seçin"}</span>
        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-40 w-72 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setOpen(false);
                if (e.key === "Enter" && filtered[0]) choose(filtered[0].id);
              }}
              placeholder="Ad Soyad ara..."
              className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-200 bg-white text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30"
            />
          </div>
          <ul role="listbox" className="max-h-72 overflow-y-auto py-1">
            {filtered.length === 0 && <li className="px-3 py-2 text-sm text-gray-400">Sonuç yok</li>}
            {filtered.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={p.id === selectedId}
                  onClick={() => choose(p.id)}
                  className={clsx(
                    "w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between gap-2",
                    p.id === selectedId ? "text-[#F57C28] font-semibold" : "text-gray-700"
                  )}
                >
                  <span className="truncate">
                    {p.name}
                    {p.id === currentUserId && <span className="ml-1.5 text-[11px] font-medium text-gray-400">(siz)</span>}
                  </span>
                  {p.title && <span className="text-[11px] text-gray-400 flex-shrink-0">{p.title}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
