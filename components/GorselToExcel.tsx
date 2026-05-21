"use client";

import { useCallback, useRef, useState } from "react";
import clsx from "clsx";

interface FileResult {
  belge_turu: string;
  headers: string[];
  rows: any[][];
  ozet: string;
}

interface FileItem {
  id: string;
  file: File;
  preview: string | null; // object URL for images
  status: "idle" | "loading" | "done" | "error";
  result?: FileResult;
  error?: string;
}

function uid() {
  return Math.random().toString(36).slice(2);
}

async function downloadExcel(items: FileItem[]) {
  const done = items.filter((f) => f.status === "done" && f.result);
  if (!done.length) return;

  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const usedNames = new Set<string>();

  done.forEach((item, i) => {
    const r = item.result!;
    const data = r.rows.map((row) =>
      r.headers.reduce((acc, h, j) => ({ ...acc, [h]: row[j] ?? "" }), {} as Record<string, any>)
    );
    const ws = XLSX.utils.json_to_sheet(data);

    let rawName = (r.belge_turu || item.file.name.replace(/\.[^.]+$/, "")).slice(0, 28);
    let sheetName = rawName;
    if (usedNames.has(sheetName)) sheetName = `${rawName}_${i + 1}`.slice(0, 31);
    usedNames.add(sheetName);

    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = done.length === 1 ? `${done[0].result!.belge_turu || "belge"}.xlsx` : "belgeler.xlsx";
  a.click();
  URL.revokeObjectURL(url);
}

function FileCard({ item, onRemove }: { item: FileItem; onRemove: () => void }) {
  const r = item.result;

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-white/10 overflow-hidden bg-white dark:bg-white/[0.02]">
      {/* Card header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-white/5">
        {/* Thumbnail or icon */}
        <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-white/5 flex items-center justify-center">
          {item.preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.preview} alt="" className="w-full h-full object-cover" />
          ) : (
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 dark:text-white truncate">{item.file.name}</p>
          <p className="text-xs text-gray-400 dark:text-white/30">{(item.file.size / 1024).toFixed(0)} KB</p>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {item.status === "loading" && (
            <svg className="w-4 h-4 text-[#F57C28] animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4l-3 3-3-3h4z" />
            </svg>
          )}
          {item.status === "done" && (
            <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          )}
          {item.status === "error" && (
            <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          )}
          {item.status === "idle" && (
            <button onClick={onRemove} className="text-gray-300 dark:text-white/20 hover:text-red-400 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {item.status === "error" && item.error && (
        <div className="px-4 py-3 bg-red-50 dark:bg-red-500/10">
          <p className="text-xs text-red-600 dark:text-red-400">{item.error}</p>
        </div>
      )}

      {/* Result */}
      {item.status === "done" && r && (
        <div className="p-4 space-y-3">
          {/* Belge türü badge + özet */}
          <div className="flex flex-wrap items-start gap-2">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-[#F57C28]/10 text-[#F57C28]">
              {r.belge_turu}
            </span>
          </div>
          {r.ozet && (
            <p className="text-xs text-gray-500 dark:text-white/40 leading-relaxed">{r.ozet}</p>
          )}

          {/* Mini preview table */}
          {r.headers.length > 0 && (
            <div className="rounded-xl border border-gray-100 dark:border-white/5 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-white/[0.03] border-b border-gray-100 dark:border-white/5">
                      {r.headers.map((h, i) => (
                        <th key={i} className="px-3 py-2 text-left font-semibold text-gray-500 dark:text-white/40 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {r.rows.slice(0, 4).map((row, ri) => (
                      <tr key={ri} className={clsx("border-b border-gray-50 dark:border-white/5 last:border-0", ri % 2 === 1 ? "bg-gray-50/40 dark:bg-white/[0.01]" : "")}>
                        {r.headers.map((_, ci) => (
                          <td key={ci} className="px-3 py-1.5 text-gray-700 dark:text-white/70 whitespace-nowrap">
                            {row[ci] != null ? String(row[ci]) : ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {r.rows.length > 4 && (
                <p className="px-3 py-1.5 text-xs text-gray-400 dark:text-white/25 border-t border-gray-50 dark:border-white/5">
                  +{r.rows.length - 4} satır daha — Excel'de tamamı görünür
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function GorselToExcel() {
  const [items, setItems] = useState<FileItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((fileList: FileList | File[]) => {
    const arr = Array.from(fileList);
    const newItems: FileItem[] = arr.map((file) => ({
      id: uid(),
      file,
      preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
      status: "idle",
    }));
    setItems((prev) => [...prev, ...newItems]);
  }, []);

  function removeItem(id: string) {
    setItems((prev) => {
      const item = prev.find((f) => f.id === id);
      if (item?.preview) URL.revokeObjectURL(item.preview);
      return prev.filter((f) => f.id !== id);
    });
  }

  async function convertAll() {
    const idleItems = items.filter((f) => f.status === "idle");
    if (!idleItems.length) return;

    // Mark all idle as loading
    setItems((prev) =>
      prev.map((f) => (f.status === "idle" ? { ...f, status: "loading" } : f))
    );

    await Promise.all(
      idleItems.map(async (item) => {
        try {
          const fd = new FormData();
          fd.append("file", item.file);
          const res = await fetch("/api/ai/gorsel-to-excel", { method: "POST", body: fd });
          const json = await res.json();

          if (!res.ok) {
            setItems((prev) =>
              prev.map((f) =>
                f.id === item.id ? { ...f, status: "error", error: json.error ?? "Bilinmeyen hata" } : f
              )
            );
            return;
          }

          setItems((prev) =>
            prev.map((f) =>
              f.id === item.id ? { ...f, status: "done", result: json } : f
            )
          );
        } catch {
          setItems((prev) =>
            prev.map((f) =>
              f.id === item.id ? { ...f, status: "error", error: "Sunucuya bağlanılamadı" } : f
            )
          );
        }
      })
    );
  }

  const hasIdle = items.some((f) => f.status === "idle");
  const isLoading = items.some((f) => f.status === "loading");
  const hasDone = items.some((f) => f.status === "done");

  return (
    <div className="space-y-5">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={clsx(
          "rounded-2xl border-2 border-dashed p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all",
          dragging
            ? "border-[#F57C28] bg-[#F57C28]/5"
            : "border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] hover:border-[#F57C28]/50 hover:bg-[#F57C28]/[0.03]"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.webp,.pdf"
          className="hidden"
          onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ""; }}
        />

        <div className="w-14 h-14 rounded-2xl bg-[#F57C28]/10 flex items-center justify-center mb-4">
          <svg className="w-7 h-7 text-[#F57C28]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 3.75H6A2.25 2.25 0 003.75 6v1.5M16.5 3.75H18A2.25 2.25 0 0120.25 6v1.5m0 9V18A2.25 2.25 0 0118 20.25h-1.5m-9 0H6A2.25 2.25 0 013.75 18v-1.5M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>

        <p className="text-sm font-medium text-gray-600 dark:text-white/60">
          Görselleri sürükleyin ya da tıklayın
        </p>
        <p className="text-xs text-gray-400 dark:text-white/30 mt-1">
          JPG, PNG, WEBP, PDF · Çoklu dosya · Maks 10MB/dosya
        </p>
      </div>

      {/* File cards */}
      {items.length > 0 && (
        <div className="space-y-3">
          {items.map((item) => (
            <FileCard key={item.id} item={item} onRemove={() => removeItem(item.id)} />
          ))}
        </div>
      )}

      {/* Action buttons */}
      {items.length > 0 && (
        <div className="flex gap-3">
          {hasIdle && !isLoading && (
            <button
              onClick={convertAll}
              className="flex-1 py-3 rounded-xl bg-[#F57C28] hover:bg-[#e06e20] text-white font-semibold text-sm transition-colors"
            >
              {items.filter((f) => f.status === "idle").length > 1
                ? `${items.filter((f) => f.status === "idle").length} Dosyayı Dönüştür`
                : "Dönüştür"}
            </button>
          )}

          {isLoading && (
            <div className="flex-1 py-3 rounded-xl bg-gray-100 dark:bg-white/5 flex items-center justify-center gap-2">
              <svg className="w-4 h-4 text-[#F57C28] animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4l-3 3-3-3h4z" />
              </svg>
              <span className="text-sm text-gray-500 dark:text-white/40">
                {items.filter((f) => f.status === "loading").length} dosya işleniyor...
              </span>
            </div>
          )}

          {hasDone && !isLoading && (
            <button
              onClick={() => downloadExcel(items)}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              {items.filter((f) => f.status === "done").length > 1 ? "Tümünü Excel İndir" : "Excel İndir"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
