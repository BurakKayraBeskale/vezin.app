"use client";

import { useState, useMemo } from "react";
import clsx from "clsx";
import {
  hesaplaRotasyon,
  uyariKategori,
  uyariKategoriSirasi,
  donemAraligi,
  ROTASYON_SOZLESME_TURU_LABELS,
  type RotasyonSozlesmeTuru,
  type RotasyonAyarlar,
  type RotasyonHesap,
  type RotasyonDurum,
  type UyariKategori,
} from "@/lib/rotasyon";
import IsletmeForm from "./IsletmeForm";
import SozlesmeForm from "./SozlesmeForm";
import AyarlarForm from "./AyarlarForm";
import type { RotasyonIsletmeRecord, RotasyonSozlesmeRecord } from "./types";

interface Props {
  initialIsletmeler: RotasyonIsletmeRecord[];
  ayar: RotasyonAyarlar;
  isAdmin: boolean;
}

type Tab = "sozlesmeler" | "isletmeler" | "denetciler" | "yil-plani";

const TABS: { key: Tab; label: string }[] = [
  { key: "sozlesmeler", label: "Sözleşme dönemleri" },
  { key: "isletmeler", label: "İşletmeler ve rotasyon" },
  { key: "denetciler", label: "Denetçi rotasyonu" },
  { key: "yil-plani", label: "Yıl planı" },
];

type FilterStatus = "all" | "crit" | "warn" | "ok" | "brk";
const FILTER_OPTIONS: { value: FilterStatus; label: string }[] = [
  { value: "all", label: "Tüm durumlar" },
  { value: "crit", label: "Süre doldu" },
  { value: "warn", label: "Yaklaşan" },
  { value: "ok", label: "Normal" },
  { value: "brk", label: "Ara veriliyor" },
];

function durumToFilter(d: RotasyonDurum): FilterStatus {
  if (d === "DOLDU") return "crit";
  if (d === "UYARI") return "warn";
  if (d === "ARA") return "brk";
  return "ok";
}

// ── Renk / etiket yardımcıları (reference: renk mantığı — doldu=kırmızı, yaklaşan=amber/turuncu, normal=yeşil, ara=mavi) ──

function pillLabel(hesap: RotasyonHesap): string {
  if (hesap.durum === "DOLDU") return "Azami süre doldu";
  if (hesap.durum === "ARA") return `Ara veriliyor · ${hesap.yenidenUstlenmeYili}'den itibaren`;
  return `${hesap.kalanSure} yıl kaldı`;
}

function pillClasses(durum: RotasyonDurum): { box: string; dot: string } {
  if (durum === "DOLDU") return { box: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300", dot: "bg-red-500" };
  if (durum === "UYARI") return { box: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300", dot: "bg-amber-500" };
  if (durum === "ARA") return { box: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300", dot: "bg-blue-500" };
  return { box: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300", dot: "bg-emerald-500" };
}

function Pill({ hesap }: { hesap: RotasyonHesap }) {
  const c = pillClasses(hesap.durum);
  return (
    <span className={clsx("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap", c.box)}>
      <span className={clsx("w-1.5 h-1.5 rounded-full flex-shrink-0", c.dot)} />
      {pillLabel(hesap)}
    </span>
  );
}

function Countdown({ hesap, ayar }: { hesap: RotasyonHesap; ayar: RotasyonAyarlar }) {
  if (hesap.durum === "ARA") {
    return <span className="text-xs font-medium text-blue-600 dark:text-blue-400 whitespace-nowrap">ara dönemi</span>;
  }
  const used = Math.min(hesap.denetlenenSure, ayar.azamiSure);
  const barCls = hesap.kalanSure <= 0 ? "bg-red-500" : hesap.kalanSure <= ayar.uyariEsigi ? "bg-amber-500" : "bg-emerald-500";
  return (
    <span className="inline-flex items-center gap-2">
      <span className="flex gap-0.5 flex-shrink-0">
        {Array.from({ length: ayar.azamiSure }).map((_, i) => (
          <span key={i} className={clsx("w-1.5 h-4 rounded-sm", i < used ? barCls : "bg-gray-200 dark:bg-gray-700")} />
        ))}
      </span>
      <span className="text-xs font-mono font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap">
        {hesap.kalanSure <= 0 ? "0 yıl" : `${hesap.kalanSure} yıl`}
      </span>
    </span>
  );
}

// Tailwind JIT statik sınıf adları tarar — dinamik `grid-cols-${n}` interpolasyonu
// derlenmez, bu yüzden olası sütun sayıları (3..6) için sabit bir eşleme gerekir.
const ALERT_GRID_COLS: Record<number, string> = {
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
  5: "sm:grid-cols-2 lg:grid-cols-5",
  6: "sm:grid-cols-3 lg:grid-cols-6",
};

function rowFlagClass(hesap: RotasyonHesap | null | undefined): string {
  if (!hesap) return "";
  if (hesap.durum === "DOLDU") return "border-l-[3px] border-l-red-500";
  if (hesap.durum === "UYARI") return "border-l-[3px] border-l-amber-500";
  return "";
}

function kolonBasligi(kategori: UyariKategori): string {
  if (kategori === "DOLDU") return "Azami süre doldu";
  if (kategori === "ARA") return "Ara veriliyor";
  return `${kategori.replace("KALAN_", "")} yıl kaldı`;
}

function kolonRenk(kategori: UyariKategori): { text: string; dot: string; border: string } {
  if (kategori === "DOLDU") return { text: "text-red-600 dark:text-red-400", dot: "bg-red-500", border: "border-red-200 dark:border-red-800" };
  if (kategori === "ARA") return { text: "text-gray-500 dark:text-gray-400", dot: "bg-gray-400", border: "border-gray-200 dark:border-gray-700" };
  const n = Number(kategori.replace("KALAN_", ""));
  if (n <= 1) return { text: "text-orange-600 dark:text-orange-400", dot: "bg-orange-500", border: "border-orange-200 dark:border-orange-800" };
  if (n === 2) return { text: "text-amber-600 dark:text-amber-400", dot: "bg-amber-500", border: "border-amber-200 dark:border-amber-800" };
  return { text: "text-blue-600 dark:text-blue-400", dot: "bg-blue-500", border: "border-blue-200 dark:border-blue-800" };
}

// ── CSV dışa aktarma ─────────────────────────────────────────────────────────

function csvOf(rows: (string | number)[][]): string {
  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
}
function downloadCsv(filename: string, content: string) {
  const blob = new Blob(["﻿" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

interface DenetciSatir {
  adSoyad: string;
  unvanlar: Set<string>;
  isletmeId: string;
  isletmeUnvan: string;
  donemler: Set<number>;
}

export default function RotasyonClient({ initialIsletmeler, ayar: initialAyar, isAdmin }: Props) {
  const [isletmeler, setIsletmeler] = useState<RotasyonIsletmeRecord[]>(initialIsletmeler);
  const [ayar, setAyar] = useState<RotasyonAyarlar>(initialAyar);
  const [tab, setTab] = useState<Tab>("sozlesmeler");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [toast, setToast] = useState<string | null>(null);

  const [isletmeFormOpen, setIsletmeFormOpen] = useState<null | { isletme: RotasyonIsletmeRecord | null }>(null);
  const [ayarlarFormOpen, setAyarlarFormOpen] = useState(false);
  const [sozlesmeFormOpen, setSozlesmeFormOpen] = useState<null | {
    sozlesme: RotasyonSozlesmeRecord | null;
    defaultIsletmeId?: string;
    prefill?: { isletmeId: string; tur: string; donem: number; kaynakDonem: number; kadrolar: { adSoyad: string; unvan: string; tip: "ASIL" | "YEDEK"; fiilenGorevAldi: boolean }[] };
  }>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  const q = search.trim().toLocaleLowerCase("tr");
  const matchQ = (s: string) => !q || s.toLocaleLowerCase("tr").includes(q);
  const matchS = (hesap: RotasyonHesap | null) => filterStatus === "all" || (!!hesap && durumToFilter(hesap.durum) === filterStatus);

  // İşletme başına rotasyon hesabı — ayarlar veya dönemler değiştikçe yeniden hesaplanır
  const hesapMap = useMemo(() => {
    const map = new Map<string, RotasyonHesap | null>();
    for (const isl of isletmeler) {
      map.set(isl.id, hesaplaRotasyon(isl.sozlesmeler.map((s) => s.donem), ayar, ayar.cariDonem));
    }
    return map;
  }, [isletmeler, ayar]);

  // ── İşletme CRUD ─────────────────────────────────────────────────────────
  function handleIsletmeSaved(isletme: RotasyonIsletmeRecord) {
    const wasEdit = !!isletmeFormOpen?.isletme;
    setIsletmeler((prev) => {
      const exists = prev.some((i) => i.id === isletme.id);
      return exists ? prev.map((i) => (i.id === isletme.id ? { ...i, ...isletme } : i)) : [...prev, isletme];
    });
    setIsletmeFormOpen(null);
    showToast(wasEdit ? "İşletme güncellendi" : "İşletme oluşturuldu");
  }

  async function handleDeleteIsletme(isletme: RotasyonIsletmeRecord) {
    const bagli = isletme.sozlesmeler.length;
    const soru = bagli
      ? `${isletme.unvan} işletmesine bağlı ${bagli} sözleşme dönemi de silinecek.\nDevam edilsin mi?`
      : `${isletme.unvan} silinecek. Devam edilsin mi?`;
    if (!confirm(soru)) return;
    const res = await fetch(`/api/rotasyon/isletmeler/${isletme.id}`, { method: "DELETE" });
    if (res.ok) {
      setIsletmeler((prev) => prev.filter((i) => i.id !== isletme.id));
      showToast("İşletme silindi");
    }
  }

  function handleIsletmeCreatedInline(isletme: RotasyonIsletmeRecord) {
    setIsletmeler((prev) => [...prev, isletme]);
  }

  // ── Sözleşme CRUD ────────────────────────────────────────────────────────
  function handleSozlesmeSaved(sozlesme: RotasyonSozlesmeRecord) {
    const wasEdit = !!sozlesmeFormOpen?.sozlesme;
    setIsletmeler((prev) =>
      prev.map((isl) => {
        if (isl.id !== sozlesme.isletmeId) return isl;
        const exists = isl.sozlesmeler.some((s) => s.id === sozlesme.id);
        const sozlesmeler = exists
          ? isl.sozlesmeler.map((s) => (s.id === sozlesme.id ? sozlesme : s))
          : [...isl.sozlesmeler, sozlesme];
        return { ...isl, sozlesmeler };
      })
    );
    setSozlesmeFormOpen(null);
    showToast(wasEdit ? "Sözleşme güncellendi" : "Sözleşme oluşturuldu");
  }

  async function handleDeleteSozlesme(sozlesme: RotasyonSozlesmeRecord) {
    if (!confirm("Bu sözleşme dönemini silmek istediğinize emin misiniz?")) return;
    const res = await fetch(`/api/rotasyon/sozlesmeler/${sozlesme.id}`, { method: "DELETE" });
    if (res.ok) {
      setIsletmeler((prev) =>
        prev.map((isl) =>
          isl.id === sozlesme.isletmeId
            ? { ...isl, sozlesmeler: isl.sozlesmeler.filter((s) => s.id !== sozlesme.id) }
            : isl
        )
      );
      showToast("Sözleşme silindi");
    }
  }

  function openYeniDonem(isletmeId: string, sonSozlesme: RotasyonSozlesmeRecord) {
    setSozlesmeFormOpen({
      sozlesme: null,
      prefill: {
        isletmeId,
        tur: sonSozlesme.tur,
        donem: sonSozlesme.donem + 1,
        kaynakDonem: sonSozlesme.donem,
        kadrolar: sonSozlesme.kadrolar.map((k) => ({
          adSoyad: k.adSoyad, unvan: k.unvan, tip: k.tip as "ASIL" | "YEDEK", fiilenGorevAldi: true,
        })),
      },
    });
  }

  function handleAyarlarSaved(yeni: RotasyonAyarlar) {
    setAyar(yeni);
    setAyarlarFormOpen(false);
    showToast("Ayarlar kaydedildi");
  }

  // ── Uyarı Merkezi — sütunlar ayarlardan dinamik (1..uyariEsigi) ─────────
  const uyariGruplari = useMemo(() => {
    const gruplar = new Map<UyariKategori, RotasyonIsletmeRecord[]>();
    for (const isl of isletmeler) {
      const hesap = hesapMap.get(isl.id);
      if (!hesap) continue;
      const kategori = uyariKategori(hesap, ayar);
      if (!kategori) continue;
      if (!gruplar.has(kategori)) gruplar.set(kategori, []);
      gruplar.get(kategori)!.push(isl);
    }
    return gruplar;
  }, [isletmeler, hesapMap, ayar]);

  const uyariKolonlari = useMemo(() => uyariKategoriSirasi(ayar.uyariEsigi), [ayar.uyariEsigi]);
  const eylemBekleyen = (uyariGruplari.get("DOLDU")?.length ?? 0) +
    uyariKolonlari.filter((k) => k !== "DOLDU" && k !== "ARA").reduce((sum, k) => sum + (uyariGruplari.get(k)?.length ?? 0), 0);

  // ── Sözleşme dönemleri (düz tablo, işletmeye göre gruplu) ────────────────
  const sozlesmeSatirlari = useMemo(() => {
    type Satir = { soz: RotasyonSozlesmeRecord; isl: RotasyonIsletmeRecord; hesap: RotasyonHesap };
    const rows: Satir[] = [];
    for (const isl of isletmeler) {
      const hesap = hesapMap.get(isl.id);
      if (!hesap) continue;
      for (const soz of isl.sozlesmeler) rows.push({ soz, isl, hesap });
    }
    return rows
      .filter(({ soz, isl }) => matchQ(`${isl.unvan} ${soz.sozlesmeNo} ${soz.kadrolar.map((k) => k.adSoyad).join(" ")}`))
      .filter(({ hesap }) => matchS(hesap))
      .sort((a, b) =>
        (a.hesap.kalanSure - b.hesap.kalanSure) ||
        a.isl.unvan.localeCompare(b.isl.unvan, "tr") ||
        (b.soz.donem - a.soz.donem)
      );
  }, [isletmeler, hesapMap, q, filterStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── İşletmeler ve rotasyon ────────────────────────────────────────────────
  const isletmeSatirlari = useMemo(() => {
    return isletmeler
      .map((isl) => ({ isl, hesap: hesapMap.get(isl.id) ?? null }))
      .filter(({ isl }) => matchQ(isl.unvan))
      .filter(({ hesap }) => matchS(hesap))
      .sort((a, b) =>
        (a.hesap?.kalanSure ?? Number.POSITIVE_INFINITY) - (b.hesap?.kalanSure ?? Number.POSITIVE_INFINITY) ||
        a.isl.unvan.localeCompare(b.isl.unvan, "tr")
      );
  }, [isletmeler, hesapMap, q, filterStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Denetçi rotasyonu (yalnızca bilgi amaçlı) ────────────────────────────
  const denetciSatirlari = useMemo(() => {
    const map = new Map<string, DenetciSatir>();
    for (const isl of isletmeler) {
      for (const soz of isl.sozlesmeler) {
        for (const k of soz.kadrolar) {
          const ad = k.adSoyad.trim();
          if (!ad) continue;
          const key = ad.toLocaleLowerCase("tr") + "||" + isl.id;
          if (!map.has(key)) map.set(key, { adSoyad: ad, unvanlar: new Set(), isletmeId: isl.id, isletmeUnvan: isl.unvan, donemler: new Set() });
          const row = map.get(key)!;
          row.unvanlar.add(k.tip === "ASIL" ? "Asıl kadro" : "Yedek kadro");
          if (k.unvan) row.unvanlar.add(k.unvan);
          row.donemler.add(soz.donem);
        }
      }
    }
    return Array.from(map.values())
      .filter((d) => matchQ(`${d.adSoyad} ${d.isletmeUnvan}`))
      .sort((a, b) => a.adSoyad.localeCompare(b.adSoyad, "tr") || a.isletmeUnvan.localeCompare(b.isletmeUnvan, "tr"));
  }, [isletmeler, q]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Yıl planı ────────────────────────────────────────────────────────────
  const yilPlaniGruplari = useMemo(() => {
    const span = Math.max(ayar.uyariEsigi, 4);
    const buckets = new Map<number, { isl: RotasyonIsletmeRecord; hesap: RotasyonHesap; ne: string }[]>();
    for (const isl of isletmeler) {
      const hesap = hesapMap.get(isl.id);
      if (!hesap) continue;
      let yil: number | null = null;
      let ne = "";
      if (hesap.durum === "DOLDU") { yil = ayar.cariDonem; ne = "Rotasyon gerekiyor — süre doldu"; }
      else if ((hesap.durum === "UYARI" || hesap.durum === "NORMAL") && hesap.kalanSure > 0 && hesap.kalanSure <= span) {
        yil = ayar.cariDonem + hesap.kalanSure; ne = "Bu dönemden itibaren rotasyon";
      } else if (hesap.durum === "ARA" && hesap.yenidenUstlenmeYili <= ayar.cariDonem + span) {
        yil = hesap.yenidenUstlenmeYili; ne = "Yeniden üstlenilebilir";
      }
      if (yil === null) continue;
      if (!buckets.has(yil)) buckets.set(yil, []);
      buckets.get(yil)!.push({ isl, hesap, ne });
    }
    return { span, gruplar: Array.from(buckets.entries()).sort((a, b) => a[0] - b[0]) };
  }, [isletmeler, hesapMap, ayar]);

  const isletmelerSirali = useMemo(
    () => [...isletmeler].sort((a, b) => a.unvan.localeCompare(b.unvan, "tr")),
    [isletmeler]
  );

  // ── İstatistik kartları ──────────────────────────────────────────────────
  const stats = useMemo(() => {
    const sozlesmeDonemi = isletmeler.reduce((sum, i) => sum + i.sozlesmeler.length, 0);
    const tumKadrolar = isletmeler.flatMap((i) => i.sozlesmeler.flatMap((s) => s.kadrolar));
    const kayitliDenetci = new Set(tumKadrolar.map((k) => k.adSoyad.trim().toLocaleLowerCase("tr")).filter(Boolean)).size;
    const cariDonemSozlesmesi = isletmeler.reduce((sum, i) => sum + i.sozlesmeler.filter((s) => s.donem === ayar.cariDonem).length, 0);
    return { tanimliIsletme: isletmeler.length, sozlesmeDonemi, kayitliDenetci, cariDonemSozlesmesi };
  }, [isletmeler, ayar.cariDonem]);

  function handleExportCsv() {
    const sozRows: (string | number)[][] = [["İşletme", "VKN", "Sözleşme no", "Hesap dönemi", "Sözleşme türü", "Asıl kadro", "Yedek kadro", "Not"]];
    for (const isl of [...isletmeler].sort((a, b) => a.unvan.localeCompare(b.unvan, "tr"))) {
      for (const s of [...isl.sozlesmeler].sort((a, b) => a.donem - b.donem)) {
        const ad = (tip: "ASIL" | "YEDEK") => s.kadrolar.filter((m) => m.tip === tip).map((m) => m.adSoyad + (m.fiilenGorevAldi ? "" : " (dahil değil)")).join(" | ");
        sozRows.push([isl.unvan, isl.vkn, s.sozlesmeNo, s.donem, ROTASYON_SOZLESME_TURU_LABELS[s.tur as RotasyonSozlesmeTuru] ?? s.tur, ad("ASIL"), ad("YEDEK"), s.not ?? ""]);
      }
    }

    const rotRows: (string | number)[][] = [["İşletme", "VKN", "Dönemler", "Süre", "Azami", "Kalan", "Son denetlenebilir dönem", "Yeniden üstlenme", "Durum"]];
    for (const isl of isletmelerSirali) {
      const hesap = hesapMap.get(isl.id);
      rotRows.push([
        isl.unvan, isl.vkn, donemAraligi(isl.sozlesmeler.map((s) => s.donem)),
        hesap?.denetlenenSure ?? 0, ayar.azamiSure, hesap?.kalanSure ?? ayar.azamiSure,
        hesap?.sonDenetlenebilirDonem ?? "", hesap?.yenidenUstlenmeYili ?? "", hesap ? pillLabel(hesap) : "—",
      ]);
    }

    const denRows: (string | number)[][] = [["Denetçi", "İşletme", "Görev dönemleri", "Toplam görev (bilgi amaçlı)"]];
    for (const d of denetciSatirlari) {
      denRows.push([d.adSoyad, d.isletmeUnvan, donemAraligi(Array.from(d.donemler)), d.donemler.size]);
    }

    downloadCsv(`sozlesmeler-${ayar.cariDonem}.csv`, csvOf(sozRows));
    downloadCsv(`rotasyon-${ayar.cariDonem}.csv`, csvOf(rotRows));
    downloadCsv(`denetci-gorevleri-${ayar.cariDonem}.csv`, csvOf(denRows));
  }

  const thClass = "px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap";
  const tdClass = "px-3 py-2.5 align-middle";

  return (
    <div className="max-w-7xl mx-auto">
      {/* Yazdırma başlığı — yalnızca yazdırma çıktısında görünür */}
      <div className="hidden print:block mb-4 pb-3 border-b-2 border-gray-800">
        <h1 className="text-xl font-bold text-gray-900">Vezin Bağımsız Denetim A.Ş.</h1>
        <p className="text-xs text-gray-600 mt-0.5">Rotasyon Takip Panosu — denetim kuruluşu ve denetçi sürelerinin izlenmesi</p>
      </div>

      {/* Başlık + aksiyonlar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Rotasyon Takip</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Denetçi rotasyon süresi ve sözleşme yönetimi</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setAyarlarFormOpen(true)}
            className="px-3.5 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
          >
            Ayarlar
          </button>
          <button
            onClick={() => setIsletmeFormOpen({ isletme: null })}
            className="px-3.5 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
          >
            + İşletme tanımla
          </button>
          <button
            onClick={() => setSozlesmeFormOpen({ sozlesme: null })}
            className="px-4 py-2 bg-[#F57C28] text-white rounded-lg text-sm font-medium hover:bg-[#e06d1f] transition-colors"
          >
            + Sözleşme ekle
          </button>
        </div>
      </div>

      {/* ── Uyarı Merkezi ──────────────────────────────────────────────────── */}
      <div className="mb-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden print:break-inside-avoid">
        <div className={clsx(
          "flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-700",
          eylemBekleyen === 0 ? "bg-emerald-50 dark:bg-emerald-900/20" : "bg-gray-50 dark:bg-gray-700/40"
        )}>
          <h2 className={clsx("text-base font-bold", eylemBekleyen === 0 ? "text-emerald-700 dark:text-emerald-300" : "text-gray-800 dark:text-gray-100")}>
            {eylemBekleyen === 0 ? "Eylem gerektiren rotasyon yok" : `${eylemBekleyen} kayıt eylem bekliyor`}
          </h2>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {ayar.cariDonem} hesap dönemi · {ayar.azamiSure} yıl azami süre, {ayar.zorunluAra} yıl zorunlu ara · uyarı eşiği {ayar.uyariEsigi} yıl
          </span>
        </div>
        <div className={clsx("grid", ALERT_GRID_COLS[uyariKolonlari.length] ?? "sm:grid-cols-2 lg:grid-cols-6")}>
          {uyariKolonlari.map((kategori, i) => {
            const list = uyariGruplari.get(kategori) ?? [];
            const renk = kolonRenk(kategori);
            return (
              <div key={kategori} className={clsx("p-3.5", i > 0 && "sm:border-l border-gray-100 dark:border-gray-700")}>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className={clsx("w-2 h-2 rounded-full flex-shrink-0", renk.dot)} />
                  <p className={clsx("text-xs font-semibold", renk.text)}>{kolonBasligi(kategori)}</p>
                  <span className="ml-auto text-lg font-bold font-mono text-gray-700 dark:text-gray-200">{list.length}</span>
                </div>
                {list.length === 0 ? (
                  <p className="text-[11px] text-gray-400 dark:text-gray-500">Kayıt yok</p>
                ) : (
                  <ul className="space-y-1">
                    {list.slice(0, 4).map((isl) => {
                      const hesap = hesapMap.get(isl.id)!;
                      return (
                        <li key={isl.id} className="text-[11px] border-t border-gray-100 dark:border-gray-700 pt-1 first:border-t-0 first:pt-0">
                          <span className="block font-medium text-gray-700 dark:text-gray-200 truncate" title={isl.unvan}>{isl.unvan}</span>
                          <span className="text-gray-400">{hesap.denetlenenSure} dönem denetlendi</span>
                        </li>
                      );
                    })}
                    {list.length > 4 && <li className="text-[11px] text-gray-400 pt-1">+ {list.length - 4} kayıt daha</li>}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* İstatistik kartları */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5 print:hidden">
        {[
          { num: stats.tanimliIsletme, lbl: "Tanımlı işletme" },
          { num: stats.sozlesmeDonemi, lbl: "Sözleşme dönemi" },
          { num: stats.kayitliDenetci, lbl: "Kayıtlı denetçi" },
          { num: stats.cariDonemSozlesmesi, lbl: "Cari dönem sözleşmesi" },
        ].map((s) => (
          <div key={s.lbl} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3">
            <p className="font-mono text-2xl font-bold text-gray-900 dark:text-white leading-none">{s.num}</p>
            <p className="text-xs text-gray-400 mt-1.5">{s.lbl}</p>
          </div>
        ))}
      </div>

      {/* Sekmeler */}
      <div className="flex gap-1 mb-4 border-b border-gray-200 dark:border-gray-700 flex-wrap print:hidden">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={clsx(
              "px-4 py-2.5 text-sm border-b-2 -mb-px transition-colors",
              tab === t.key
                ? "border-gray-900 dark:border-white text-gray-900 dark:text-white font-semibold"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Kontroller: arama, durum filtresi, yazdır, CSV */}
      <div className="flex flex-wrap items-center gap-2.5 mb-4 print:hidden">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="İşletme, denetçi veya sözleşme numarası ara..."
          className="flex-1 min-w-[200px] px-3.5 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/30"
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200"
        >
          {FILTER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <div className="flex-1" />
        <button
          onClick={() => window.print()}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
        >
          Yazdır
        </button>
        <button
          onClick={handleExportCsv}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
        >
          CSV indir
        </button>
      </div>

      {/* ── Sözleşme dönemleri ───────────────────────────────────────────── */}
      {tab === "sozlesmeler" && (
        isletmeler.length === 0 ? (
          <EmptyState title="Önce işletmeleri tanımlayın" text={'"+ İşletme tanımla" ile denetlediğiniz işletmeleri girin, sonra her hesap dönemi için sözleşme ekleyin.'} />
        ) : stats.sozlesmeDonemi === 0 ? (
          <EmptyState title="Henüz sözleşme dönemi yok" text={'"+ Sözleşme ekle" ile ilk hesap dönemini girin.'} />
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden print:break-inside-avoid">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50 border-b-2 border-gray-800 dark:border-gray-200">
                  <tr>
                    {["İşletme / sözleşme no", "Hesap dönemi", "Sözleşme türü", "Asıl kadro", "Yedek kadro", "İşletmedeki toplam süre", "Rotasyon durumu", ""].map((h) => (
                      <th key={h} className={thClass}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {sozlesmeSatirlari.length === 0 ? (
                    <tr><td colSpan={8} className="text-center text-gray-400 py-10 text-sm">Filtreye uyan kayıt yok</td></tr>
                  ) : (
                    sozlesmeSatirlari.map(({ soz, isl, hesap }, i) => {
                      const yeniGrup = i === 0 || sozlesmeSatirlari[i - 1].isl.id !== isl.id;
                      const periods = isl.sozlesmeler.length;
                      const mukerrer = isl.sozlesmeler.filter((s) => s.donem === soz.donem).length > 1;
                      const asil = soz.kadrolar.filter((k) => k.tip === "ASIL");
                      const yedek = soz.kadrolar.filter((k) => k.tip === "YEDEK");
                      return (
                        <tr key={soz.id} className={clsx(
                          "hover:bg-gray-50/50 dark:hover:bg-gray-700/30",
                          yeniGrup && "border-t-2 border-t-gray-300 dark:border-t-gray-600",
                          rowFlagClass(hesap)
                        )}>
                          <td className={tdClass}>
                            <p className="font-semibold text-gray-800 dark:text-gray-100">{isl.unvan}</p>
                            <p className="font-mono text-[11px] text-gray-400 mt-0.5">{soz.sozlesmeNo || "sözleşme no girilmedi"}</p>
                            {periods > 1 && <p className="text-[11px] text-gray-400">{periods} dönem kayıtlı</p>}
                            {soz.not && <p className="text-[11px] text-gray-400">{soz.not}</p>}
                            {mukerrer && (
                              <p className="inline-block mt-1 text-[10px] font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">
                                bu dönem birden fazla kayıtlı
                              </p>
                            )}
                          </td>
                          <td className={clsx(tdClass, "font-mono text-sm font-semibold text-gray-800 dark:text-gray-100")}>{soz.donem}</td>
                          <td className={tdClass}>
                            <span className="inline-block text-[11px] px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 whitespace-nowrap">
                              {ROTASYON_SOZLESME_TURU_LABELS[soz.tur as RotasyonSozlesmeTuru] ?? soz.tur}
                            </span>
                          </td>
                          <td className={tdClass}>
                            {asil.length === 0 ? <span className="text-gray-300 dark:text-gray-600">—</span> : (
                              <div className="flex flex-wrap gap-1">
                                {asil.map((k) => (
                                  <span key={k.id} className="text-[11px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300">{k.adSoyad}{!k.fiilenGorevAldi && " · süreye dahil değil"}</span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className={tdClass}>
                            {yedek.length === 0 ? <span className="text-gray-300 dark:text-gray-600">—</span> : (
                              <div className="flex flex-wrap gap-1">
                                {yedek.map((k) => (
                                  <span key={k.id} className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">{k.adSoyad}{!k.fiilenGorevAldi && " · süreye dahil değil"}</span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className={tdClass}>
                            <p className="font-mono text-[11px] text-gray-500 dark:text-gray-400 mb-1">{hesap.denetlenenSure} / {ayar.azamiSure} dönem</p>
                            <Countdown hesap={hesap} ayar={ayar} />
                          </td>
                          <td className={tdClass}><Pill hesap={hesap} /></td>
                          <td className={clsx(tdClass, "print:hidden")}>
                            <div className="flex items-center gap-1">
                              <button onClick={() => setSozlesmeFormOpen({ sozlesme: soz })} className="text-[11px] font-medium text-gray-500 hover:text-[#F57C28] px-1.5 py-1">Düzenle</button>
                              <button onClick={() => openYeniDonem(isl.id, soz)} title="Bir sonraki hesap dönemi için kopyala" className="text-[11px] font-medium text-gray-500 hover:text-[#F57C28] px-1.5 py-1 whitespace-nowrap">Yeni dönem</button>
                              <button onClick={() => handleDeleteSozlesme(soz)} className="text-[11px] font-medium text-gray-500 hover:text-red-500 px-1.5 py-1">Sil</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-400 px-4 py-3 border-t border-gray-100 dark:border-gray-700 print:hidden">
              Her satır tek bir hesap dönemine ait sözleşmedir. Rotasyon süresi, aynı işletme adına kayıtlı bütün dönemler arka planda toplanarak hesaplanır; &quot;İşletmedeki toplam süre&quot; sütunu bu birikimi gösterir.
            </p>
          </div>
        )
      )}

      {/* ── İşletmeler ve rotasyon ───────────────────────────────────────── */}
      {tab === "isletmeler" && (
        isletmeler.length === 0 ? (
          <EmptyState title="Tanımlı işletme yok" text={'"+ İşletme tanımla" ile başlayın.'} />
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden print:break-inside-avoid">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50 border-b-2 border-gray-800 dark:border-gray-200">
                  <tr>
                    {["İşletme", "Kayıtlı dönemler", "Sözleşme türleri", "Denetlenen süre", "Kalan süre", "Son denetlenebilir dönem", "Yeniden üstlenme", "Durum", ""].map((h) => (
                      <th key={h} className={thClass}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {isletmeSatirlari.length === 0 ? (
                    <tr><td colSpan={9} className="text-center text-gray-400 py-10 text-sm">Filtreye uyan kayıt yok</td></tr>
                  ) : (
                    isletmeSatirlari.map(({ isl, hesap }) => {
                      const onceki = isl.oncekiDenetciIlkDonem || isl.oncekiDenetciSonDonem
                        ? `Önceki denetçi: ${isl.oncekiDenetciIlkDonem ?? "?"}–${isl.oncekiDenetciSonDonem ?? "?"}`
                        : null;
                      const turler = Array.from(new Set(isl.sozlesmeler.map((s) => s.tur)));
                      const mukerrer = isl.sozlesmeler.some((s) => isl.sozlesmeler.filter((x) => x.donem === s.donem).length > 1);
                      return (
                        <tr key={isl.id} className={clsx("hover:bg-gray-50/50 dark:hover:bg-gray-700/30", rowFlagClass(hesap))}>
                          <td className={tdClass}>
                            <p className="font-semibold text-gray-800 dark:text-gray-100">{isl.unvan}</p>
                            <p className="font-mono text-[11px] text-gray-400 mt-0.5">VKN {isl.vkn}</p>
                            {onceki && <p className="text-[11px] text-gray-400">{onceki}</p>}
                            {isl.not && <p className="text-[11px] text-gray-400">{isl.not}</p>}
                            {mukerrer && (
                              <p className="inline-block mt-1 text-[10px] font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">
                                aynı dönem birden fazla kayıtlı
                              </p>
                            )}
                          </td>
                          <td className={clsx(tdClass, "font-mono text-xs text-gray-600 dark:text-gray-300")}>
                            {donemAraligi(isl.sozlesmeler.map((s) => s.donem))}
                            <p className="text-[11px] text-gray-400">{isl.sozlesmeler.length} sözleşme</p>
                          </td>
                          <td className={tdClass}>
                            {turler.length === 0 ? <span className="text-gray-300 dark:text-gray-600">—</span> : (
                              <div className="flex flex-wrap gap-1">
                                {turler.map((t) => (
                                  <span key={t} className="text-[11px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 whitespace-nowrap">
                                    {ROTASYON_SOZLESME_TURU_LABELS[t as RotasyonSozlesmeTuru] ?? t}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className={clsx(tdClass, "font-mono text-xs text-gray-600 dark:text-gray-300")}>{hesap ? `${hesap.denetlenenSure} / ${ayar.azamiSure} dönem` : "—"}</td>
                          <td className={tdClass}>{hesap ? <Countdown hesap={hesap} ayar={ayar} /> : <span className="text-gray-300 dark:text-gray-600">—</span>}</td>
                          <td className={clsx(tdClass, "font-mono text-xs text-gray-600 dark:text-gray-300")}>{hesap?.sonDenetlenebilirDonem ?? "—"}</td>
                          <td className={clsx(tdClass, "font-mono text-xs text-gray-600 dark:text-gray-300")}>{hesap?.yenidenUstlenmeYili ?? "—"}</td>
                          <td className={tdClass}>{hesap ? <Pill hesap={hesap} /> : <span className="text-gray-300 dark:text-gray-600">—</span>}</td>
                          <td className={clsx(tdClass, "print:hidden")}>
                            <div className="flex items-center gap-1">
                              <button onClick={() => setIsletmeFormOpen({ isletme: isl })} className="text-[11px] font-medium text-gray-500 hover:text-[#F57C28] px-1.5 py-1">Düzenle</button>
                              {isAdmin && (
                                <button onClick={() => handleDeleteIsletme(isl)} className="text-[11px] font-medium text-gray-500 hover:text-red-500 px-1.5 py-1">Sil</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* ── Denetçi rotasyonu (yalnızca bilgi amaçlı) ───────────────────── */}
      {tab === "denetciler" && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-700 rounded-lg px-3.5 py-2.5 print:hidden">
            Bu bölüm yalnızca bilgi amaçlıdır; denetçi süreleri kayıt altına alınır ancak uyarı merkezinde ve yıl planında dikkate alınmaz.
          </p>
          {denetciSatirlari.length === 0 ? (
            <EmptyState title="Veri yok" text="Kadro bilgisi girilen sözleşmeler burada denetçi bazında listelenir." />
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden print:break-inside-avoid">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/50 border-b-2 border-gray-800 dark:border-gray-200">
                    <tr>
                      {["Denetçi", "İşletme", "Görev dönemleri", "Toplam görev"].map((h) => (
                        <th key={h} className={thClass}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {denetciSatirlari.map((d) => (
                      <tr key={d.adSoyad + d.isletmeId} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                        <td className={tdClass}>
                          <p className="font-semibold text-gray-800 dark:text-gray-100">{d.adSoyad}</p>
                          <p className="text-[11px] text-gray-400">{Array.from(d.unvanlar).join(" · ")}</p>
                        </td>
                        <td className={clsx(tdClass, "text-gray-700 dark:text-gray-200")}>{d.isletmeUnvan}</td>
                        <td className={clsx(tdClass, "font-mono text-xs text-gray-600 dark:text-gray-300")}>{donemAraligi(Array.from(d.donemler))}</td>
                        <td className={clsx(tdClass, "font-mono text-xs text-gray-600 dark:text-gray-300")}>{d.donemler.size} dönem</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Yıl planı ────────────────────────────────────────────────────── */}
      {tab === "yil-plani" && (
        yilPlaniGruplari.gruplar.length === 0 ? (
          <EmptyState title="Yaklaşan rotasyon yok" text={`Önümüzdeki ${yilPlaniGruplari.span} yıl içinde rotasyon gerektiren kayıt bulunmuyor.`} />
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden print:break-inside-avoid">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50 border-b-2 border-gray-800 dark:border-gray-200">
                  <tr>
                    {["Dönem", "Tür", "Kayıt", "Yapılması gereken", "Bugünkü durum"].map((h) => (
                      <th key={h} className={thClass}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {yilPlaniGruplari.gruplar.flatMap(([yil, kayitlar]) =>
                    kayitlar.map((k, i) => (
                      <tr key={`${yil}-${k.isl.id}`} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                        {i === 0 && (
                          <td rowSpan={kayitlar.length} className={clsx(tdClass, "font-mono text-base font-bold text-gray-800 dark:text-gray-100 align-top border-r border-gray-100 dark:border-gray-700")}>
                            {yil}
                          </td>
                        )}
                        <td className={tdClass}>Kuruluş</td>
                        <td className={tdClass}>
                          <p className="font-semibold text-gray-800 dark:text-gray-100">{k.isl.unvan}</p>
                          <p className="text-[11px] text-gray-400">{k.hesap.denetlenenSure} dönem denetlendi</p>
                        </td>
                        <td className={clsx(tdClass, "text-gray-600 dark:text-gray-300")}>{k.ne}</td>
                        <td className={tdClass}><Pill hesap={k.hesap} /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* Hesaplama esası */}
      <div className="mt-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-5 py-4 text-xs text-gray-500 dark:text-gray-400 leading-relaxed print:break-inside-avoid">
        <p>
          <strong className="text-gray-700 dark:text-gray-200">Hesaplama esası.</strong> Her sözleşme kaydı tek bir hesap dönemini temsil eder.
          Rotasyon süresi tek tek sözleşmeler üzerinden değil, aynı işletme adına kayıtlı bütün dönemler arka planda toplanarak hesaplanır ve
          aynı kural hem denetim kuruluşuna hem kadrodaki denetçilere uygulanır (varsayılan: <span>{ayar.azamiSure} yıl görev, ardından {ayar.zorunluAra} yıl kesintisiz ara</span>).
          Kadroda adı geçmekle birlikte fiilen denetim çalışmalarına katılmayan denetçiler için &quot;fiilen görev aldı&quot; işareti kaldırıldığında ilgili
          dönem süreye dahil edilmez. Azami süre dolduğunda yeniden üstlenme yılı, son denetlenen hesap dönemine ara süresi eklenerek bulunur.
          Pano kapalı devre çalışır. Nihai değerlendirmede Bağımsız Denetim Yönetmeliği ve KGK&apos;nın rotasyona ilişkin güncel düzenleme ve
          duyuruları esas alınmalıdır.
        </p>
        <p className="hidden print:block mt-3 pt-3 border-t border-gray-200 text-gray-500">
          Vezin Bağımsız Denetim A.Ş. · iç kullanım içindir
        </p>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-gray-900 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-xl print:hidden">
          <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          {toast}
        </div>
      )}

      {/* Modallar */}
      {isletmeFormOpen && (
        <IsletmeForm
          isletme={isletmeFormOpen.isletme}
          onClose={() => setIsletmeFormOpen(null)}
          onSaved={handleIsletmeSaved}
        />
      )}
      {sozlesmeFormOpen && (
        <SozlesmeForm
          isletmeler={isletmeler}
          ayar={ayar}
          sozlesme={sozlesmeFormOpen.sozlesme}
          prefill={sozlesmeFormOpen.prefill}
          defaultIsletmeId={sozlesmeFormOpen.defaultIsletmeId}
          onClose={() => setSozlesmeFormOpen(null)}
          onSaved={handleSozlesmeSaved}
          onIsletmeCreated={handleIsletmeCreatedInline}
        />
      )}
      {ayarlarFormOpen && (
        <AyarlarForm ayar={ayar} onClose={() => setAyarlarFormOpen(false)} onSaved={handleAyarlarSaved} />
      )}
    </div>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="text-center py-16 px-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
      <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-1.5">{title}</h3>
      <p className="text-sm text-gray-400">{text}</p>
    </div>
  );
}
