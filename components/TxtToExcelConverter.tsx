"use client";

import { useRef, useState } from "react";
import clsx from "clsx";

const PREVIEW_LINES = 100;  // önizleme için kaç satır gönderilir
const CHUNK_LINES  = 3000;  // tam işlemde parça başına satır sayısı

interface TableResult {
  headers: string[];
  rows: any[][];
}

async function downloadExcel(result: TableResult, filename = "veri.xlsx") {
  const XLSX = await import("xlsx");
  const data = result.rows.map((row) =>
    result.headers.reduce(
      (acc, h, i) => ({ ...acc, [h]: row[i] ?? "" }),
      {} as Record<string, any>
    )
  );
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Veri");
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** API'ye tek bir chunk gönderir. knownHeaders verilirse continuation modunda çalışır. */
async function sendChunk(
  text: string,
  knownHeaders?: string[]
): Promise<{ headers?: string[]; rows: any[][] }> {
  const fd = new FormData();
  fd.append("text", text);
  if (knownHeaders) fd.append("headers", JSON.stringify(knownHeaders));

  const res = await fetch("/api/ai/txt-to-excel", { method: "POST", body: fd });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Bilinmeyen bir hata oluştu");
  return json;
}

type Phase = "idle" | "preview_loading" | "preview" | "processing" | "done";

export default function TxtToExcelConverter() {
  const inputRef = useRef<HTMLInputElement>(null);
  const allLinesRef = useRef<string[]>([]);   // önbellek — re-render gerektirmez

  const [inputMode, setInputMode] = useState<"file" | "text">("file");
  const [file, setFile]     = useState<File | null>(null);
  const [text, setText]     = useState("");
  const [dragging, setDragging] = useState(false);
  const [phase, setPhase]   = useState<Phase>("idle");
  const [error, setError]   = useState<string | null>(null);

  // Önizleme aşaması
  const [previewResult, setPreviewResult] = useState<TableResult | null>(null);

  // Tam işlem aşaması
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [finalResult, setFinalResult] = useState<TableResult | null>(null);

  function resetState() {
    setPhase("idle");
    setError(null);
    setPreviewResult(null);
    setFinalResult(null);
    setProgress({ current: 0, total: 0 });
    allLinesRef.current = [];
  }

  function handleFile(f: File) {
    setFile(f);
    resetState();
  }

  // ─── AŞAMA 1: İlk 100 satırı işle, önizle ───────────────────────────────
  async function loadPreview() {
    setPhase("preview_loading");
    setError(null);

    try {
      let rawText = "";
      if (inputMode === "file" && file) {
        rawText = await file.text();
      } else if (inputMode === "text" && text.trim()) {
        rawText = text;
      } else {
        setError("Lütfen bir dosya seçin veya metin girin");
        setPhase("idle");
        return;
      }

      const lines = rawText.split("\n");
      allLinesRef.current = lines; // tüm satırları sakla

      const previewText = lines.slice(0, PREVIEW_LINES).join("\n");
      const result = await sendChunk(previewText);

      if (!result.headers?.length) {
        setError("Başlıklar çıkarılamadı. Dosya içeriğini kontrol edin");
        setPhase("idle");
        return;
      }

      setPreviewResult({ headers: result.headers, rows: result.rows });
      setPhase("preview");
    } catch (err: any) {
      setError(err.message ?? "Sunucuya bağlanılamadı");
      setPhase("idle");
    }
  }

  // ─── AŞAMA 2: Kalan satırları chunk'lara bölerek işle ────────────────────
  async function processAll() {
    if (!previewResult) return;
    setPhase("processing");
    setError(null);

    const { headers, rows: previewRows } = previewResult;
    const remainingLines = allLinesRef.current.slice(PREVIEW_LINES);

    // 3000 satırlık chunk'lara böl
    const chunks: string[] = [];
    for (let i = 0; i < remainingLines.length; i += CHUNK_LINES) {
      const chunk = remainingLines.slice(i, i + CHUNK_LINES).join("\n").trim();
      if (chunk) chunks.push(chunk);
    }

    setProgress({ current: 0, total: chunks.length });

    let allRows: any[][] = [...previewRows];

    for (let i = 0; i < chunks.length; i++) {
      try {
        const result = await sendChunk(chunks[i], headers);
        if (Array.isArray(result.rows)) {
          allRows = [...allRows, ...result.rows];
        }
      } catch (err: any) {
        setError(`Parça ${i + 1}/${chunks.length} işlenirken hata: ${err.message}`);
        // Hata olsa da devam et — kısmi sonucu göster
      }
      setProgress({ current: i + 1, total: chunks.length });
    }

    setFinalResult({ headers, rows: allRows });
    setPhase("done");
  }

  const canPreview =
    inputMode === "file" ? !!file : text.trim().length > 0;

  return (
    <div className="space-y-5">
      {/* Mod seçici */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-white/[0.06] rounded-xl w-fit">
        {(["file", "text"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => { setInputMode(mode); resetState(); }}
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

      {/* Dosya yükleme */}
      {inputMode === "file" && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files[0];
            if (f) handleFile(f);
          }}
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
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
          <svg className="w-8 h-8 text-[#F57C28]/60 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          {file ? (
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-white">{file.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {(file.size / 1024).toFixed(0)} KB
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-white/60">
                TXT, CSV veya TSV dosyası sürükleyin
              </p>
              <p className="text-xs text-gray-400 dark:text-white/30 mt-1">Maks 10MB</p>
            </div>
          )}
        </div>
      )}

      {/* Metin girişi */}
      {inputMode === "text" && (
        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); resetState(); }}
          placeholder="Verileri buraya yapıştırın..."
          rows={8}
          className="w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/25 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28]/50 resize-none font-mono"
        />
      )}

      {/* Hata */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
          <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* ─── İlk "Önizle" butonu ─── */}
      {phase === "idle" && canPreview && (
        <button
          onClick={loadPreview}
          className="w-full py-3 rounded-xl bg-[#F57C28] hover:bg-[#e06e20] text-white font-semibold text-sm transition-colors"
        >
          Önizle (İlk {PREVIEW_LINES} satır)
        </button>
      )}

      {/* ─── Önizleme yükleniyor ─── */}
      {phase === "preview_loading" && (
        <div className="flex flex-col items-center gap-3 py-6">
          <svg className="w-8 h-8 text-[#F57C28] animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4l-3 3-3-3h4z" />
          </svg>
          <p className="text-sm text-gray-500 dark:text-white/40">
            İlk {PREVIEW_LINES} satır analiz ediliyor...
          </p>
        </div>
      )}

      {/* ─── Önizleme + onay butonları ─── */}
      {phase === "preview" && previewResult && (
        <div className="space-y-4">
          <PreviewTable result={previewResult} label={`Önizleme — İlk ${PREVIEW_LINES} satır`} />

          <div className="flex gap-3">
            <button
              onClick={processAll}
              className="flex-1 py-3 rounded-xl bg-[#F57C28] hover:bg-[#e06e20] text-white font-semibold text-sm transition-colors"
            >
              Devam Et — Tümünü Dönüştür
            </button>
            <button
              onClick={resetState}
              className="px-5 py-3 rounded-xl border border-gray-200 dark:border-white/10 text-sm font-medium text-gray-500 dark:text-white/40 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
            >
              İptal
            </button>
          </div>
        </div>
      )}

      {/* ─── İşleniyor + ilerleme ─── */}
      {phase === "processing" && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-gray-200 dark:border-white/10 p-6 flex flex-col items-center gap-4">
            <svg className="w-8 h-8 text-[#F57C28] animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4l-3 3-3-3h4z" />
            </svg>

            {progress.total > 0 ? (
              <div className="w-full space-y-2">
                <div className="flex justify-between text-xs text-gray-500 dark:text-white/40">
                  <span>
                    Parça {progress.current} / {progress.total} işlendi
                  </span>
                  <span>{Math.round((progress.current / progress.total) * 100)}%</span>
                </div>
                <div className="w-full h-2 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#F57C28] rounded-full transition-all duration-300"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  />
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-white/40">Veriler işleniyor...</p>
            )}
          </div>

          {/* Hata olsa bile önizlemeyi göster */}
          {error && previewResult && (
            <PreviewTable result={previewResult} label="Önizleme (kısmi)" />
          )}
        </div>
      )}

      {/* ─── Tamamlandı ─── */}
      {phase === "done" && finalResult && (
        <ResultTable
          result={finalResult}
          filename={file ? file.name.replace(/\.[^.]+$/, ".xlsx") : "veri.xlsx"}
        />
      )}
    </div>
  );
}

// ─── Alt bileşenler ──────────────────────────────────────────────────────────

function PreviewTable({ result, label }: { result: TableResult; label: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-white/10 overflow-hidden">
      <div className="px-5 py-3 bg-gray-50 dark:bg-white/[0.04] border-b border-gray-200 dark:border-white/10">
        <p className="text-sm font-semibold text-gray-800 dark:text-white">
          {label} · {result.headers.length} sütun
        </p>
      </div>
      <TableBody result={result} maxRows={20} />
    </div>
  );
}

function ResultTable({ result, filename }: { result: TableResult; filename: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-white/10 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 bg-gray-50 dark:bg-white/[0.04] border-b border-gray-200 dark:border-white/10">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-white">
          Sonuç — {result.rows.length} satır, {result.headers.length} sütun
        </h3>
        <button
          onClick={() => downloadExcel(result, filename)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Excel İndir
        </button>
      </div>
      <TableBody result={result} maxRows={50} />
      {result.rows.length > 50 && (
        <p className="px-5 py-2.5 text-xs text-gray-400 dark:text-white/30 border-t border-gray-100 dark:border-white/5">
          {result.rows.length - 50} satır daha — Excel indirince tamamı dahil olur
        </p>
      )}
    </div>
  );
}

function TableBody({ result, maxRows }: { result: TableResult; maxRows: number }) {
  return (
    <div className="overflow-x-auto max-h-72 overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0">
          <tr className="bg-gray-50 dark:bg-[#17172A] border-b border-gray-200 dark:border-white/10">
            {result.headers.map((h, i) => (
              <th
                key={i}
                className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-white/40 uppercase tracking-wider whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.slice(0, maxRows).map((row, ri) => (
            <tr
              key={ri}
              className={clsx(
                "border-b border-gray-50 dark:border-white/5 last:border-0",
                ri % 2 === 1 ? "bg-gray-50/50 dark:bg-white/[0.02]" : ""
              )}
            >
              {result.headers.map((_, ci) => (
                <td key={ci} className="px-4 py-2 text-gray-800 dark:text-white/80 whitespace-nowrap">
                  {row[ci] != null ? String(row[ci]) : ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
