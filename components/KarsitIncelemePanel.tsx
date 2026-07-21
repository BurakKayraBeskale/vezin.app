"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import clsx from "clsx";

// ── Types ──────────────────────────────────────────────────────────────────

export interface KarsitFatura {
  id: string;
  seri: string;
  siraNo: string;
  tarihFmt: string;
  tarihIso: string;
  unvan: string;
  vergiNo: string;
  cins: string;
  miktar: string;
  kdvHaricTutar: number;
  kdvOrani: number;
  kdvTutari: number;
  toplam: number;
  sourceFile: string;
}

interface TutanakKaydi {
  id: string;
  mukellefUnvan: string;
  mukellefVkn: string;
  mukellefVD: string;
  konu: string;
  donemBas: string;
  donemBit: string;
  durum: string;
  gonderimTarihi: string | null;
  ymmAdi: string;
  ymmSicilNo: string;
  ymmVergiNo: string;
  faturalar: string;
  notlar: string;
  olusturanId: string;
  createdAt: string;
  updatedAt: string;
}

type KISubTab = "hazirla" | "takip";
type InputMode = "xml" | "excel";

const DURUM_LABELS: Record<string, string> = {
  HAZIRLANDI:        "Hazırlandı",
  DIJITAL_VD_GIRILDI: "Dijital VD Girildi",
  MUKELLEF_CEVAPLADI: "Mükellef Cevapladı",
  ONAYLANDI:         "Onaylandı",
  PASIF_TALEP:       "Pasif Talep",
};

const DURUM_COLORS: Record<string, string> = {
  HAZIRLANDI:        "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
  DIJITAL_VD_GIRILDI: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  MUKELLEF_CEVAPLADI: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  ONAYLANDI:         "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  PASIF_TALEP:       "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

const ALL_DURUM = [
  "HAZIRLANDI",
  "DIJITAL_VD_GIRILDI",
  "MUKELLEF_CEVAPLADI",
  "ONAYLANDI",
  "PASIF_TALEP",
];

function fmtTR(num: number) {
  return num.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function monthToDonem(val: string) {
  // "YYYY-MM" -> "YYYY/MM"
  return val.replace("-", "/");
}

function donemToMonth(val: string) {
  // "YYYY/MM" -> "YYYY-MM"
  return val.replace("/", "-");
}

// ── Excel field definitions ────────────────────────────────────────────────

interface ExcelFieldDef { key: string; label: string; required: boolean; hints: string[]; }

const EXCEL_FIELDS: ExcelFieldDef[] = [
  { key: "tarih",    label: "Fatura Tarihi",       required: false, hints: ["tarih", "date", "düzenleme"] },
  { key: "unvan",    label: "Unvan (Düzenleyen)",   required: true,  hints: ["unvan", "satıcı", "firma", "ad", "düzenleyen"] },
  { key: "vergiNo",  label: "VKN/TCKN",              required: false, hints: ["vkn", "vergi", "kimlik", "tckn"] },
  { key: "cins",     label: "Mal/Hizmet Cinsi",      required: false, hints: ["cins", "açıklama", "mal", "hizmet", "description"] },
  { key: "miktar",   label: "Miktar",                required: false, hints: ["miktar", "adet", "qty", "quantity"] },
  { key: "kdvHaric", label: "KDV Hariç Tutar",       required: true,  hints: ["kdv hariç", "matrah", "hariç", "net tutar", "exclusive"] },
  { key: "kdvOrani", label: "KDV Oranı %",           required: false, hints: ["oran", "kdv %", "rate", "percent"] },
  { key: "kdv",      label: "KDV Tutarı",            required: true,  hints: ["kdv", "vergi tutarı", "katma değer", "tax amount"] },
];

function autoDetectColumn(header: string, hints: string[]): boolean {
  const h = header.toLowerCase();
  return hints.some(hint => h.includes(hint));
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement("a");
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ══════════════════════════════════════════════════════════════════════════════
// TutanakHazirlaPanel
// ══════════════════════════════════════════════════════════════════════════════

function TutanakHazirlaPanel() {
  // Mükellef bilgileri
  const [mukellefUnvan, setMukellefUnvan] = useState("");
  const [mukellefVkn,   setMukellefVkn]   = useState("");
  const [mukellefVD,    setMukellefVD]     = useState("");
  const [konu,          setKonu]           = useState<"KDV_IADE" | "TAM_TASDIK">("KDV_IADE");
  const [donemBas,      setDonemBas]       = useState("");
  const [donemBit,      setDonemBit]       = useState("");
  const [notlar,        setNotlar]         = useState("");

  // YMM bilgileri (persisted)
  const [ymmAdi,     setYmmAdi]     = useState("");
  const [ymmSicilNo, setYmmSicilNo] = useState("");
  const [ymmVergiNo, setYmmVergiNo] = useState("");
  const [ymmOpen,    setYmmOpen]    = useState(false);

  // Input mode
  const [inputMode, setInputMode] = useState<InputMode>("xml");

  // XML mode state
  const [xmlFiles,      setXmlFiles]      = useState<File[]>([]);
  const [xmlParsing,    setXmlParsing]    = useState(false);
  const [xmlError,      setXmlError]      = useState<string | null>(null);
  const xmlInputRef = useRef<HTMLInputElement>(null);

  // Excel mode state
  const [excelFile,     setExcelFile]     = useState<File | null>(null);
  const [excelData,     setExcelData]     = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [excelMapping,  setExcelMapping]  = useState<Record<string, number>>({});
  const [excelLoading,  setExcelLoading]  = useState(false);
  const [excelError,    setExcelError]    = useState<string | null>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);

  // Fatura listesi
  const [faturalar, setFaturalar] = useState<KarsitFatura[]>([]);

  // Actions
  const [loading, setLoading]   = useState(false);
  const [error,   setError]     = useState<string | null>(null);
  const [success, setSuccess]   = useState<string | null>(null);

  // ── Load / save YMM bilgileri ──
  useEffect(() => {
    try {
      const saved = localStorage.getItem("vezin_ymm_bilgileri");
      if (saved) {
        const { ymmAdi: a, ymmSicilNo: s, ymmVergiNo: v } = JSON.parse(saved);
        if (a) setYmmAdi(a);
        if (s) setYmmSicilNo(s);
        if (v) setYmmVergiNo(v);
        setYmmOpen(false);
      } else {
        setYmmOpen(true);
      }
    } catch {}
  }, []);

  function saveYmm(a: string, s: string, v: string) {
    try { localStorage.setItem("vezin_ymm_bilgileri", JSON.stringify({ ymmAdi: a, ymmSicilNo: s, ymmVergiNo: v })); }
    catch {}
  }

  // ── XML upload ──
  async function handleXmlParse() {
    if (xmlFiles.length === 0) { setXmlError("En az bir XML veya ZIP dosyası seçin."); return; }
    setXmlParsing(true);
    setXmlError(null);
    try {
      const fd = new FormData();
      xmlFiles.forEach(f => fd.append("files[]", f));
      const res  = await fetch("/api/karsit-inceleme/parse-xml", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setXmlError(data.error || "Hata"); return; }
      if (data.faturalar?.length > 0) {
        setFaturalar(prev => [...prev, ...data.faturalar]);
      }
      if (data.hatalar?.length > 0) {
        setXmlError(`${data.faturalar.length} fatura eklendi. ${data.hatalar.length} dosya işlenemedi.`);
      }
      setXmlFiles([]);
      if (xmlInputRef.current) xmlInputRef.current.value = "";
    } catch (e: any) {
      setXmlError("İstek başarısız: " + (e?.message ?? ""));
    } finally {
      setXmlParsing(false);
    }
  }

  // ── Excel upload ──
  async function handleExcelUpload(file: File) {
    setExcelLoading(true);
    setExcelError(null);
    setExcelData(null);
    setExcelMapping({});
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res  = await fetch("/api/karsit-inceleme/excel-import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setExcelError(data.error || "Hata"); return; }
      setExcelData({ headers: data.headers, rows: data.rows });
      // Auto-detect
      const mapping: Record<string, number> = {};
      EXCEL_FIELDS.forEach(field => {
        const idx = data.headers.findIndex((h: string) => autoDetectColumn(h, field.hints));
        if (idx >= 0) mapping[field.key] = idx;
      });
      setExcelMapping(mapping);
    } catch (e: any) {
      setExcelError("İstek başarısız: " + (e?.message ?? ""));
    } finally {
      setExcelLoading(false);
    }
  }

  function applyExcelMapping() {
    if (!excelData) return;
    const required = EXCEL_FIELDS.filter(f => f.required);
    for (const f of required) {
      if (excelMapping[f.key] === undefined || excelMapping[f.key] < 0) {
        setExcelError(`"${f.label}" sütunu zorunludur.`);
        return;
      }
    }
    setExcelError(null);

    const newFaturalar: KarsitFatura[] = excelData.rows.map((row, i) => {
      function get(key: string) {
        const idx = excelMapping[key];
        return idx !== undefined && idx >= 0 ? (row[idx] ?? "") : "";
      }
      function getNum(key: string): number {
        return parseFloat(get(key).replace(/\s/g, "").replace(",", ".")) || 0;
      }

      const kdvHaric = getNum("kdvHaric");
      const kdvTutar = getNum("kdv");
      const toplam   = kdvHaric + kdvTutar;
      const tarih    = get("tarih");

      return {
        id:           `EXCEL-${i + 1}`,
        seri:         "",
        siraNo:       String(i + 1),
        tarihFmt:     tarih,
        tarihIso:     "",
        unvan:        get("unvan"),
        vergiNo:      get("vergiNo"),
        cins:         get("cins"),
        miktar:       get("miktar"),
        kdvHaricTutar: kdvHaric,
        kdvOrani:     getNum("kdvOrani"),
        kdvTutari:    kdvTutar,
        toplam,
        sourceFile:   "excel-import",
      };
    }).filter(f => f.unvan || f.kdvHaricTutar);

    setFaturalar(prev => [...prev, ...newFaturalar]);
    setExcelData(null);
    setExcelFile(null);
    if (excelInputRef.current) excelInputRef.current.value = "";
  }

  // ── Validation ──
  function validate(requireFaturalar = false): string | null {
    if (!mukellefUnvan.trim()) return "Mükellef unvanı zorunludur.";
    if (!mukellefVkn.trim())   return "Mükellef VKN zorunludur.";
    if (!mukellefVD.trim())    return "Mükellef vergi dairesi zorunludur.";
    if (!donemBas)             return "Başlangıç dönemi zorunludur.";
    if (!donemBit)             return "Bitiş dönemi zorunludur.";
    if (requireFaturalar && faturalar.length === 0) return "En az bir fatura eklenmelidir.";
    return null;
  }

  // ── Excel indirme ──
  async function handleExcelIndir() {
    const err = validate(true);
    if (err) { setError(err); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/karsit-inceleme/export-excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ faturalar, mukellefUnvan, mukellefVkn, donemBas, donemBit, konu }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || "Excel oluşturulamadı");
        return;
      }
      const blob = await res.blob();
      triggerDownload(blob, `karsit-inceleme-${mukellefVkn}-${donemBas.replace("/","")}-${donemBit.replace("/","")}.xlsx`);
    } catch (e: any) {
      setError("İstek başarısız: " + (e?.message ?? ""));
    } finally {
      setLoading(false);
    }
  }

  // ── Word taslağı ──
  async function handleWordIndir() {
    const err = validate(true);
    if (err) { setError(err); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/karsit-inceleme/export-word", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mukellefUnvan, mukellefVkn, mukellefVD,
          ymmAdi, ymmSicilNo, ymmVergiNo,
          konu, donemBas, donemBit,
          faturalar,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || "Belge oluşturulamadı");
        return;
      }
      const blob = await res.blob();
      triggerDownload(blob, "karsit-inceleme-tutanagi.doc");
    } catch (e: any) {
      setError("İstek başarısız: " + (e?.message ?? ""));
    } finally {
      setLoading(false);
    }
  }

  // ── Kaydet ──
  async function handleKaydet() {
    const err = validate(true);
    if (err) { setError(err); return; }
    setLoading(true); setError(null); setSuccess(null);
    try {
      const res = await fetch("/api/karsit-inceleme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mukellefUnvan, mukellefVkn, mukellefVD,
          konu, donemBas, donemBit,
          ymmAdi, ymmSicilNo, ymmVergiNo,
          faturalar: JSON.stringify(faturalar),
          notlar,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Kayıt başarısız"); return; }
      setSuccess("Karşıt inceleme kaydedildi.");
    } catch (e: any) {
      setError("İstek başarısız: " + (e?.message ?? ""));
    } finally {
      setLoading(false);
    }
  }

  const totalKdvHaric = faturalar.reduce((s, f) => s + f.kdvHaricTutar, 0);
  const totalKdv      = faturalar.reduce((s, f) => s + f.kdvTutari, 0);
  const totalToplam   = faturalar.reduce((s, f) => s + f.toplam, 0);

  return (
    <div className="space-y-6">

      {/* ── Mükellef & Dönem ── */}
      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Mükellef Bilgileri</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Mükellef Unvanı *</label>
            <input
              type="text"
              value={mukellefUnvan}
              onChange={e => setMukellefUnvan(e.target.value)}
              placeholder="Şirket Adı veya Ad Soyad"
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F57C28]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">VKN / TCKN *</label>
            <input
              type="text"
              value={mukellefVkn}
              onChange={e => setMukellefVkn(e.target.value)}
              placeholder="10 veya 11 hane"
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F57C28]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Vergi Dairesi *</label>
            <input
              type="text"
              value={mukellefVD}
              onChange={e => setMukellefVD(e.target.value)}
              placeholder="Örn. Büyük Mükellefler VD"
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F57C28]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Konu *</label>
            <select
              value={konu}
              onChange={e => setKonu(e.target.value as "KDV_IADE" | "TAM_TASDIK")}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F57C28]"
            >
              <option value="KDV_IADE">KDV İadesi</option>
              <option value="TAM_TASDIK">Tam Tasdik</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Dönem Başı *</label>
              <input
                type="month"
                value={donemBas ? donemToMonth(donemBas) : ""}
                onChange={e => setDonemBas(monthToDonem(e.target.value))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F57C28]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Dönem Sonu *</label>
              <input
                type="month"
                value={donemBit ? donemToMonth(donemBit) : ""}
                onChange={e => setDonemBit(monthToDonem(e.target.value))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F57C28]"
              />
            </div>
          </div>
        </div>

        {/* Notlar */}
        <div className="mt-4">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Notlar</label>
          <textarea
            value={notlar}
            onChange={e => setNotlar(e.target.value)}
            rows={2}
            placeholder="İncelemeye ilişkin ek notlar..."
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F57C28] resize-none"
          />
        </div>
      </section>

      {/* ── YMM Bilgileri ── */}
      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setYmmOpen(o => !o)}
          className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold text-gray-900 dark:text-white"
        >
          <span>YMM Bilgileri (Ayarlar)</span>
          <span className={clsx("transition-transform", ymmOpen ? "rotate-180" : "")}>▾</span>
        </button>
        {ymmOpen && (
          <div className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-gray-200 dark:border-gray-700 pt-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">YMM Adı Soyadı</label>
              <input
                type="text"
                value={ymmAdi}
                onChange={e => { setYmmAdi(e.target.value); saveYmm(e.target.value, ymmSicilNo, ymmVergiNo); }}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F57C28]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Sicil No</label>
              <input
                type="text"
                value={ymmSicilNo}
                onChange={e => { setYmmSicilNo(e.target.value); saveYmm(ymmAdi, e.target.value, ymmVergiNo); }}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F57C28]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Vergi / TC Kimlik No</label>
              <input
                type="text"
                value={ymmVergiNo}
                onChange={e => { setYmmVergiNo(e.target.value); saveYmm(ymmAdi, ymmSicilNo, e.target.value); }}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F57C28]"
              />
            </div>
            <p className="sm:col-span-3 text-xs text-gray-400 dark:text-gray-500">
              Bu bilgiler tarayıcınızda saklanır ve tekrar kullanılır.
            </p>
          </div>
        )}
      </section>

      {/* ── Fatura Ekle ── */}
      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Fatura Ekle</h3>

        {/* Mode tabs */}
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg mb-5 w-fit">
          {(["xml", "excel"] as InputMode[]).map(m => (
            <button
              key={m}
              onClick={() => { setInputMode(m); setXmlError(null); setExcelError(null); }}
              className={clsx(
                "px-4 py-1.5 text-xs font-medium rounded-md transition-colors",
                inputMode === m
                  ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              )}
            >
              {m === "xml" ? "XML / ZIP Yükle" : "Excel'den Aktar"}
            </button>
          ))}
        </div>

        {/* XML mode */}
        {inputMode === "xml" && (
          <div className="space-y-3">
            <div
              className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-[#F57C28] transition-colors"
              onClick={() => xmlInputRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                const dropped = Array.from(e.dataTransfer.files).filter(f => {
                  const lc = f.name.toLowerCase();
                  return lc.endsWith(".xml") || lc.endsWith(".zip");
                });
                setXmlFiles(prev => [...prev, ...dropped]);
              }}
            >
              <input
                ref={xmlInputRef}
                type="file"
                accept=".xml,.zip"
                multiple
                className="hidden"
                onChange={e => {
                  const files = Array.from(e.target.files ?? []);
                  setXmlFiles(prev => [...prev, ...files]);
                }}
              />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                XML veya ZIP dosyalarını buraya sürükleyin ya da tıklayın
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Çoklu seçim desteklenir · Maks. 50MB/dosya</p>
            </div>

            {xmlFiles.length > 0 && (
              <div className="space-y-1">
                {xmlFiles.map((f, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-1.5 bg-gray-50 dark:bg-gray-700 rounded-md text-xs text-gray-700 dark:text-gray-300">
                    <span>{f.name}</span>
                    <button
                      onClick={() => setXmlFiles(prev => prev.filter((_, j) => j !== i))}
                      className="text-red-400 hover:text-red-600 ml-2"
                    >×</button>
                  </div>
                ))}
              </div>
            )}

            {xmlError && <p className="text-sm text-amber-600 dark:text-amber-400">{xmlError}</p>}

            <button
              onClick={handleXmlParse}
              disabled={xmlParsing || xmlFiles.length === 0}
              className="px-4 py-2 bg-[#F57C28] text-white text-sm font-medium rounded-lg hover:bg-[#E06820] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {xmlParsing ? "Ayrıştırılıyor..." : "Listele"}
            </button>
          </div>
        )}

        {/* Excel mode */}
        {inputMode === "excel" && (
          <div className="space-y-4">
            <div
              className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-[#F57C28] transition-colors"
              onClick={() => excelInputRef.current?.click()}
            >
              <input
                ref={excelInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) { setExcelFile(file); handleExcelUpload(file); }
                }}
              />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {excelFile ? excelFile.name : "Excel dosyası seçin (.xlsx / .xls)"}
              </p>
            </div>

            {excelLoading && <p className="text-sm text-gray-500">Yükleniyor...</p>}
            {excelError  && <p className="text-sm text-red-500">{excelError}</p>}

            {excelData && (
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Sütun Eşleştirme</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {EXCEL_FIELDS.map(field => (
                    <div key={field.key}>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        {field.label}{field.required ? " *" : ""}
                      </label>
                      <select
                        value={excelMapping[field.key] ?? -1}
                        onChange={e => setExcelMapping(prev => ({ ...prev, [field.key]: parseInt(e.target.value) }))}
                        className="w-full px-2 py-1.5 text-xs rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#F57C28]"
                      >
                        <option value={-1}>— Seçiniz —</option>
                        {excelData.headers.map((h, i) => (
                          <option key={i} value={i}>{h || `Sütun ${i + 1}`}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                {/* Preview */}
                {excelData.rows.length > 0 && (
                  <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                    <table className="text-xs min-w-full">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-700">
                          {excelData.headers.map((h, i) => (
                            <th key={i} className="px-2 py-1.5 text-left font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">{h || `Sütun ${i + 1}`}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {excelData.rows.slice(0, 3).map((row, ri) => (
                          <tr key={ri} className="border-t border-gray-100 dark:border-gray-700">
                            {row.map((cell, ci) => (
                              <td key={ci} className="px-2 py-1 text-gray-700 dark:text-gray-300 whitespace-nowrap">{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {excelData.rows.length > 3 && (
                      <p className="px-3 py-1.5 text-xs text-gray-400 border-t border-gray-100 dark:border-gray-700">
                        +{excelData.rows.length - 3} daha...
                      </p>
                    )}
                  </div>
                )}

                <button
                  onClick={applyExcelMapping}
                  className="px-4 py-2 bg-[#F57C28] text-white text-sm font-medium rounded-lg hover:bg-[#E06820] transition-colors"
                >
                  Uygula ({excelData.rows.length} satır)
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Fatura Tablosu ── */}
      {faturalar.length > 0 && (
        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Fatura Listesi
              <span className="ml-2 text-xs font-normal text-gray-500">{faturalar.length} fatura</span>
            </h3>
            <button
              onClick={() => setFaturalar([])}
              className="text-xs text-red-500 hover:text-red-700 transition-colors"
            >
              Listeyi Temizle
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  {["Sıra", "Tarih", "Fatura No", "Unvan", "Cinsi", "Miktar", "KDV Hariç", "KDV %", "KDV Tutarı", "Toplam", ""].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {faturalar.map((f, i) => (
                  <tr key={i} className={clsx(i % 2 === 0 ? "bg-white dark:bg-gray-800" : "bg-gray-50 dark:bg-gray-750")}>
                    <td className="px-3 py-1.5 text-gray-500">{i + 1}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">{f.tarihFmt}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap font-mono">{f.seri}{f.siraNo}</td>
                    <td className="px-3 py-1.5 max-w-[180px] truncate" title={f.unvan}>{f.unvan}</td>
                    <td className="px-3 py-1.5 max-w-[120px] truncate" title={f.cins}>{f.cins}</td>
                    <td className="px-3 py-1.5">{f.miktar}</td>
                    <td className="px-3 py-1.5 text-right">{fmtTR(f.kdvHaricTutar)}</td>
                    <td className="px-3 py-1.5 text-center">{f.kdvOrani}%</td>
                    <td className="px-3 py-1.5 text-right">{fmtTR(f.kdvTutari)}</td>
                    <td className="px-3 py-1.5 text-right font-medium">{fmtTR(f.toplam)}</td>
                    <td className="px-3 py-1.5">
                      <button
                        onClick={() => setFaturalar(prev => prev.filter((_, j) => j !== i))}
                        className="text-red-400 hover:text-red-600"
                      >×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#F57C28] text-white text-xs font-semibold">
                  <td colSpan={6} className="px-3 py-2 text-right">{faturalar.length} Fatura Toplamı</td>
                  <td className="px-3 py-2 text-right">{fmtTR(totalKdvHaric)}</td>
                  <td className="px-3 py-2"></td>
                  <td className="px-3 py-2 text-right">{fmtTR(totalKdv)}</td>
                  <td className="px-3 py-2 text-right">{fmtTR(totalToplam)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      {/* ── Çıktılar ── */}
      {faturalar.length > 0 && (
        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Çıktılar</h3>

          {error   && <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">{error}</div>}
          {success && <div className="mb-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-sm text-green-700 dark:text-green-400">{success}</div>}

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleExcelIndir}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Excel İndir
            </button>

            <button
              onClick={handleWordIndir}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Word Taslağı İndir
            </button>

            <button
              onClick={handleKaydet}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-[#F57C28] text-white text-sm font-medium rounded-lg hover:bg-[#E06820] disabled:opacity-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              {loading ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TakipPanosuPanel
// ══════════════════════════════════════════════════════════════════════════════

function TakipPanosuPanel() {
  const [records,  setRecords]  = useState<TutanakKaydi[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => { fetchRecords(); }, []);

  async function fetchRecords() {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/karsit-inceleme");
      if (!res.ok) { setError("Veri alınamadı"); return; }
      setRecords(await res.json());
    } catch (e: any) {
      setError("İstek başarısız: " + (e?.message ?? ""));
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(id: string, durum: string) {
    const body: any = { durum };
    if (durum === "DIJITAL_VD_GIRILDI") body.gonderimTarihi = new Date().toISOString();
    try {
      const res = await fetch(`/api/karsit-inceleme/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) fetchRecords();
    } catch {}
  }

  async function handleDelete(id: string, unvan: string) {
    if (!confirm(`"${unvan}" kaydını silmek istediğinize emin misiniz?`)) return;
    try {
      const res = await fetch(`/api/karsit-inceleme/${id}`, { method: "DELETE" });
      if (res.ok) fetchRecords();
    } catch {}
  }

  function kalanGunBadge(record: TutanakKaydi) {
    if (record.durum !== "DIJITAL_VD_GIRILDI" || !record.gonderimTarihi) return null;
    const daysPassed = Math.floor((Date.now() - new Date(record.gonderimTarihi).getTime()) / 86400000);
    const kalanGun   = 30 - daysPassed;

    if (kalanGun <= 0) {
      return <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 font-medium">Süre Doldu</span>;
    }
    if (kalanGun <= 5) {
      return <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 font-medium">{kalanGun} gün kaldı ⚠</span>;
    }
    if (kalanGun <= 10) {
      return <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 font-medium">{kalanGun} gün kaldı</span>;
    }
    return <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">{kalanGun} gün kaldı</span>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
        Yükleniyor...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400">
        {error}
        <button onClick={fetchRecords} className="ml-3 underline">Tekrar Dene</button>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
        <svg className="w-12 h-12 mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
        </svg>
        <p className="text-sm font-medium">Henüz karşıt inceleme kaydı yok</p>
        <p className="text-xs mt-1">Hazırla sekmesinden ilk kaydı oluşturun.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">{records.length} kayıt</p>
        <button
          onClick={fetchRecords}
          className="text-xs text-[#F57C28] hover:underline"
        >
          Yenile
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              {["Mükellef", "Dönem", "Konu", "Durum", "30 Gün Sayacı", "İşlemler"].map(h => (
                <th key={h} className="px-4 py-2.5 text-left font-semibold text-gray-600 dark:text-gray-400 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {records.map(r => (
              <tr key={r.id} className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900 dark:text-white truncate max-w-[200px]" title={r.mukellefUnvan}>{r.mukellefUnvan}</p>
                  <p className="text-gray-400 font-mono mt-0.5">{r.mukellefVkn}</p>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-gray-700 dark:text-gray-300">
                  {r.donemBas} — {r.donemBit}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-gray-700 dark:text-gray-300">
                  {r.konu === "TAM_TASDIK" ? "Tam Tasdik" : "KDV İadesi"}
                </td>
                <td className="px-4 py-3">
                  <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium", DURUM_COLORS[r.durum] || DURUM_COLORS.HAZIRLANDI)}>
                    {DURUM_LABELS[r.durum] || r.durum}
                  </span>
                  {r.durum === "DIJITAL_VD_GIRILDI" && r.gonderimTarihi && (
                    <p className="text-gray-400 mt-0.5">
                      {new Date(r.gonderimTarihi).toLocaleDateString("tr-TR")}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3">
                  {kalanGunBadge(r)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <select
                      value={r.durum}
                      onChange={e => handleStatusChange(r.id, e.target.value)}
                      className="text-xs px-2 py-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#F57C28]"
                    >
                      {ALL_DURUM.map(d => (
                        <option key={d} value={d}>{DURUM_LABELS[d]}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleDelete(r.id, r.mukellefUnvan)}
                      className="p-1 text-red-400 hover:text-red-600 transition-colors"
                      title="Sil"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Main Export
// ══════════════════════════════════════════════════════════════════════════════

export default function KarsitIncelemePanel() {
  const [subTab, setSubTab] = useState<KISubTab>("hazirla");

  return (
    <div>
      {/* Sub-tab bar */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-700/50 rounded-lg mb-6 w-fit">
        {([
          { id: "hazirla", label: "Tutanak Hazırla" },
          { id: "takip",   label: "Takip Panosu" },
        ] as { id: KISubTab; label: string }[]).map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={clsx(
              "px-5 py-2 text-sm font-medium rounded-md transition-colors",
              subTab === t.id
                ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subTab === "hazirla" && <TutanakHazirlaPanel />}
      {subTab === "takip"   && <TakipPanosuPanel />}
    </div>
  );
}
