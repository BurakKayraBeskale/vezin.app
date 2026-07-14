"use client";

import { useRef, useState } from "react";
import clsx from "clsx";

// ── Types ──────────────────────────────────────────────────────────────────

interface VeriSatiri { alan: string; deger: string; birim?: string; }
interface Mukellef { unvan?: string; vergi_kimlik_no?: string; vergi_dairesi?: string; [key: string]: any; }
interface BeyannameResult {
  belge_turu: string;
  mukellef?: Mukellef | string;
  vergi_no?: string;
  donem?: string;
  veriler: VeriSatiri[];
  ozet?: string;
}

type Tab = "tekli" | "tam-tasdik" | "capraz-kontrol" | "kdv-iade";

// ── KDV İade types ─────────────────────────────────────────────────────────

interface KdvInvoiceLine {
  cins: string; miktar: number; birim: string;
  kdvHaricTutar: number; kdvOrani: number; kdvTutari: number;
}
interface KdvInvoice {
  id: string; seri: string; siraNo: string;
  tarihIso: string; tarihFmt: string; donemi: string;
  saticiUnvan: string; saticiVergiNo: string;
  kdvHaricTutar: number; kdvTutari: number; kdvOrani: number;
  satirlar: KdvInvoiceLine[]; sourceFile: string;
}
interface KdvExcluded {
  id: string; tarihFmt: string; saticiUnvan: string; neden: string; sourceFile: string;
}
interface KdvParseResult {
  invoices: KdvInvoice[];
  excluded: KdvExcluded[];
  stats: { invoiceCount: number; excludedCount: number; totalKdvHaric: number; totalKdv: number };
}

// ── Çapraz Kontrol types ───────────────────────────────────────────────────

interface CheckItem {
  name: string;
  detail: string;
  value1?: number;
  value1Label?: string;
  value2?: number;
  value2Label?: string;
  diff?: number;
  diffPercent?: number;
  status: "UYGUN" | "UYARI" | "BİLGİ";
}

interface ExtractionItem {
  dosya_adi: string;
  belge_turu: string;
  mukellef?: any;
  donem?: string;
  veriler: any[];
}

interface KontrolResult {
  extractions: ExtractionItem[];
  checks: CheckItem[];
}

// ── Utilities ──────────────────────────────────────────────────────────────

function safeStr(val: any): string {
  if (val == null) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (typeof val === "object") {
    const s = val.metin ?? val.text ?? val.unvan ?? val.value ?? val.deger ?? val.label ?? val.ad;
    if (s != null) return safeStr(s);
    return JSON.stringify(val);
  }
  return String(val);
}

function getMukellefStr(m: Mukellef | string | undefined) {
  if (!m) return { unvan: "", vergiNo: "", vergiDairesi: "" };
  if (typeof m === "string") return { unvan: m, vergiNo: "", vergiDairesi: "" };
  return {
    unvan:        safeStr(m.unvan),
    vergiNo:      safeStr(m.vergi_kimlik_no),
    vergiDairesi: safeStr(m.vergi_dairesi),
  };
}

async function downloadExcel(result: BeyannameResult) {
  const res = await fetch("/api/ai/beyanname/excel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ result }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error ?? "Excel oluşturulamadı");
  }
  const blob = await res.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `${safeStr(result.belge_turu) || "beyanname"}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Icons ──────────────────────────────────────────────────────────────────

function IconUpload() {
  return (
    <svg className="w-6 h-6 text-[#F57C28]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function IconDownload({ className }: { className?: string }) {
  return (
    <svg className={className ?? "w-3.5 h-3.5"} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  );
}

function IconX() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function Spinner({ size = 8 }: { size?: number }) {
  return (
    <svg
      className={`w-${size} h-${size} text-[#F57C28] animate-spin`}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4l-3 3-3-3h4z" />
    </svg>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
      <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
      <p className="text-sm text-red-700 dark:text-red-400">{message}</p>
    </div>
  );
}

// ── Drop zone (reusable) ───────────────────────────────────────────────────

function DropZone({
  onFiles,
  multiple = false,
  label,
  hint,
}: {
  onFiles: (files: File[]) => void;
  multiple?: boolean;
  label?: string;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handle(files: FileList | null) {
    if (!files) return;
    onFiles(Array.from(files));
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); handle(e.dataTransfer.files); }}
      onClick={() => inputRef.current?.click()}
      className={clsx(
        "rounded-2xl border-2 border-dashed p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all",
        dragging
          ? "border-[#F57C28] bg-[#F57C28]/5"
          : "border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] hover:border-[#F57C28]/50 hover:bg-[#F57C28]/[0.03]",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        multiple={multiple}
        className="hidden"
        onChange={(e) => { handle(e.target.files); e.target.value = ""; }}
      />
      <div className="w-12 h-12 rounded-xl bg-[#F57C28]/10 flex items-center justify-center mb-3">
        <IconUpload />
      </div>
      <p className="text-sm font-medium text-gray-600 dark:text-white/60">
        {label ?? "PDF sürükleyin ya da tıklayın"}
      </p>
      <p className="text-xs text-gray-400 dark:text-white/30 mt-1">
        {hint ?? "PDF · Maks 10MB"}
      </p>
    </div>
  );
}

// ── Tekli Dönüştürme ───────────────────────────────────────────────────────

function TekliPanel() {
  const [file, setFile]     = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult]  = useState<BeyannameResult | null>(null);
  const [error, setError]    = useState<string | null>(null);

  function handleFile(f: File) { setFile(f); setResult(null); setError(null); }

  async function convert() {
    if (!file) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res  = await fetch("/api/ai/beyanname", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Bilinmeyen hata"); return; }
      setResult(json.data);
    } catch { setError("Sunucuya bağlanılamadı."); }
    finally   { setLoading(false); }
  }

  return (
    <div className="space-y-6">
      {/* Drop zone shows selected file or picker */}
      {file ? (
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.02]">
          <div className="w-9 h-9 rounded-lg bg-[#F57C28]/10 flex items-center justify-center flex-shrink-0">
            <IconUpload />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800 dark:text-white truncate">{file.name}</p>
            <p className="text-xs text-gray-400 dark:text-white/40">{(file.size / 1024).toFixed(0)} KB</p>
          </div>
          <button
            onClick={() => { setFile(null); setResult(null); setError(null); }}
            className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
          >
            <IconX />
          </button>
        </div>
      ) : (
        <DropZone onFiles={(fs) => handleFile(fs[0])} />
      )}

      {file && !loading && !result && (
        <button
          onClick={convert}
          className="w-full py-3 rounded-xl bg-[#F57C28] hover:bg-[#e06e20] text-white font-semibold text-sm transition-colors"
        >
          Dönüştür
        </button>
      )}

      {loading && (
        <div className="flex flex-col items-center gap-3 py-8">
          <Spinner />
          <p className="text-sm text-gray-500 dark:text-white/40">Belge analiz ediliyor...</p>
        </div>
      )}

      {error && <ErrorBox message={error} />}

      {result && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 dark:border-white/10 p-5 bg-white dark:bg-white/[0.02] space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-[#F57C28]/10 text-[#F57C28] uppercase tracking-wide">
                  {safeStr(result.belge_turu)}
                </span>
                {(() => {
                  const mk = getMukellefStr(result.mukellef);
                  const vergiNo = mk.vergiNo || result.vergi_no || "";
                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-1 mt-2">
                      {mk.unvan && (
                        <div>
                          <p className="text-[10px] font-semibold text-gray-400 dark:text-white/30 uppercase tracking-wider">Ünvan</p>
                          <p className="text-sm font-semibold text-gray-800 dark:text-white">{safeStr(mk.unvan)}</p>
                        </div>
                      )}
                      {vergiNo && (
                        <div>
                          <p className="text-[10px] font-semibold text-gray-400 dark:text-white/30 uppercase tracking-wider">Vergi No</p>
                          <p className="text-sm font-semibold text-gray-800 dark:text-white font-mono">{safeStr(vergiNo)}</p>
                        </div>
                      )}
                      {mk.vergiDairesi && (
                        <div>
                          <p className="text-[10px] font-semibold text-gray-400 dark:text-white/30 uppercase tracking-wider">Vergi Dairesi</p>
                          <p className="text-sm font-semibold text-gray-800 dark:text-white">{safeStr(mk.vergiDairesi)}</p>
                        </div>
                      )}
                      {result.donem && (
                        <div>
                          <p className="text-[10px] font-semibold text-gray-400 dark:text-white/30 uppercase tracking-wider">Dönem</p>
                          <p className="text-sm font-semibold text-gray-800 dark:text-white">{safeStr(result.donem)}</p>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
              <button
                onClick={() => downloadExcel(result)}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold transition-colors"
              >
                <IconDownload />
                Excel İndir
              </button>
            </div>
            {result.ozet && (
              <p className="text-xs text-gray-500 dark:text-white/40 leading-relaxed border-t border-gray-100 dark:border-white/5 pt-3">
                {safeStr(result.ozet)}
              </p>
            )}
          </div>

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
                      const alanStr  = safeStr(v.alan);
                      const degerStr = safeStr(v.deger);
                      const birimStr = safeStr(v.birim);
                      const isCurrency = birimStr === "TRY";
                      const numVal = parseFloat(degerStr.replace(/[^0-9.,-]/g, "").replace(",", "."));
                      const displayVal = isCurrency && !isNaN(numVal)
                        ? numVal.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        : degerStr;
                      return (
                        <tr key={i} className={clsx("border-b border-gray-50 dark:border-white/5 last:border-0", i % 2 === 1 ? "bg-gray-50/50 dark:bg-white/[0.02]" : "")}>
                          <td className="px-5 py-2.5 text-gray-600 dark:text-white/60">{alanStr}</td>
                          <td className={clsx("px-5 py-2.5 text-right font-semibold tabular-nums", isCurrency ? "text-gray-900 dark:text-white" : "text-gray-700 dark:text-white/80")}>
                            {isCurrency && "₺ "}{displayVal}
                          </td>
                          <td className="px-5 py-2.5 text-xs text-gray-400 dark:text-white/30">{birimStr || "—"}</td>
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

// ── Tam Tasdik Özeti ───────────────────────────────────────────────────────

function TamTasdikPanel() {
  const [files, setFiles]     = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [done, setDone]       = useState(false);

  function addFiles(incoming: File[]) {
    const pdfs = incoming.filter(f => f.type === "application/pdf");
    setFiles(prev => {
      const existing = new Set(prev.map(f => f.name + f.size));
      const fresh = pdfs.filter(f => !existing.has(f.name + f.size));
      return [...prev, ...fresh];
    });
    setError(null);
    setDone(false);
  }

  function removeFile(idx: number) {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  }

  async function generate() {
    if (files.length === 0) return;
    setLoading(true); setError(null); setDone(false);
    try {
      const fd = new FormData();
      for (const f of files) fd.append("files[]", f);
      const res = await fetch("/api/ai/tam-tasdik", { method: "POST", body: fd });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? "Rapor oluşturulamadı");
        return;
      }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `tam-tasdik-ozet-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      setDone(true);
    } catch { setError("Sunucuya bağlanılamadı."); }
    finally   { setLoading(false); }
  }

  return (
    <div className="space-y-5">
      {/* Açıklama */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-[#F57C28]/5 border border-[#F57C28]/20">
        <svg className="w-5 h-5 text-[#F57C28] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
        </svg>
        <p className="text-xs text-gray-600 dark:text-white/60 leading-relaxed">
          Aynı mükellefe ait farklı dönem / tür beyannamelerini yükleyin. Yapay zeka her birinden veri çıkarır,
          kod tarafında YMM Tam Tasdik şablonunu (4 sayfalı Excel) otomatik oluşturur.
        </p>
      </div>

      {/* Drop zone */}
      <DropZone
        onFiles={addFiles}
        multiple
        label="Birden fazla PDF sürükleyin ya da tıklayın"
        hint="PDF · Maks 10MB · Çoklu seçim desteklenir"
      />

      {/* Dosya listesi */}
      {files.length > 0 && (
        <div className="rounded-2xl border border-gray-200 dark:border-white/10 overflow-hidden">
          <div className="px-4 py-2.5 bg-gray-50 dark:bg-white/[0.04] border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-white/40 uppercase tracking-wider">
              {files.length} Dosya
            </span>
            <button
              onClick={() => { setFiles([]); setDone(false); setError(null); }}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-white/60 transition-colors"
            >
              Tümünü temizle
            </button>
          </div>
          <ul className="divide-y divide-gray-100 dark:divide-white/5">
            {files.map((f, i) => (
              <li key={i} className="flex items-center gap-3 px-4 py-2.5">
                <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                </svg>
                <span className="text-sm text-gray-700 dark:text-white/70 flex-1 truncate">{f.name}</span>
                <span className="text-xs text-gray-400 dark:text-white/30 flex-shrink-0">
                  {(f.size / 1024).toFixed(0)} KB
                </span>
                <button
                  onClick={() => removeFile(i)}
                  disabled={loading}
                  className="flex-shrink-0 p-1 rounded text-gray-300 hover:text-gray-500 dark:hover:text-white/60 transition-colors disabled:opacity-40"
                >
                  <IconX />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <ErrorBox message={error} />}

      {done && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
          <svg className="w-5 h-5 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
            Tam Tasdik Özet Raporu indirildi.
          </p>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center gap-3 py-8">
          <Spinner />
          <p className="text-sm text-gray-500 dark:text-white/40">
            Beyannameler analiz ediliyor, rapor oluşturuluyor…
          </p>
          <p className="text-xs text-gray-400 dark:text-white/30">
            {files.length} dosya · her dosya için 1 AI çağrısı
          </p>
        </div>
      ) : (
        files.length > 0 && (
          <button
            onClick={generate}
            className="w-full py-3 rounded-xl bg-[#F57C28] hover:bg-[#e06e20] text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
          >
            <IconDownload className="w-4 h-4" />
            Özet Raporu Oluştur
          </button>
        )
      )}
    </div>
  );
}

// ── Çapraz Kontrol ────────────────────────────────────────────────────────

function statusMeta(status: CheckItem["status"]) {
  if (status === "UYARI") return { bg: "bg-red-50 dark:bg-red-500/10", border: "border-red-200 dark:border-red-500/20", text: "text-red-700 dark:text-red-400", badge: "bg-red-500" };
  if (status === "UYGUN") return { bg: "bg-emerald-50 dark:bg-emerald-500/10", border: "border-emerald-200 dark:border-emerald-500/20", text: "text-emerald-700 dark:text-emerald-400", badge: "bg-emerald-500" };
  return { bg: "bg-amber-50 dark:bg-amber-500/10", border: "border-amber-200 dark:border-amber-500/20", text: "text-amber-700 dark:text-amber-400", badge: "bg-amber-400" };
}

function CaprazKontrolPanel() {
  const [files, setFiles]         = useState<File[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [result, setResult]       = useState<KontrolResult | null>(null);
  const [xlLoading, setXlLoading] = useState(false);

  function addFiles(incoming: File[]) {
    const pdfs = incoming.filter(f => f.type === "application/pdf");
    setFiles(prev => {
      const existing = new Set(prev.map(f => f.name + f.size));
      const fresh = pdfs.filter(f => !existing.has(f.name + f.size));
      return [...prev, ...fresh];
    });
    setError(null);
    setResult(null);
  }

  function removeFile(idx: number) {
    setFiles(prev => prev.filter((_, i) => i !== idx));
    setResult(null);
  }

  async function runKontrol() {
    if (files.length === 0) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const fd = new FormData();
      for (const f of files) fd.append("files[]", f);
      const res  = await fetch("/api/ai/capraz-kontrol", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "İşlem başarısız"); return; }
      setResult(json);
    } catch { setError("Sunucuya bağlanılamadı."); }
    finally   { setLoading(false); }
  }

  async function downloadExcel() {
    if (!result) return;
    setXlLoading(true);
    try {
      const res = await fetch("/api/ai/capraz-kontrol/excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? "Excel oluşturulamadı");
        return;
      }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `capraz-kontrol-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { setError("Excel indirilemedi."); }
    finally   { setXlLoading(false); }
  }

  const uyariCount = result?.checks.filter(c => c.status === "UYARI").length ?? 0;
  const uygunCount = result?.checks.filter(c => c.status === "UYGUN").length ?? 0;
  const bilgiCount = result?.checks.filter(c => c.status === "BİLGİ").length  ?? 0;

  return (
    <div className="space-y-5">
      {/* Açıklama */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-[#F57C28]/5 border border-[#F57C28]/20">
        <svg className="w-5 h-5 text-[#F57C28] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
        </svg>
        <p className="text-xs text-gray-600 dark:text-white/60 leading-relaxed">
          Aynı mükellefin aynı döneme ait farklı beyanname türlerini (KDV, Muhtasar, SGK, Geçici Vergi…) yükleyin.
          Sistem tutarlılık kontrolü yapar; sonuçları Excel olarak indirin.
        </p>
      </div>

      {/* Drop zone */}
      {!result && (
        <DropZone
          onFiles={addFiles}
          multiple
          label="Birden fazla PDF sürükleyin ya da tıklayın"
          hint="PDF · Maks 10MB · KDV + Muhtasar + SGK + Geçici Vergi vb."
        />
      )}

      {/* Dosya listesi */}
      {files.length > 0 && !result && (
        <div className="rounded-2xl border border-gray-200 dark:border-white/10 overflow-hidden">
          <div className="px-4 py-2.5 bg-gray-50 dark:bg-white/[0.04] border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-white/40 uppercase tracking-wider">
              {files.length} Dosya
            </span>
            <button
              onClick={() => { setFiles([]); setResult(null); setError(null); }}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-white/60 transition-colors"
            >
              Tümünü temizle
            </button>
          </div>
          <ul className="divide-y divide-gray-100 dark:divide-white/5">
            {files.map((f, i) => (
              <li key={i} className="flex items-center gap-3 px-4 py-2.5">
                <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                </svg>
                <span className="text-sm text-gray-700 dark:text-white/70 flex-1 truncate">{f.name}</span>
                <span className="text-xs text-gray-400 dark:text-white/30 flex-shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                <button
                  onClick={() => removeFile(i)}
                  disabled={loading}
                  className="flex-shrink-0 p-1 rounded text-gray-300 hover:text-gray-500 dark:hover:text-white/60 transition-colors disabled:opacity-40"
                >
                  <IconX />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <ErrorBox message={error} />}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center gap-3 py-8">
          <Spinner />
          <p className="text-sm text-gray-500 dark:text-white/40">
            Beyannameler analiz ediliyor, kontroller çalışıyor…
          </p>
          <p className="text-xs text-gray-400 dark:text-white/30">
            {files.length} dosya · her dosya için 1 AI çağrısı
          </p>
        </div>
      )}

      {/* Kontrol Et butonu */}
      {!loading && !result && files.length > 0 && (
        <button
          onClick={runKontrol}
          className="w-full py-3 rounded-xl bg-[#F57C28] hover:bg-[#e06e20] text-white font-semibold text-sm transition-colors"
        >
          Kontrol Et
        </button>
      )}

      {/* Sonuçlar */}
      {result && (
        <div className="space-y-4">
          {/* Özet sayaçlar */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Uyarı",      count: uyariCount, cls: "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20" },
              { label: "Uygun",      count: uygunCount, cls: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20" },
              { label: "Bilgi Notu", count: bilgiCount, cls: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20" },
            ].map(({ label, count, cls }) => (
              <div key={label} className={clsx("rounded-xl border p-3 text-center", cls)}>
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-xs font-semibold mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Yüklenen beyannameler */}
          <div className="rounded-2xl border border-gray-200 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2.5 bg-gray-50 dark:bg-white/[0.04] border-b border-gray-200 dark:border-white/10">
              <span className="text-xs font-semibold text-gray-500 dark:text-white/40 uppercase tracking-wider">
                Tespit Edilen Beyannameler — {result.extractions.length}
              </span>
            </div>
            <ul className="divide-y divide-gray-100 dark:divide-white/5">
              {result.extractions.map((ext, i) => (
                <li key={i} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F57C28]/10 text-[#F57C28] uppercase tracking-wide flex-shrink-0">
                    {safeStr(ext.belge_turu) || "?"}
                  </span>
                  <span className="text-sm text-gray-700 dark:text-white/70 flex-1 truncate">{safeStr(ext.donem) || "—"}</span>
                  <span className="text-xs text-gray-400 dark:text-white/30 truncate flex-shrink-0">{ext.dosya_adi}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Kontrol sonuçları */}
          <div className="space-y-2">
            {result.checks.map((check, i) => {
              const m = statusMeta(check.status);
              return (
                <div key={i} className={clsx("rounded-xl border p-3.5", m.bg, m.border)}>
                  <div className="flex items-start gap-2.5">
                    <span className={clsx("mt-0.5 flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold text-white", m.badge)}>
                      {check.status}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={clsx("text-sm font-semibold", m.text)}>{check.name}</p>
                      <p className={clsx("text-xs mt-0.5 leading-relaxed", m.text, "opacity-80")}>{check.detail}</p>
                      {(check.value1 != null || check.value2 != null) && (
                        <div className="mt-2 flex flex-wrap gap-3">
                          {check.value1 != null && (
                            <div>
                              <p className="text-[10px] font-semibold text-gray-400 dark:text-white/30 uppercase tracking-wider">{check.value1Label ?? "Değer 1"}</p>
                              <p className={clsx("text-xs font-bold tabular-nums", m.text)}>
                                {check.value1.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺
                              </p>
                            </div>
                          )}
                          {check.value2 != null && (
                            <div>
                              <p className="text-[10px] font-semibold text-gray-400 dark:text-white/30 uppercase tracking-wider">{check.value2Label ?? "Değer 2"}</p>
                              <p className={clsx("text-xs font-bold tabular-nums", m.text)}>
                                {check.value2.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺
                              </p>
                            </div>
                          )}
                          {check.diffPercent != null && (
                            <div>
                              <p className="text-[10px] font-semibold text-gray-400 dark:text-white/30 uppercase tracking-wider">Fark</p>
                              <p className={clsx("text-xs font-bold", m.text)}>%{check.diffPercent.toFixed(1)}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Aksiyon butonları */}
          <div className="flex gap-3">
            <button
              onClick={() => { setResult(null); setFiles([]); setError(null); }}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/60 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
            >
              Yeni Kontrol
            </button>
            <button
              onClick={downloadExcel}
              disabled={xlLoading}
              className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {xlLoading ? <Spinner size={4} /> : <IconDownload className="w-4 h-4" />}
              Excel Raporu İndir
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── KDV İade Listeleri ────────────────────────────────────────────────────

function KdvIadePanel() {
  const xmlInputRef                   = useRef<HTMLInputElement>(null);
  const [files, setFiles]             = useState<File[]>([]);
  const [dragging, setDragging]       = useState(false);
  const [merge, setMerge]             = useState(true);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [result, setResult]           = useState<KdvParseResult | null>(null);
  const [xlLoading, setXlLoading]     = useState(false);
  const [showExcluded, setShowExcluded] = useState(false);

  function addFiles(incoming: File[]) {
    const valid = incoming.filter(f => {
      const lc = f.name.toLowerCase();
      return lc.endsWith(".xml") || lc.endsWith(".zip");
    });
    setFiles(prev => {
      const existing = new Set(prev.map(f => f.name + f.size));
      return [...prev, ...valid.filter(f => !existing.has(f.name + f.size))];
    });
    setError(null);
    setResult(null);
  }

  function removeFile(idx: number) {
    setFiles(prev => prev.filter((_, i) => i !== idx));
    setResult(null);
  }

  async function parse() {
    if (files.length === 0) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const fd = new FormData();
      for (const f of files) fd.append("files[]", f);
      const res  = await fetch("/api/kdv-iade/indirilecek-liste", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "İşlem başarısız"); return; }
      setResult(json);
    } catch { setError("Sunucuya bağlanılamadı."); }
    finally   { setLoading(false); }
  }

  async function downloadExcel() {
    if (!result) return;
    setXlLoading(true);
    try {
      const res = await fetch("/api/kdv-iade/indirilecek-liste/excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoices: result.invoices, merge }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? "Excel oluşturulamadı");
        return;
      }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `indirilecek-kdv-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { setError("Excel indirilemedi."); }
    finally   { setXlLoading(false); }
  }

  const fmtTRY = (n: number) =>
    n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₺";

  return (
    <div className="space-y-5">
      {/* Açıklama */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-[#F57C28]/5 border border-[#F57C28]/20">
        <svg className="w-5 h-5 text-[#F57C28] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
        </svg>
        <p className="text-xs text-gray-600 dark:text-white/60 leading-relaxed">
          e-Fatura XML dosyalarından GİB formatında <strong>İndirilecek KDV Listesi</strong> oluşturur.
          AI kullanılmaz — tamamen kod tarafında parse edilir.
          ZIP içindeki XML'ler otomatik açılır. İade, KDV=0 ve ihraç kayıtlı faturalar otomatik hariç tutulur.
        </p>
      </div>

      {/* Upload area */}
      {!result && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault(); setDragging(false);
            addFiles(Array.from(e.dataTransfer.files));
          }}
          onClick={() => xmlInputRef.current?.click()}
          className={clsx(
            "rounded-2xl border-2 border-dashed p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all",
            dragging
              ? "border-[#F57C28] bg-[#F57C28]/5"
              : "border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] hover:border-[#F57C28]/50 hover:bg-[#F57C28]/[0.03]"
          )}
        >
          <input
            ref={xmlInputRef}
            type="file"
            accept=".xml,.zip"
            multiple
            className="hidden"
            onChange={(e) => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }}
          />
          <div className="w-12 h-12 rounded-xl bg-[#F57C28]/10 flex items-center justify-center mb-3">
            <svg className="w-6 h-6 text-[#F57C28]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-600 dark:text-white/60">
            XML veya ZIP sürükleyin ya da tıklayın
          </p>
          <p className="text-xs text-gray-400 dark:text-white/30 mt-1">
            .xml · .zip (içindeki XML'ler otomatik açılır) · Çoklu seçim desteklenir
          </p>
        </div>
      )}

      {/* Dosya listesi */}
      {files.length > 0 && !result && (
        <div className="rounded-2xl border border-gray-200 dark:border-white/10 overflow-hidden">
          <div className="px-4 py-2.5 bg-gray-50 dark:bg-white/[0.04] border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-white/40 uppercase tracking-wider">
              {files.length} Dosya Seçildi
            </span>
            <button
              onClick={() => { setFiles([]); setError(null); }}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-white/60 transition-colors"
            >
              Tümünü temizle
            </button>
          </div>
          <ul className="divide-y divide-gray-100 dark:divide-white/5 max-h-48 overflow-y-auto">
            {files.map((f, i) => (
              <li key={i} className="flex items-center gap-3 px-4 py-2">
                <span className={clsx(
                  "text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 uppercase",
                  f.name.toLowerCase().endsWith(".zip")
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400"
                    : "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400"
                )}>
                  {f.name.toLowerCase().endsWith(".zip") ? "ZIP" : "XML"}
                </span>
                <span className="text-sm text-gray-700 dark:text-white/70 flex-1 truncate text-xs">{f.name}</span>
                <span className="text-xs text-gray-400 dark:text-white/30 flex-shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                <button
                  onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                  className="flex-shrink-0 p-1 rounded text-gray-300 hover:text-gray-500 transition-colors"
                >
                  <IconX />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Seçenekler */}
      {files.length > 0 && !result && (
        <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.02]">
          <div>
            <p className="text-sm font-semibold text-gray-800 dark:text-white">Satır Görünümü</p>
            <p className="text-xs text-gray-400 dark:text-white/30 mt-0.5">
              {merge ? "Aynı faturanın kalemleri tek satırda birleştirilir" : "Her kalem ayrı satır olarak listelenir"}
            </p>
          </div>
          <button
            onClick={() => setMerge(p => !p)}
            className={clsx(
              "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out",
              merge ? "bg-[#F57C28]" : "bg-gray-200 dark:bg-white/10"
            )}
          >
            <span className={clsx(
              "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform duration-200 ease-in-out",
              merge ? "translate-x-5" : "translate-x-0"
            )} />
          </button>
        </div>
      )}

      {error && <ErrorBox message={error} />}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center gap-3 py-8">
          <Spinner />
          <p className="text-sm text-gray-500 dark:text-white/40">XML dosyaları ayrıştırılıyor…</p>
          <p className="text-xs text-gray-400 dark:text-white/30">AI çağrısı yok · tamamen kod taraflı</p>
        </div>
      )}

      {/* Liste Oluştur butonu */}
      {!loading && !result && files.length > 0 && (
        <button
          onClick={parse}
          className="w-full py-3 rounded-xl bg-[#F57C28] hover:bg-[#e06e20] text-white font-semibold text-sm transition-colors"
        >
          Liste Oluştur
        </button>
      )}

      {/* Sonuçlar */}
      {result && (
        <div className="space-y-4">
          {/* Özet kartları */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-gray-200 dark:border-white/10 p-4 bg-white dark:bg-white/[0.02]">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{result.stats.invoiceCount}</p>
              <p className="text-xs text-gray-500 dark:text-white/40 mt-0.5">Fatura dahil edildi</p>
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-white/10 p-4 bg-white dark:bg-white/[0.02]">
              <p className="text-lg font-bold text-[#F57C28] tabular-nums">{fmtTRY(result.stats.totalKdv)}</p>
              <p className="text-xs text-gray-500 dark:text-white/40 mt-0.5">Toplam İndirilecek KDV</p>
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-white/10 p-4 bg-white dark:bg-white/[0.02]">
              <p className="text-lg font-bold text-gray-700 dark:text-white/80 tabular-nums">{fmtTRY(result.stats.totalKdvHaric)}</p>
              <p className="text-xs text-gray-500 dark:text-white/40 mt-0.5">KDV Hariç Tutar</p>
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-white/10 p-4 bg-white dark:bg-white/[0.02]">
              <p className="text-2xl font-bold text-amber-500">{result.stats.excludedCount}</p>
              <p className="text-xs text-gray-500 dark:text-white/40 mt-0.5">Fatura hariç tutuldu</p>
            </div>
          </div>

          {/* Hariç tutulanlar */}
          {result.excluded.length > 0 && (
            <div className="rounded-2xl border border-amber-200 dark:border-amber-500/20 overflow-hidden">
              <button
                onClick={() => setShowExcluded(p => !p)}
                className="w-full px-4 py-2.5 flex items-center justify-between bg-amber-50 dark:bg-amber-500/10 text-left"
              >
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                  Hariç Tutulan Faturalar — {result.excluded.length}
                </span>
                <svg
                  className={clsx("w-4 h-4 text-amber-500 transition-transform", showExcluded && "rotate-180")}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showExcluded && (
                <ul className="divide-y divide-amber-100 dark:divide-amber-500/10 max-h-48 overflow-y-auto">
                  {result.excluded.map((ex, i) => (
                    <li key={i} className="px-4 py-2 flex items-center gap-3 bg-white dark:bg-white/[0.01]">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 flex-shrink-0">
                        {ex.neden}
                      </span>
                      <span className="text-xs text-gray-600 dark:text-white/60 flex-1 truncate">{ex.saticiUnvan || ex.id}</span>
                      <span className="text-xs text-gray-400 dark:text-white/30 flex-shrink-0">{ex.tarihFmt}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Satır görünümü toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.02]">
            <p className="text-xs text-gray-600 dark:text-white/60">
              <span className="font-semibold">Excel görünümü:</span>{" "}
              {merge ? "Fatura başına 1 satır (birleştirilmiş)" : "Kalem başına 1 satır"}
            </p>
            <button
              onClick={() => setMerge(p => !p)}
              className={clsx(
                "relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                merge ? "bg-[#F57C28]" : "bg-gray-200 dark:bg-white/10"
              )}
            >
              <span className={clsx(
                "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
                merge ? "translate-x-4" : "translate-x-0"
              )} />
            </button>
          </div>

          {/* Aksiyon butonları */}
          <div className="flex gap-3">
            <button
              onClick={() => { setResult(null); setFiles([]); setError(null); setShowExcluded(false); }}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/60 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
            >
              Yeni Liste
            </button>
            <button
              onClick={downloadExcel}
              disabled={xlLoading || result.invoices.length === 0}
              className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {xlLoading ? <Spinner size={4} /> : <IconDownload className="w-4 h-4" />}
              GİB Formatında Excel İndir
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function BeyannameUploader() {
  const [tab, setTab] = useState<Tab>("tekli");

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-xl bg-gray-100 dark:bg-white/[0.06]">
        {(
          [
            { id: "tekli",          label: "Tekli Dönüştürme" },
            { id: "tam-tasdik",     label: "Tam Tasdik Özeti" },
            { id: "capraz-kontrol", label: "Çapraz Kontrol"   },
            { id: "kdv-iade",       label: "KDV İade Listesi" },
          ] as const
        ).map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={clsx(
              "flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all",
              tab === id
                ? "bg-white dark:bg-white/10 text-[#F57C28] shadow-sm"
                : "text-gray-500 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/60",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "tekli"          && <TekliPanel />}
      {tab === "tam-tasdik"     && <TamTasdikPanel />}
      {tab === "capraz-kontrol" && <CaprazKontrolPanel />}
      {tab === "kdv-iade"       && <KdvIadePanel />}
    </div>
  );
}
