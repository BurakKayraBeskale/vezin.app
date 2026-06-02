"use client";

import { useRef, useState } from "react";
import clsx from "clsx";

const FIRST_CHUNK_LINES = 100;  // ilk API çağrısı için satır sayısı
const CHUNK_LINES       = 1500; // devam chunk'ları için satır sayısı

interface TableResult {
  headers: string[];
  rows: any[][];
}

/** Excel indir — auto-fit sütun genişliği, bold başlık, hizalama */
async function downloadExcel(result: TableResult, filename = "veri.xlsx") {
  const XLSX = await import("xlsx");

  // Başlık + veri satırlarını birleştir
  const aoaData: any[][] = [result.headers, ...result.rows];
  const ws = XLSX.utils.aoa_to_sheet(aoaData);

  // ── Sütun genişlikleri (auto-fit, min 12 max 50) ──────────────────────────
  ws["!cols"] = result.headers.map((h, colIdx) => {
    const maxLen = Math.max(
      h.length,
      ...result.rows.map((row) => String(row[colIdx] ?? "").length)
    );
    return { wch: Math.min(50, Math.max(12, maxLen)) };
  });

  // ── Başlık satırı: bold 12pt, ortalı ─────────────────────────────────────
  result.headers.forEach((_, colIdx) => {
    const ref = XLSX.utils.encode_cell({ r: 0, c: colIdx });
    if (ws[ref]) {
      ws[ref].s = {
        font: { bold: true, sz: 12 },
        alignment: { horizontal: "center", vertical: "center" },
      };
    }
  });

  // ── Veri hücreleri: sayısal → sağa, diğer → ortaya ───────────────────────
  result.rows.forEach((row, rowIdx) => {
    row.forEach((cell, colIdx) => {
      const ref = XLSX.utils.encode_cell({ r: rowIdx + 1, c: colIdx });
      if (ws[ref]) {
        const val = String(cell ?? "").trim();
        const isNumeric = val !== "" && !isNaN(Number(val.replace(/[.,\s]/g, "")));
        ws[ref].s = {
          alignment: { horizontal: isNumeric ? "right" : "center" },
        };
      }
    });
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Veri");
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array", cellStyles: true });
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

/**
 * Hesap koduna göre TIP ve SEVİYE sütunlarını düzeltir.
 * - 1-3 karakter → TIP = "BASLIK", SEVİYE = uzunluk
 * - 4+  karakter → TIP = "HESAP",  SEVİYE = uzunluk
 */
function fixTipSeviye(headers: string[], rows: any[][]): any[][] {
  const norm = (s: string) =>
    s.toUpperCase()
      .replace(/İ/g, "I").replace(/Ş/g, "S").replace(/Ğ/g, "G")
      .replace(/Ü/g, "U").replace(/Ö/g, "O").replace(/Ç/g, "C");

  const nh = headers.map(norm);
  // Hesap kodu sütunu: "KOD" içeren veya tam olarak "HESAP"
  const kodIdx = nh.findIndex((h) => h.includes("KOD") || h === "HESAP");
  const tipIdx = nh.findIndex((h) => h === "TIP");
  const sevIdx = nh.findIndex((h) => h === "SEVIYE");

  if (kodIdx === -1 || (tipIdx === -1 && sevIdx === -1)) return rows;

  return rows.map((row) => {
    const r = [...row];
    const kod = String(r[kodIdx] ?? "").trim();
    if (!kod) return r;
    const len = kod.length;
    if (tipIdx !== -1) r[tipIdx] = len >= 4 ? "HESAP" : "BASLIK";
    if (sevIdx !== -1) r[sevIdx] = len;
    return r;
  });
}

/** API'ye tek bir chunk gönderir */
async function sendChunk(
  text: string,
  knownHeaders?: string[]
): Promise<{ headers?: string[]; rows: any[][] }> {
  const fd = new FormData();
  fd.append("text", text);
  if (knownHeaders) fd.append("headers", JSON.stringify(knownHeaders));

  const res = await fetch("/api/ai/txt-to-excel", { method: "POST", body: fd });

  const raw = await res.text();
  console.log("[txt-to-excel] HTTP durum:", res.status);
  console.log("[txt-to-excel] Ham HTTP yanıtı (parse öncesi):", raw);

  if (!raw.trim()) {
    throw new Error(
      `Sunucu boş yanıt döndürdü (HTTP ${res.status}). ` +
      "Dosya çok büyük olabilir veya sunucu zaman aşımına uğramış olabilir."
    );
  }

  let json: any;
  try {
    json = JSON.parse(raw);
    if (json.raw)   console.log("[txt-to-excel] OpenAI ham yanıtı:", json.raw);
    if (json.debug) console.error("[txt-to-excel] Hata debug:", json.debug);
  } catch {
    throw new Error(
      `Sunucu geçersiz JSON döndürdü (HTTP ${res.status}). Ham yanıt: ${raw.slice(0, 200)}`
    );
  }

  if (!res.ok) {
    const msg = json.error ?? `Sunucu hatası (HTTP ${res.status})`;
    const rawDetail   = json.raw   ? `\n\nModel ham çıktısı:\n${json.raw}` : "";
    const debugDetail = json.debug
      ? `\n\nHata detayı: status=${json.debug.status} code=${json.debug.code}\n${json.debug.message}`
      : "";
    throw new Error(msg + rawDetail + debugDetail);
  }

  return json;
}

type Phase = "idle" | "processing" | "done";

export default function TxtToExcelConverter() {
  const inputRef  = useRef<HTMLInputElement>(null);
  const allLinesRef = useRef<string[]>([]);

  const [inputMode, setInputMode] = useState<"file" | "text">("file");
  const [file, setFile]     = useState<File | null>(null);
  const [text, setText]     = useState("");
  const [dragging, setDragging] = useState(false);
  const [phase, setPhase]   = useState<Phase>("idle");
  const [error, setError]   = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0, label: "" });
  const [finalResult, setFinalResult] = useState<TableResult | null>(null);

  function resetState() {
    setPhase("idle");
    setError(null);
    setFinalResult(null);
    setProgress({ current: 0, total: 0, label: "" });
    allLinesRef.current = [];
  }

  // ── Otomatik işleme (dosya seçilince veya "Dönüştür" tıklanınca) ──────────
  async function startProcessing(rawText: string, filename: string) {
    setPhase("processing");
    setError(null);
    setFinalResult(null);

    try {
      const lines = rawText.split("\n");
      allLinesRef.current = lines;

      // 1. İlk chunk → headers + ilk satırlar
      setProgress({ current: 0, total: 0, label: "Dosya işleniyor..." });
      const firstText = lines.slice(0, FIRST_CHUNK_LINES).join("\n");
      const first = await sendChunk(firstText);

      if (!first.headers?.length) {
        setError("Başlıklar çıkarılamadı. Dosya içeriğini kontrol edin.");
        setPhase("idle");
        return;
      }

      const { headers } = first;
      let allRows: any[][] = [...(first.rows ?? [])];

      // 2. Kalan satırları chunk'lara böl
      const remaining = lines.slice(FIRST_CHUNK_LINES);
      const chunks: string[] = [];
      for (let i = 0; i < remaining.length; i += CHUNK_LINES) {
        const chunk = remaining.slice(i, i + CHUNK_LINES).join("\n").trim();
        if (chunk) chunks.push(chunk);
      }

      setProgress({ current: 0, total: chunks.length, label: "" });

      for (let i = 0; i < chunks.length; i++) {
        try {
          const res = await sendChunk(chunks[i], headers);
          if (Array.isArray(res.rows)) allRows = [...allRows, ...res.rows];
        } catch (err: any) {
          setError(`Parça ${i + 1}/${chunks.length} hatası: ${err.message}`);
        }
        setProgress({ current: i + 1, total: chunks.length, label: "" });
      }

      const fixedRows = fixTipSeviye(headers, allRows);
      const result: TableResult = { headers, rows: fixedRows };
      setFinalResult(result);
      setPhase("done");

      // Otomatik indir
      await downloadExcel(result, filename.replace(/\.[^.]+$/, ".xlsx"));
    } catch (err: any) {
      setError(err.message ?? "Bilinmeyen hata");
      setPhase("idle");
    }
  }

  function handleFile(f: File) {
    setFile(f);
    resetState();
    f.text().then((rawText) => startProcessing(rawText, f.name));
  }

  function handleTextConvert() {
    if (!text.trim()) return;
    resetState();
    startProcessing(text, "veri.xlsx");
  }

  const pct = progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : null;

  return (
    <div className="space-y-5">
      {/* Mod seçici */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-white/[0.06] rounded-xl w-fit">
        {(["file", "text"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => { setInputMode(mode); resetState(); setFile(null); setText(""); }}
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

      {/* Dosya yükleme — dosya seçilince otomatik başlar */}
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
          onClick={() => phase === "idle" && inputRef.current?.click()}
          className={clsx(
            "rounded-2xl border-2 border-dashed p-8 flex flex-col items-center justify-center text-center transition-all",
            phase === "idle" ? "cursor-pointer" : "cursor-default",
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
              <p className="text-xs text-gray-400 mt-0.5">{(file.size / 1024).toFixed(0)} KB</p>
            </div>
          ) : (
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-white/60">
                TXT, CSV veya TSV dosyası sürükleyin
              </p>
              <p className="text-xs text-gray-400 dark:text-white/30 mt-1">Maks 10MB · Seçince otomatik başlar</p>
            </div>
          )}
        </div>
      )}

      {/* Metin girişi */}
      {inputMode === "text" && (
        <>
          <textarea
            value={text}
            onChange={(e) => { setText(e.target.value); resetState(); }}
            placeholder="Verileri buraya yapıştırın..."
            rows={8}
            className="w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/25 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30 focus:border-[#F57C28]/50 resize-none font-mono"
          />
          {phase === "idle" && text.trim() && (
            <button
              onClick={handleTextConvert}
              className="w-full py-3 rounded-xl bg-[#F57C28] hover:bg-[#e06e20] text-white font-semibold text-sm transition-colors"
            >
              Dönüştür
            </button>
          )}
        </>
      )}

      {/* Hata */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
          <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <pre className="text-sm text-red-700 dark:text-red-400 whitespace-pre-wrap break-all">{error}</pre>
        </div>
      )}

      {/* ─── İşleniyor ─── */}
      {phase === "processing" && (
        <div className="rounded-2xl border border-gray-200 dark:border-white/10 p-6 flex flex-col items-center gap-4">
          <svg className="w-8 h-8 text-[#F57C28] animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4l-3 3-3-3h4z" />
          </svg>

          {pct !== null ? (
            <div className="w-full space-y-2">
              <div className="flex justify-between text-xs text-gray-500 dark:text-white/40">
                <span>Parça {progress.current} / {progress.total} işlendi</span>
                <span>{pct}%</span>
              </div>
              <div className="w-full h-2 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#F57C28] rounded-full transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-white/40">
              {progress.label || "Dönüştürülüyor..."}
            </p>
          )}
        </div>
      )}

      {/* ─── Tamamlandı ─── */}
      {phase === "done" && finalResult && (
        <ResultTable
          result={finalResult}
          filename={file ? file.name.replace(/\.[^.]+$/, ".xlsx") : "veri.xlsx"}
          onDownload={() => downloadExcel(finalResult, file ? file.name.replace(/\.[^.]+$/, ".xlsx") : "veri.xlsx")}
          onReset={resetState}
        />
      )}
    </div>
  );
}

// ─── Alt bileşenler ──────────────────────────────────────────────────────────

function ResultTable({
  result,
  filename,
  onDownload,
  onReset,
}: {
  result: TableResult;
  filename: string;
  onDownload: () => void;
  onReset: () => void;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-white/10 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 bg-gray-50 dark:bg-white/[0.04] border-b border-gray-200 dark:border-white/10">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-white">
          Sonuç — {result.rows.length} satır, {result.headers.length} sütun
        </h3>
        <div className="flex gap-2">
          <button
            onClick={onReset}
            className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 text-xs font-medium text-gray-500 dark:text-white/40 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
          >
            Yeni Dosya
          </button>
          <button
            onClick={onDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Excel İndir
          </button>
        </div>
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
