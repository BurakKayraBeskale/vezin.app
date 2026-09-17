"use client";

import { useState, useMemo } from "react";
import clsx from "clsx";
import {
  hesaplaRotasyon,
  uyariKategori,
  type RotasyonAyarlar,
  type RotasyonHesap,
  type UyariKategori,
  ROTASYON_SOZLESME_TURU_LABELS,
  type RotasyonSozlesmeTuru,
} from "@/lib/rotasyon";
import IsletmeForm from "./IsletmeForm";
import SozlesmeForm from "./SozlesmeForm";
import type { RotasyonIsletmeRecord, RotasyonSozlesmeRecord } from "./types";

interface Props {
  initialIsletmeler: RotasyonIsletmeRecord[];
  ayar: RotasyonAyarlar;
  isAdmin: boolean;
}

type Tab = "sozlesmeler" | "isletmeler" | "yil-plani" | "denetci-gecmisi";

const TABS: { key: Tab; label: string }[] = [
  { key: "sozlesmeler", label: "Sözleşmeler" },
  { key: "isletmeler", label: "İşletmeler" },
  { key: "yil-plani", label: "Yıl Planı" },
  { key: "denetci-gecmisi", label: "Denetçi Görev Geçmişi" },
];

const UYARI_KOLONLARI: { key: UyariKategori; label: string; cls: string; dot: string }[] = [
  { key: "DOLDU", label: "Süre Doldu", cls: "border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800", dot: "bg-red-500" },
  { key: "KALAN_1", label: "1 Yıl Kaldı", cls: "border-orange-200 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-800", dot: "bg-orange-500" },
  { key: "KALAN_2", label: "2 Yıl Kaldı", cls: "border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800", dot: "bg-amber-500" },
  { key: "KALAN_3", label: "3 Yıl Kaldı", cls: "border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800", dot: "bg-blue-500" },
  { key: "ARA", label: "Ara Veriliyor", cls: "border-gray-200 bg-gray-50 dark:bg-gray-700/40 dark:border-gray-600", dot: "bg-gray-400" },
];

function fmtDonemAraligi(donemler: number[]): string {
  if (donemler.length === 0) return "—";
  const min = Math.min(...donemler);
  const max = Math.max(...donemler);
  return min === max ? String(min) : `${min}–${max}`;
}

export default function RotasyonClient({ initialIsletmeler, ayar, isAdmin }: Props) {
  const [isletmeler, setIsletmeler] = useState<RotasyonIsletmeRecord[]>(initialIsletmeler);
  const [tab, setTab] = useState<Tab>("sozlesmeler");
  const [toast, setToast] = useState<string | null>(null);

  const [isletmeFormOpen, setIsletmeFormOpen] = useState<null | { isletme: RotasyonIsletmeRecord | null }>(null);
  const [sozlesmeFormOpen, setSozlesmeFormOpen] = useState<null | {
    sozlesme: RotasyonSozlesmeRecord | null;
    defaultIsletmeId?: string;
    prefill?: { isletmeId: string; tur: string; donem: number; kadrolar: { adSoyad: string; unvan: string; tip: "ASIL" | "YEDEK"; fiilenGorevAldi: boolean }[] };
  }>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  // İşletme başına rotasyon hesabı — dönemler değiştikçe yeniden hesaplanır
  const hesapMap = useMemo(() => {
    const map = new Map<string, RotasyonHesap | null>();
    for (const isl of isletmeler) {
      map.set(isl.id, hesaplaRotasyon(isl.sozlesmeler.map((s) => s.donem), ayar));
    }
    return map;
  }, [isletmeler, ayar]);

  // ── İşletme CRUD ─────────────────────────────────────────────────────────
  function handleIsletmeSaved(isletme: RotasyonIsletmeRecord) {
    setIsletmeler((prev) => {
      const exists = prev.some((i) => i.id === isletme.id);
      // API yanıtı sözleşmeleri de içerir (isletmeInclude) — mevcut kaydı olduğu gibi değiştir
      return exists ? prev.map((i) => (i.id === isletme.id ? { ...i, ...isletme } : i)) : [...prev, isletme];
    });
    setIsletmeFormOpen(null);
    showToast(isletmeFormOpen?.isletme ? "İşletme güncellendi" : "İşletme oluşturuldu");
  }

  async function handleDeleteIsletme(isletme: RotasyonIsletmeRecord) {
    if (!confirm(`"${isletme.unvan}" işletmesini silmek istediğinizden emin misiniz?`)) return;
    const res = await fetch(`/api/rotasyon/isletmeler/${isletme.id}`, { method: "DELETE" });
    if (res.ok) {
      setIsletmeler((prev) => prev.filter((i) => i.id !== isletme.id));
      showToast("İşletme silindi");
    }
  }

  // Sözleşme formundan "+ Yeni işletme tanımla" ile oluşturulan işletmeyi listeye ekler
  function handleIsletmeCreatedInline(isletme: RotasyonIsletmeRecord) {
    setIsletmeler((prev) => [...prev, isletme]);
  }

  // ── Sözleşme CRUD ────────────────────────────────────────────────────────
  function handleSozlesmeSaved(sozlesme: RotasyonSozlesmeRecord) {
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
    showToast(sozlesmeFormOpen?.sozlesme ? "Sözleşme güncellendi" : "Sözleşme oluşturuldu");
  }

  async function handleDeleteSozlesme(sozlesme: RotasyonSozlesmeRecord) {
    if (!confirm(`${sozlesme.donem} dönemi sözleşmesini silmek istediğinizden emin misiniz?`)) return;
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
        kadrolar: sonSozlesme.kadrolar.map((k) => ({
          adSoyad: k.adSoyad, unvan: k.unvan, tip: k.tip as "ASIL" | "YEDEK", fiilenGorevAldi: true,
        })),
      },
    });
  }

  // ── Uyarı Merkezi ────────────────────────────────────────────────────────
  const uyariGruplari = useMemo(() => {
    const gruplar = new Map<UyariKategori, RotasyonIsletmeRecord[]>();
    for (const isl of isletmeler) {
      const hesap = hesapMap.get(isl.id);
      if (!hesap) continue;
      const kategori = uyariKategori(hesap);
      if (!kategori) continue;
      if (!gruplar.has(kategori)) gruplar.set(kategori, []);
      gruplar.get(kategori)!.push(isl);
    }
    return gruplar;
  }, [isletmeler, hesapMap]);

  const eylemGereken = Array.from(uyariGruplari.values()).some((list) => list.length > 0);

  // ── Yıl Planı ────────────────────────────────────────────────────────────
  const yilPlani = useMemo(() => {
    const map = new Map<number, RotasyonIsletmeRecord[]>();
    for (const isl of isletmeler) {
      const hesap = hesapMap.get(isl.id);
      if (!hesap) continue;
      const yil = hesap.sonDenetlenebilirDonem + 1;
      if (!map.has(yil)) map.set(yil, []);
      map.get(yil)!.push(isl);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [isletmeler, hesapMap]);

  // ── Denetçi Görev Geçmişi ────────────────────────────────────────────────
  const denetciGecmisi = useMemo(() => {
    const map = new Map<string, { unvan: string; gorevler: { isletmeUnvan: string; donem: number; unvan: string; tip: string; tur: string }[] }>();
    for (const isl of isletmeler) {
      for (const soz of isl.sozlesmeler) {
        for (const k of soz.kadrolar) {
          if (!map.has(k.adSoyad)) map.set(k.adSoyad, { unvan: k.unvan, gorevler: [] });
          map.get(k.adSoyad)!.gorevler.push({
            isletmeUnvan: isl.unvan, donem: soz.donem, unvan: k.unvan, tip: k.tip, tur: soz.tur,
          });
        }
      }
    }
    for (const kisi of map.values()) {
      kisi.gorevler.sort((a, b) => b.donem - a.donem);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], "tr"));
  }, [isletmeler]);

  const isletmelerSirali = useMemo(
    () => [...isletmeler].sort((a, b) => a.unvan.localeCompare(b.unvan, "tr")),
    [isletmeler]
  );

  return (
    <div className="max-w-6xl mx-auto">
      {/* Başlık */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Rotasyon Takip</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Denetçi rotasyon süresi ve sözleşme yönetimi</p>
        </div>
        <button
          onClick={() => setSozlesmeFormOpen({ sozlesme: null })}
          className="px-4 py-2 bg-[#F57C28] text-white rounded-lg text-sm font-medium hover:bg-[#e06d1f] transition-colors"
        >
          + Yeni Sözleşme
        </button>
      </div>

      {/* ── Uyarı Merkezi (en üst) ──────────────────────────────────────── */}
      <div className="mb-6">
        {!eylemGereken ? (
          <div className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl px-4 py-3">
            <svg className="w-5 h-5 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
              Eylem gerektiren kayıt yok — tüm işletmeler rotasyon süresi bakımından normal.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {UYARI_KOLONLARI.map((kol) => {
              const list = uyariGruplari.get(kol.key) ?? [];
              return (
                <div key={kol.key} className={clsx("rounded-xl border p-3", kol.cls)}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className={clsx("w-2 h-2 rounded-full flex-shrink-0", kol.dot)} />
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">{kol.label}</p>
                    <span className="ml-auto text-xs font-bold text-gray-500 dark:text-gray-400">{list.length}</span>
                  </div>
                  {list.length === 0 ? (
                    <p className="text-[11px] text-gray-400 dark:text-gray-500">—</p>
                  ) : (
                    <ul className="space-y-0.5">
                      {list.slice(0, 5).map((isl) => (
                        <li key={isl.id} className="text-[11px] text-gray-600 dark:text-gray-300 truncate" title={isl.unvan}>
                          {isl.unvan}
                        </li>
                      ))}
                      {list.length > 5 && (
                        <li className="text-[11px] text-gray-400">ve {list.length - 5} işletme daha</li>
                      )}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sekmeler */}
      <div className="flex gap-1 mb-5 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={clsx(
              "px-4 py-2 rounded-md text-sm font-medium transition-colors",
              tab === t.key
                ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Sözleşmeler ──────────────────────────────────────────────────── */}
      {tab === "sozlesmeler" && (
        <div className="space-y-4">
          {isletmelerSirali.length === 0 ? (
            <p className="text-center text-gray-400 py-16 text-sm">Henüz işletme tanımlanmamış</p>
          ) : (
            isletmelerSirali.map((isl) => {
              const hesap = hesapMap.get(isl.id);
              const sozlesmelerSirali = [...isl.sozlesmeler].sort((a, b) => b.donem - a.donem);
              const sonSozlesme = sozlesmelerSirali[0] ?? null;
              return (
                <div key={isl.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="flex items-center justify-between gap-3 px-5 py-3 bg-gray-50 dark:bg-gray-700/40 border-b border-gray-200 dark:border-gray-700">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white truncate">{isl.unvan}</p>
                      <p className="text-[11px] text-gray-400">{isl.vkn}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {hesap && (
                        <span className={clsx(
                          "text-xs font-semibold px-2 py-1 rounded-full",
                          hesap.durum === "DOLDU" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" :
                          hesap.durum === "ARA" ? "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300" :
                          hesap.durum === "UYARI" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" :
                          "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                        )}>
                          Toplam süre {hesap.denetlenenSure}/{ayar.azamiSure}
                        </span>
                      )}
                      <button
                        onClick={() => setSozlesmeFormOpen({ sozlesme: null, defaultIsletmeId: isl.id })}
                        className="text-xs font-medium text-[#F57C28] hover:text-[#e06d1f]"
                      >
                        + Sözleşme
                      </button>
                    </div>
                  </div>

                  {sozlesmelerSirali.length === 0 ? (
                    <p className="text-sm text-gray-400 px-5 py-4">Bu işletme için sözleşme kaydı yok</p>
                  ) : (
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                      {sozlesmelerSirali.map((soz) => (
                        <div key={soz.id} className="px-5 py-3 flex items-start gap-3 flex-wrap">
                          <div className="flex-shrink-0 w-14">
                            <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{soz.donem}</p>
                          </div>
                          <div className="flex-1 min-w-[160px]">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="text-xs font-medium text-gray-700 dark:text-gray-200">{soz.sozlesmeNo}</span>
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300">
                                {ROTASYON_SOZLESME_TURU_LABELS[soz.tur as RotasyonSozlesmeTuru] ?? soz.tur}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {soz.kadrolar.length === 0 ? "Kadro girilmemiş" : soz.kadrolar.map((k) => (
                                `${k.adSoyad} (${k.tip === "ASIL" ? "Asıl" : "Yedek"}${k.fiilenGorevAldi ? "" : ", fiilen görev almadı"})`
                              )).join(", ")}
                            </p>
                            {soz.not && <p className="text-[11px] text-gray-400 mt-0.5 italic">{soz.not}</p>}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {soz.id === sonSozlesme?.id && (
                              <button
                                onClick={() => openYeniDonem(isl.id, soz)}
                                className="text-[11px] font-semibold px-2 py-1 rounded-lg text-[#F57C28] hover:bg-orange-50 dark:hover:bg-orange-900/20"
                              >
                                Yeni Dönem
                              </button>
                            )}
                            <button
                              onClick={() => setSozlesmeFormOpen({ sozlesme: soz })}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-[#F57C28] hover:bg-orange-50 dark:hover:bg-orange-900/20"
                              title="Düzenle"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDeleteSozlesme(soz)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                              title="Sil"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── İşletmeler ───────────────────────────────────────────────────── */}
      {tab === "isletmeler" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setIsletmeFormOpen({ isletme: null })}
              className="px-4 py-2 bg-[#F57C28] text-white rounded-lg text-sm font-medium hover:bg-[#e06d1f] transition-colors"
            >
              + Yeni İşletme
            </button>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    {["Unvan", "VKN", "Dönem Aralığı", "Dönem Sayısı", "Denetlenen Süre", "Kalan", "Son Denetlenebilir Dönem", "Yeniden Üstlenme Yılı", ""].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {isletmelerSirali.map((isl) => {
                    const hesap = hesapMap.get(isl.id);
                    const donemler = isl.sozlesmeler.map((s) => s.donem);
                    return (
                      <tr key={isl.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                        <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">{isl.unvan}</td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{isl.vkn}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{fmtDonemAraligi(donemler)}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{new Set(donemler).size}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{hesap ? `${hesap.denetlenenSure}/${ayar.azamiSure}` : "—"}</td>
                        <td className="px-4 py-3">
                          {hesap ? (
                            <span className={clsx(
                              "font-semibold",
                              hesap.kalanSure <= 0 ? "text-red-600 dark:text-red-400" :
                              hesap.kalanSure <= ayar.uyariEsigi ? "text-amber-600 dark:text-amber-400" :
                              "text-emerald-600 dark:text-emerald-400"
                            )}>
                              {hesap.kalanSure}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{hesap?.sonDenetlenebilirDonem ?? "—"}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{hesap?.yenidenUstlenmeYili ?? "—"}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            <button
                              onClick={() => setIsletmeFormOpen({ isletme: isl })}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-[#F57C28] hover:bg-orange-50 dark:hover:bg-orange-900/20"
                              title="Düzenle"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            {isAdmin && (
                              <button
                                onClick={() => handleDeleteIsletme(isl)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                title="Sil"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {isletmelerSirali.length === 0 && (
                    <tr><td colSpan={9} className="text-center text-gray-400 py-12 text-sm">Henüz işletme yok</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Yıl Planı ────────────────────────────────────────────────────── */}
      {tab === "yil-plani" && (
        <div className="space-y-4">
          <p className="text-xs text-gray-400">
            Bir işletme için son denetlenebilir dönemden sonraki ilk hesap dönemi — o yıl için rotasyon (yeni denetçi) gerekir.
          </p>
          {yilPlani.length === 0 ? (
            <p className="text-center text-gray-400 py-16 text-sm">Henüz veri yok</p>
          ) : (
            yilPlani.map(([yil, list]) => (
              <div key={yil} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-5 py-2.5 bg-gray-50 dark:bg-gray-700/40 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-800 dark:text-gray-100">{yil}</span>
                  <span className="text-xs text-gray-400">{list.length} işletme</span>
                </div>
                <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                  {list.map((isl) => (
                    <li key={isl.id} className="px-5 py-2 text-sm text-gray-700 dark:text-gray-200">{isl.unvan}</li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Denetçi Görev Geçmişi ────────────────────────────────────────── */}
      {tab === "denetci-gecmisi" && (
        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-2.5">
            <p className="text-xs text-blue-700 dark:text-blue-300">
              Bu sekme yalnızca bilgi amaçlıdır; denetçi rotasyonu hesaplanmaz ve uyarı üretmez.
            </p>
          </div>
          {denetciGecmisi.length === 0 ? (
            <p className="text-center text-gray-400 py-16 text-sm">Henüz kadro kaydı yok</p>
          ) : (
            denetciGecmisi.map(([adSoyad, kisi]) => (
              <div key={adSoyad} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-5 py-2.5 bg-gray-50 dark:bg-gray-700/40 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-sm font-bold text-gray-800 dark:text-gray-100">{adSoyad}</span>
                  <span className="text-xs text-gray-400 ml-2">{kisi.unvan}</span>
                </div>
                <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                  {kisi.gorevler.map((g, i) => (
                    <li key={i} className="px-5 py-2 flex items-center gap-3 text-sm flex-wrap">
                      <span className="font-semibold text-gray-700 dark:text-gray-200 w-14 flex-shrink-0">{g.donem}</span>
                      <span className="text-gray-600 dark:text-gray-300 flex-1 min-w-[140px]">{g.isletmeUnvan}</span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300">
                        {ROTASYON_SOZLESME_TURU_LABELS[g.tur as RotasyonSozlesmeTuru] ?? g.tur}
                      </span>
                      <span className={clsx(
                        "text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                        g.tip === "ASIL" ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300" : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                      )}>
                        {g.tip === "ASIL" ? "Asıl" : "Yedek"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-gray-900 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-xl">
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
          isletmeler={isletmelerSirali}
          sozlesme={sozlesmeFormOpen.sozlesme}
          prefill={sozlesmeFormOpen.prefill}
          defaultIsletmeId={sozlesmeFormOpen.defaultIsletmeId}
          onClose={() => setSozlesmeFormOpen(null)}
          onSaved={handleSozlesmeSaved}
          onIsletmeCreated={handleIsletmeCreatedInline}
        />
      )}
    </div>
  );
}
