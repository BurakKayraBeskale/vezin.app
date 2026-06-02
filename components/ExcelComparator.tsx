"use client";

import { useRef, useState } from "react";
import clsx from "clsx";

type Phase = "idle" | "processing" | "done" | "error";

export default function ExcelComparator() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile]     = useState<File | null>(null);
  const [phase, setPhase]   = useState<Phase>("idle");
  const [error, setError]   = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  async function processFile(f: File) {
    setFile(f);
    setPhase("processing");
    setError(null);

    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/ai/compare-excel", { method: "POST", body: fd });

      if (!res.ok) {
        const json = await res.json().catch(() => ({ error: "Sunucu hatası" }));
        throw new Error(json.error ?? `Sunucu hatası (HTTP ${res.status})`);
      }

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = f.name.replace(/\.[^.]+$/, "_karsilastirma.xlsx");
      a.click();
      URL.revokeObjectURL(url);
      setPhase("done");
    } catch (err: any) {
      setError(err.message ?? "Bilinmeyen hata");
      setPhase("error");
    }
  }

  function handleFile(f: File) {
    processFile(f);
  }

  function reset() {
    setFile(null);
    setPhase("idle");
    setError(null);
  }

  return (
    <div className="space-y-5">
      {/* Yükleme kutusu */}
      {(phase === "idle" || phase === "error") && (
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
            "rounded-2xl border-2 border-dashed p-12 flex flex-col items-center justify-center text-center cursor-pointer transition-all",
            dragging
              ? "border-[#F57C28] bg-[#F57C28]/5"
              : "border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] hover:border-[#F57C28]/50 hover:bg-[#F57C28]/[0.03]"
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />

          {/* İkon */}
          <div className="w-14 h-14 rounded-2xl bg-[#F57C28]/10 flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-[#F57C28]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125C3.504 4.5 3 5.004 3 5.625v12.75c0 .621.504 1.125 1.125 1.125z" />
            </svg>
          </div>

          <p className="text-sm font-semibold text-gray-700 dark:text-white/70 mb-2">
            İki sayfalı Excel dosyası yükleyin
          </p>

          {/* Sayfa açıklamaları */}
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20">
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">1. Sayfa</span>
              <span className="text-xs text-blue-500 dark:text-blue-300">Firma 1</span>
            </div>
            <svg className="w-3.5 h-3.5 text-gray-300 dark:text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20">
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">2. Sayfa</span>
              <span className="text-xs text-emerald-500 dark:text-emerald-300">Firma 2</span>
            </div>
          </div>

          <p className="text-xs text-gray-400 dark:text-white/25">
            Maks 10MB &nbsp;·&nbsp; Seçince otomatik karşılaştırır
          </p>
        </div>
      )}

      {/* Hata */}
      {error && (
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
          <button
            onClick={reset}
            className="w-full py-2.5 rounded-xl border border-gray-200 dark:border-white/10 text-sm font-medium text-gray-600 dark:text-white/50 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
          >
            Tekrar Dene
          </button>
        </div>
      )}

      {/* İşleniyor */}
      {phase === "processing" && (
        <div className="rounded-2xl border border-gray-200 dark:border-white/10 p-12 flex flex-col items-center gap-5">
          <svg className="w-10 h-10 text-[#F57C28] animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor"
              d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4l-3 3-3-3h4z" />
          </svg>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-700 dark:text-white/70">Karşılaştırılıyor...</p>
            {file && (
              <p className="text-xs text-gray-400 dark:text-white/30 mt-1">{file.name}</p>
            )}
          </div>
        </div>
      )}

      {/* Tamamlandı */}
      {phase === "done" && (
        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 p-10 flex flex-col items-center gap-5 text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
            <svg className="w-7 h-7 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              Karşılaştırma tamamlandı!
            </p>
            <p className="text-xs text-gray-500 dark:text-white/40 mt-1.5">
              Excel dosyası indirildi — 3. sayfada <span className="font-semibold">KARŞILAŞTIRMA</span> raporu mevcut
            </p>
          </div>

          {/* Renk açıklaması */}
          <div className="grid grid-cols-2 gap-2 w-full max-w-xs text-xs">
            {[
              { color: "bg-green-200",  label: "Eşleşiyor" },
              { color: "bg-yellow-200", label: "KDV Farkı Var" },
              { color: "bg-pink-200",   label: "Sadece Firma 1" },
              { color: "bg-green-100",  label: "Sadece Firma 2" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <span className={clsx("w-3 h-3 rounded-sm flex-shrink-0", item.color)} />
                <span className="text-gray-600 dark:text-white/50">{item.label}</span>
              </div>
            ))}
          </div>

          <button
            onClick={reset}
            className="px-5 py-2 rounded-xl border border-gray-200 dark:border-white/10 text-sm font-medium text-gray-600 dark:text-white/50 hover:bg-white dark:hover:bg-white/5 transition-colors"
          >
            Yeni Karşılaştırma
          </button>
        </div>
      )}
    </div>
  );
}
