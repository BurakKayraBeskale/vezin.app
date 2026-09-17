"use client";

import { useState, FormEvent } from "react";
import {
  ROTASYON_SOZLESME_TURLERI,
  ROTASYON_SOZLESME_TURU_LABELS,
  type RotasyonSozlesmeTuru,
} from "@/lib/rotasyon";
import IsletmeForm from "./IsletmeForm";
import type { RotasyonIsletmeRecord, RotasyonSozlesmeRecord } from "./types";

interface KadroRow {
  adSoyad: string;
  unvan: string;
  tip: "ASIL" | "YEDEK";
  fiilenGorevAldi: boolean;
}

interface Prefill {
  isletmeId: string;
  tur: string;
  donem: number;
  kadrolar: KadroRow[];
}

interface Props {
  isletmeler: RotasyonIsletmeRecord[];
  sozlesme?: RotasyonSozlesmeRecord | null; // varsa düzenleme
  prefill?: Prefill | null; // "Yeni Dönem" — oluşturma, önceden doldurulmuş
  defaultIsletmeId?: string;
  onClose: () => void;
  onSaved: (sozlesme: RotasyonSozlesmeRecord) => void;
  onIsletmeCreated: (isletme: RotasyonIsletmeRecord) => void;
}

const emptyRow = (tip: "ASIL" | "YEDEK"): KadroRow => ({ adSoyad: "", unvan: "", tip, fiilenGorevAldi: true });

export default function SozlesmeForm({
  isletmeler, sozlesme, prefill, defaultIsletmeId, onClose, onSaved, onIsletmeCreated,
}: Props) {
  const [isletmeId, setIsletmeId] = useState(sozlesme?.isletmeId ?? prefill?.isletmeId ?? defaultIsletmeId ?? "");
  const [sozlesmeNo, setSozlesmeNo] = useState(sozlesme?.sozlesmeNo ?? "");
  const [donem, setDonem] = useState(String(sozlesme?.donem ?? prefill?.donem ?? new Date().getFullYear()));
  const [tur, setTur] = useState<string>(sozlesme?.tur ?? prefill?.tur ?? ROTASYON_SOZLESME_TURLERI[0]);
  const [not, setNot] = useState(sozlesme?.not ?? "");
  const [kadrolar, setKadrolar] = useState<KadroRow[]>(
    sozlesme?.kadrolar.map((k) => ({ adSoyad: k.adSoyad, unvan: k.unvan, tip: k.tip as "ASIL" | "YEDEK", fiilenGorevAldi: k.fiilenGorevAldi }))
    ?? prefill?.kadrolar
    ?? [emptyRow("ASIL")]
  );
  const [showYeniIsletme, setShowYeniIsletme] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const asilCount = kadrolar.filter((k) => k.tip === "ASIL").length;
  const yedekCount = kadrolar.filter((k) => k.tip === "YEDEK").length;

  function updateRow(index: number, patch: Partial<KadroRow>) {
    setKadrolar((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function removeRow(index: number) {
    setKadrolar((prev) => prev.filter((_, i) => i !== index));
  }

  function addRow(tip: "ASIL" | "YEDEK") {
    setKadrolar((prev) => [...prev, emptyRow(tip)]);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!isletmeId) { setError("İşletme seçimi zorunlu"); return; }
    const donemNum = Number(donem);
    if (!Number.isInteger(donemNum)) { setError("Dönem geçerli bir yıl olmalı"); return; }
    const gecerliKadrolar = kadrolar.filter((k) => k.adSoyad.trim() && k.unvan.trim());
    if (gecerliKadrolar.length === 0) { setError("En az bir kadro satırı gerekli"); return; }

    setSaving(true);
    try {
      const body = {
        isletmeId,
        sozlesmeNo,
        donem: donemNum,
        tur,
        not: not || null,
        kadrolar: gecerliKadrolar,
      };
      const res = await fetch(
        sozlesme ? `/api/rotasyon/sozlesmeler/${sozlesme.id}` : "/api/rotasyon/sozlesmeler",
        {
          method: sozlesme ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Bir hata oluştu");
        return;
      }
      onSaved(data);
    } catch {
      setError("Sunucu hatası");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {sozlesme ? "Sözleşmeyi Düzenle" : "Yeni Sözleşme"}
            </h2>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* İşletme */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">İşletme *</label>
              <select
                value={isletmeId}
                onChange={(e) => setIsletmeId(e.target.value)}
                disabled={!!sozlesme}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-60"
              >
                <option value="">— Seçiniz —</option>
                {isletmeler.map((i) => (
                  <option key={i.id} value={i.id}>{i.unvan} ({i.vkn})</option>
                ))}
              </select>
              {!sozlesme && (
                <button
                  type="button"
                  onClick={() => setShowYeniIsletme(true)}
                  className="mt-1.5 text-xs font-medium text-[#F57C28] hover:text-[#e06d1f]"
                >
                  + Yeni işletme tanımla
                </button>
              )}
            </div>

            {/* Sözleşme türü */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sözleşme Türü *</label>
              <select
                value={tur}
                onChange={(e) => setTur(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {ROTASYON_SOZLESME_TURLERI.map((t) => (
                  <option key={t} value={t}>{ROTASYON_SOZLESME_TURU_LABELS[t as RotasyonSozlesmeTuru]}</option>
                ))}
              </select>
            </div>

            {/* Sözleşme No + Dönem */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sözleşme No *</label>
                <input
                  value={sozlesmeNo}
                  onChange={(e) => setSozlesmeNo(e.target.value)}
                  required
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Dönem (Yıl) *</label>
                <input
                  type="number"
                  value={donem}
                  onChange={(e) => setDonem(e.target.value)}
                  required
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            {/* Kadro */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Kadro</label>
                <span className="text-[11px] text-gray-400">{asilCount}/3 Asıl · {yedekCount}/3 Yedek</span>
              </div>
              <div className="space-y-2">
                {kadrolar.map((row, i) => (
                  <div key={i} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/40 rounded-lg p-2">
                    <input
                      value={row.adSoyad}
                      onChange={(e) => updateRow(i, { adSoyad: e.target.value })}
                      placeholder="Ad Soyad"
                      className="flex-1 min-w-0 border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1.5 text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                    <input
                      value={row.unvan}
                      onChange={(e) => updateRow(i, { unvan: e.target.value })}
                      placeholder="Unvan"
                      className="flex-1 min-w-0 border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1.5 text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                    <select
                      value={row.tip}
                      onChange={(e) => updateRow(i, { tip: e.target.value as "ASIL" | "YEDEK" })}
                      className="border border-gray-300 dark:border-gray-600 rounded-md px-1.5 py-1.5 text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-white flex-shrink-0"
                    >
                      <option value="ASIL">Asıl</option>
                      <option value="YEDEK">Yedek</option>
                    </select>
                    <label className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400 flex-shrink-0 whitespace-nowrap" title="Fiilen görev aldı">
                      <input
                        type="checkbox"
                        checked={row.fiilenGorevAldi}
                        onChange={(e) => updateRow(i, { fiilenGorevAldi: e.target.checked })}
                        className="rounded"
                      />
                      Fiilen
                    </label>
                    <button
                      type="button"
                      onClick={() => removeRow(i)}
                      className="text-gray-400 hover:text-red-500 flex-shrink-0 p-1"
                      aria-label="Satırı kaldır"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => addRow("ASIL")}
                  disabled={asilCount >= 3}
                  className="text-xs font-medium text-[#F57C28] hover:text-[#e06d1f] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  + Asıl ekle
                </button>
                <button
                  type="button"
                  onClick={() => addRow("YEDEK")}
                  disabled={yedekCount >= 3}
                  className="text-xs font-medium text-[#F57C28] hover:text-[#e06d1f] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  + Yedek ekle
                </button>
              </div>
            </div>

            {/* Not */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Not</label>
              <textarea
                value={not}
                onChange={(e) => setNot(e.target.value)}
                rows={2}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-[#F57C28] text-white rounded-lg py-2 text-sm font-medium hover:bg-[#e06d1f] disabled:opacity-50 transition-colors"
              >
                {saving ? "Kaydediliyor..." : sozlesme ? "Güncelle" : "Oluştur"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg py-2 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                İptal
              </button>
            </div>
          </form>
        </div>
      </div>

      {showYeniIsletme && (
        <IsletmeForm
          onClose={() => setShowYeniIsletme(false)}
          onSaved={(created) => {
            onIsletmeCreated(created);
            setIsletmeId(created.id);
            setShowYeniIsletme(false);
          }}
        />
      )}
    </>
  );
}
