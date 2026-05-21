"use client";

import { useRef, useState } from "react";
import clsx from "clsx";

interface TableResult {
  headers: string[];
  rows: string[][];
}

async function downloadExcel(result: TableResult, filename = "veri.xlsx") {
  const XLSX = await import("xlsx");
  const data = result.rows.map((row) =>
    result.headers.reduce((acc, h, i) => ({ ...acc, [h]: row[i] ?? "" }), {} as Record<string, string>)
  );
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Veri");
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function TxtToExcelConverter() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputMode, setInputMode] = useState<"file" | "text">("file");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TableResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFile(f: File) {
    setFile(f);
    setResult(null);
    setError(null);
  }

  async function convert() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const fd = new FormData();
      if (inputMode === "file" && file) {
        fd.append("file", file);
      } else if (inputMode === "text" && text.trim()) {
        fd.append("text", text);
      } else {
        setError("Lütfen bir dosya seçin veya metin girin");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/ai/txt-to-excel", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Bilinmeyen bir hata oluştu");
        return;
      }
      setResult(json);
    } catch {
      setError("Sunucuya bağlanılamadı. İnternet bağlantınızı kontrol edin");
    } finally {
      setLoading(false);
    }
  }

  const canConvert = inputMode === "file" ? !!file : text.trim().length > 0;

  return (
    <div className="space-y-5">
      {/* Mode toggle */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-white/[0.06] rounded-xl w-fit">
        {(["file", "text"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => { setInputMode(mode); setResult(null); setError(null); }}
            className={clsx(
              "px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
              inputMode === mode
                ? "bg-white dark:bg-[#17172A] text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/70"
            )}
          >
            {mode === "file" ? "Dosya Yükle" : "Metin Yapıştır"}
          </button>
        ))}
      </div>

      {/* File input */}
      {inputMode === "file" && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          onClick={() => inputRef.current?.click()}
          className={clsx(
            "rounded-2xl border-2 border-dashed p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all",
            dragging
              ? "border-[#F57C28] bg-[#F57C28]/5"
              : "border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] hover:border-[#F57C28]/50 hover:bg-[#F57C28]/[0.03]"
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".txt,.csv,.tsv,.log"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          <svg className="w-8 h-8 text-[#F57C28]/60 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          {file ? (
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-white">{file.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">{(file.size / 1024).toFixed(0)} KB</p>
            </div>
          ) : (
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-white/60">TXT, CSV veya TSV dosyası sürükleyin</p>
              <p className="text-xs text-gray-400 dark:text-white/30 mt-1">Maks 10MB</p>
            </div>
          )}
        </div>
      )}

      {/* Text input */}
      {inputMode === "text" && (
        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); setResult(null); setError(null); }}
          placeholder="Verileri buraya yapıştırın..."
          rows={8}
          className="w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/25 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28]/50 resize-none font-mono"
        />
      )}

      {/* Convert button */}
      {canConvert && !loading && (
        <button
          onClick={convert}
          className="w-full py-3 rounded-xl bg-[#F57C28] hover:bg-[#e06e20] text-white font-semibold text-sm transition-colors"
        >
          Dönüştür
        </button>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center gap-3 py-6">
          <svg className="w-8 h-8 text-[#F57C28] animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4l-3 3-3-3h4z" />
          </svg>
          <p className="text-sm text-gray-500 dark:text-white/40">Veriler analiz ediliyor...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
          <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Preview table */}
      {result && (
        <div className="rounded-2xl border border-gray-200 dark:border-white/10 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 bg-gray-50 dark:bg-white/[0.04] border-b border-gray-200 dark:border-white/10">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-white">
              Önizleme — {result.rows.length} satır, {result.headers.length} sütun
            </h3>
            <button
              onClick={() => downloadExcel(result, file ? file.name.replace(/\.[^.]+$/, ".xlsx") : "veri.xlsx")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Excel İndir
            </button>
          </div>
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0">
                <tr className="bg-gray-50 dark:bg-[#17172A] border-b border-gray-200 dark:border-white/10">
                  {result.headers.map((h, i) => (
                    <th key={i} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-white/40 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.slice(0, 50).map((row, ri) => (
                  <tr key={ri} className={clsx("border-b border-gray-50 dark:border-white/5 last:border-0", ri % 2 === 1 ? "bg-gray-50/50 dark:bg-white/[0.02]" : "")}>
                    {result.headers.map((_, ci) => (
                      <td key={ci} className="px-4 py-2 text-gray-800 dark:text-white/80 whitespace-nowrap">
                        {row[ci] ?? ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.rows.length > 50 && (
            <p className="px-5 py-2.5 text-xs text-gray-400 dark:text-white/30 border-t border-gray-100 dark:border-white/5">
              {result.rows.length - 50} satır daha — Excel indirince tamamı dahil olur
            </p>
          )}
        </div>
      )}
    </div>
  );
}
