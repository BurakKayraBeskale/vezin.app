"use client";

import { useRef, useState } from "react";
import clsx from "clsx";

interface Fark {
  satir: number;
  alan?: string;
  eski_deger?: string;
  yeni_deger?: string;
  tip: "degistirildi" | "eklendi" | "silindi";
}

interface ComparisonResult {
  ozet: {
    dosya1_satir_sayisi: number;
    dosya2_satir_sayisi: number;
    degisen_satir: number;
    eklenen_satir: number;
    silinen_satir: number;
  };
  farklar: Fark[];
}

const tipConfig = {
  degistirildi: { label: "Değiştirildi", bg: "bg-yellow-50 dark:bg-yellow-500/10", text: "text-yellow-700 dark:text-yellow-400", badge: "bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-300" },
  eklendi: { label: "Eklendi", bg: "bg-emerald-50 dark:bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-400", badge: "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300" },
  silindi: { label: "Silindi", bg: "bg-red-50 dark:bg-red-500/10", text: "text-red-700 dark:text-red-400", badge: "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300" },
};

async function downloadReport(result: ComparisonResult, name1: string, name2: string) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  // Özet sayfası
  const ozetData = [
    { Alan: `${name1} satır sayısı`, Değer: result.ozet.dosya1_satir_sayisi },
    { Alan: `${name2} satır sayısı`, Değer: result.ozet.dosya2_satir_sayisi },
    { Alan: "Değiştirilen satır", Değer: result.ozet.degisen_satir },
    { Alan: "Eklenen satır", Değer: result.ozet.eklenen_satir },
    { Alan: "Silinen satır", Değer: result.ozet.silinen_satir },
  ];
  const wsSummary = XLSX.utils.json_to_sheet(ozetData);
  XLSX.utils.book_append_sheet(wb, wsSummary, "Özet");

  // Farklar sayfası
  const farklarData = result.farklar.map((f) => ({
    Satır: f.satir,
    Alan: f.alan ?? "",
    "Eski Değer": f.eski_deger ?? "",
    "Yeni Değer": f.yeni_deger ?? "",
    Tip: tipConfig[f.tip]?.label ?? f.tip,
  }));
  const wsDiff = XLSX.utils.json_to_sheet(farklarData);
  XLSX.utils.book_append_sheet(wb, wsDiff, "Farklar");

  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "karsilastirma_raporu.xlsx";
  a.click();
  URL.revokeObjectURL(url);
}

function FileDropZone({
  label, file, onFile,
}: { label: string; file: File | null; onFile: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
      onClick={() => ref.current?.click()}
      className={clsx(
        "rounded-2xl border-2 border-dashed p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all min-h-[140px]",
        dragging
          ? "border-[#F57C28] bg-[#F57C28]/5"
          : "border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] hover:border-[#F57C28]/50 hover:bg-[#F57C28]/[0.03]"
      )}
    >
      <input
        ref={ref}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
      />
      <svg className="w-6 h-6 text-[#F57C28]/50 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125C3.504 4.5 3 5.004 3 5.625v12.75c0 .621.504 1.125 1.125 1.125z" />
      </svg>
      <p className="text-xs font-semibold text-gray-500 dark:text-white/40 mb-1">{label}</p>
      {file ? (
        <p className="text-sm font-semibold text-gray-800 dark:text-white truncate max-w-full px-2">{file.name}</p>
      ) : (
        <p className="text-xs text-gray-400 dark:text-white/25">Excel dosyası yükleyin</p>
      )}
    </div>
  );
}

export default function ExcelComparator() {
  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function compare() {
    if (!file1 || !file2) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const fd = new FormData();
      fd.append("file1", file1);
      fd.append("file2", file2);
      const res = await fetch("/api/ai/compare-excel", { method: "POST", body: fd });
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

  return (
    <div className="space-y-5">
      {/* File upload row */}
      <div className="grid grid-cols-2 gap-4">
        <FileDropZone label="1. Dosya (Eski)" file={file1} onFile={(f) => { setFile1(f); setResult(null); setError(null); }} />
        <FileDropZone label="2. Dosya (Yeni)" file={file2} onFile={(f) => { setFile2(f); setResult(null); setError(null); }} />
      </div>

      {/* Compare button */}
      {file1 && file2 && !loading && (
        <button
          onClick={compare}
          className="w-full py-3 rounded-xl bg-[#F57C28] hover:bg-[#e06e20] text-white font-semibold text-sm transition-colors"
        >
          Karşılaştır
        </button>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center gap-3 py-6">
          <svg className="w-8 h-8 text-[#F57C28] animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4l-3 3-3-3h4z" />
          </svg>
          <p className="text-sm text-gray-500 dark:text-white/40">Dosyalar karşılaştırılıyor...</p>
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
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Değiştirilen", value: result.ozet.degisen_satir, color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-50 dark:bg-yellow-500/10" },
              { label: "Eklenen", value: result.ozet.eklenen_satir, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-500/10" },
              { label: "Silinen", value: result.ozet.silinen_satir, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-500/10" },
            ].map((s) => (
              <div key={s.label} className={clsx("rounded-xl p-4 text-center", s.bg)}>
                <p className={clsx("text-2xl font-bold", s.color)}>{s.value}</p>
                <p className="text-xs text-gray-500 dark:text-white/40 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Diff table */}
          {result.farklar.length > 0 ? (
            <div className="rounded-2xl border border-gray-200 dark:border-white/10 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 bg-gray-50 dark:bg-white/[0.04] border-b border-gray-200 dark:border-white/10">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-white">
                  Fark Raporu — {result.farklar.length} değişiklik
                </h3>
                <button
                  onClick={() => downloadReport(result, file1?.name ?? "Dosya1", file2?.name ?? "Dosya2")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Raporu İndir
                </button>
              </div>
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50 dark:bg-[#17172A]">
                    <tr className="border-b border-gray-200 dark:border-white/10">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-white/40 uppercase tracking-wider">Satır</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-white/40 uppercase tracking-wider">Alan</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-white/40 uppercase tracking-wider">Eski Değer</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-white/40 uppercase tracking-wider">Yeni Değer</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-white/40 uppercase tracking-wider">Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.farklar.map((f, i) => {
                      const cfg = tipConfig[f.tip] ?? tipConfig.degistirildi;
                      return (
                        <tr key={i} className={clsx("border-b border-gray-50 dark:border-white/5 last:border-0", cfg.bg)}>
                          <td className="px-4 py-2.5 text-gray-600 dark:text-white/50 font-mono text-xs">{f.satir}</td>
                          <td className="px-4 py-2.5 text-gray-800 dark:text-white/80">{f.alan ?? "—"}</td>
                          <td className="px-4 py-2.5 text-gray-500 dark:text-white/40 line-through">{f.eski_deger ?? "—"}</td>
                          <td className="px-4 py-2.5 text-gray-900 dark:text-white font-medium">{f.yeni_deger ?? "—"}</td>
                          <td className="px-4 py-2.5">
                            <span className={clsx("inline-block px-2 py-0.5 rounded-full text-xs font-semibold", cfg.badge)}>
                              {cfg.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 p-6 text-center">
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">İki dosya arasında fark bulunamadı</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
