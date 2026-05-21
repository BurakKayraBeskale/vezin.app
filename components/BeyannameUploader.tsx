"use client";

import { useRef, useState } from "react";
import clsx from "clsx";

interface VeriSatiri {
  alan: string;
  deger: string;
  birim?: string;
}

interface BeyannameResult {
  belge_turu: string;
  mukellef?: string;
  vergi_no?: string;
  donem?: string;
  veriler: VeriSatiri[];
  ozet?: string;
}

async function downloadExcel(result: BeyannameResult) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  // --- Sheet 1: Özet ---
  const ozetRows = [
    { Alan: "Belge Türü", Değer: result.belge_turu },
    { Alan: "Mükellef", Değer: result.mukellef ?? "" },
    { Alan: "Vergi No", Değer: result.vergi_no ?? "" },
    { Alan: "Dönem", Değer: result.donem ?? "" },
    { Alan: "Özet", Değer: result.ozet ?? "" },
  ];
  const wsOzet = XLSX.utils.json_to_sheet(ozetRows);
  wsOzet["!cols"] = [{ wch: 20 }, { wch: 55 }];
  XLSX.utils.book_append_sheet(wb, wsOzet, "Özet");

  // --- Sheet 2: Veriler ---
  const veriRows = result.veriler.map((v) => {
    const numericVal = parseFloat(String(v.deger).replace(/[^0-9.,\-]/g, "").replace(",", "."));
    const deger = !isNaN(numericVal) ? numericVal : v.deger;
    return { Alan: v.alan, Değer: deger, Birim: v.birim ?? "" };
  });
  const wsVeriler = XLSX.utils.json_to_sheet(veriRows);
  wsVeriler["!cols"] = [{ wch: 40 }, { wch: 20 }, { wch: 10 }];

  // TRY para formatı uygula sayısal hücrelere
  const TRY_FORMAT = '#,##0.00 [$₺-tr-TR]';
  veriRows.forEach((row, i) => {
    if (typeof row["Değer"] === "number") {
      const cellAddr = XLSX.utils.encode_cell({ r: i + 1, c: 1 }); // +1 header satırı
      if (wsVeriler[cellAddr]) wsVeriler[cellAddr].z = TRY_FORMAT;
    }
  });

  XLSX.utils.book_append_sheet(wb, wsVeriler, "Veriler");

  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${result.belge_turu || "beyanname"}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function BeyannameUploader() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BeyannameResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFile(f: File) {
    setFile(f);
    setResult(null);
    setError(null);
  }

  async function convert() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/ai/beyanname", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Bilinmeyen bir hata oluştu");
        return;
      }
      setResult(json.data);
    } catch {
      setError("Sunucuya bağlanılamadı. İnternet bağlantınızı kontrol edin");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Upload area */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
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
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
        />
        <div className="w-12 h-12 rounded-xl bg-[#F57C28]/10 flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-[#F57C28]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        </div>
        {file ? (
          <div>
            <p className="text-sm font-semibold text-gray-800 dark:text-white">{file.name}</p>
            <p className="text-xs text-gray-400 dark:text-white/40 mt-0.5">
              {(file.size / 1024).toFixed(0)} KB — değiştirmek için tıklayın
            </p>
          </div>
        ) : (
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-white/60">
              PDF veya görsel sürükleyin ya da tıklayın
            </p>
            <p className="text-xs text-gray-400 dark:text-white/30 mt-1">PDF, JPG, PNG, WEBP · Maks 10MB</p>
          </div>
        )}
      </div>

      {/* Convert button */}
      {file && !loading && (
        <button
          onClick={convert}
          className="w-full py-3 rounded-xl bg-[#F57C28] hover:bg-[#e06e20] text-white font-semibold text-sm transition-colors"
        >
          Dönüştür
        </button>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center gap-3 py-8">
          <svg className="w-8 h-8 text-[#F57C28] animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4l-3 3-3-3h4z" />
          </svg>
          <p className="text-sm text-gray-500 dark:text-white/40">Belge analiz ediliyor...</p>
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

      {/* Result */}
      {result && (
        <div className="space-y-4">
          {/* Header: belge türü + kimlik bilgileri */}
          <div className="rounded-2xl border border-gray-200 dark:border-white/10 p-5 bg-white dark:bg-white/[0.02] space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-[#F57C28]/10 text-[#F57C28] uppercase tracking-wide">
                  {result.belge_turu}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-1 mt-2">
                  {result.mukellef && (
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 dark:text-white/30 uppercase tracking-wider">Mükellef</p>
                      <p className="text-sm font-semibold text-gray-800 dark:text-white">{result.mukellef}</p>
                    </div>
                  )}
                  {result.vergi_no && (
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 dark:text-white/30 uppercase tracking-wider">Vergi No</p>
                      <p className="text-sm font-semibold text-gray-800 dark:text-white font-mono">{result.vergi_no}</p>
                    </div>
                  )}
                  {result.donem && (
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 dark:text-white/30 uppercase tracking-wider">Dönem</p>
                      <p className="text-sm font-semibold text-gray-800 dark:text-white">{result.donem}</p>
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => downloadExcel(result)}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Excel İndir
              </button>
            </div>

            {/* Özet */}
            {result.ozet && (
              <p className="text-xs text-gray-500 dark:text-white/40 leading-relaxed border-t border-gray-100 dark:border-white/5 pt-3">
                {result.ozet}
              </p>
            )}
          </div>

          {/* Veriler tablosu */}
          {result.veriler?.length > 0 && (
            <div className="rounded-2xl border border-gray-200 dark:border-white/10 overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 dark:bg-white/[0.04] border-b border-gray-200 dark:border-white/10">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-white">
                  Veriler — {result.veriler.length} kalem
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-white/5">
                      <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-400 dark:text-white/30 uppercase tracking-wider">Alan</th>
                      <th className="text-right px-5 py-2.5 text-xs font-semibold text-gray-400 dark:text-white/30 uppercase tracking-wider">Değer</th>
                      <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-400 dark:text-white/30 uppercase tracking-wider w-16">Birim</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.veriler.map((v, i) => {
                      const isCurrency = v.birim === "TRY";
                      const numVal = parseFloat(String(v.deger).replace(/[^0-9.,\-]/g, "").replace(",", "."));
                      const displayVal = isCurrency && !isNaN(numVal)
                        ? numVal.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        : v.deger;

                      return (
                        <tr key={i} className={clsx("border-b border-gray-50 dark:border-white/5 last:border-0", i % 2 === 1 ? "bg-gray-50/50 dark:bg-white/[0.02]" : "")}>
                          <td className="px-5 py-2.5 text-gray-600 dark:text-white/60">{v.alan}</td>
                          <td className={clsx("px-5 py-2.5 text-right font-semibold tabular-nums", isCurrency ? "text-gray-900 dark:text-white" : "text-gray-700 dark:text-white/80")}>
                            {isCurrency && "₺ "}{displayVal}
                          </td>
                          <td className="px-5 py-2.5 text-xs text-gray-400 dark:text-white/30">{v.birim || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
