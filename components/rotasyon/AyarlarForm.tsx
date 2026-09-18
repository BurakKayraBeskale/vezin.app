"use client";

import { useState, FormEvent } from "react";
import type { RotasyonAyarlar } from "@/lib/rotasyon";

interface Props {
  ayar: RotasyonAyarlar;
  onClose: () => void;
  onSaved: (ayar: RotasyonAyarlar) => void;
}

export default function AyarlarForm({ ayar, onClose, onSaved }: Props) {
  const [cariDonem, setCariDonem] = useState(String(ayar.cariDonem));
  const [azamiSure, setAzamiSure] = useState(String(ayar.azamiSure));
  const [zorunluAra, setZorunluAra] = useState(String(ayar.zorunluAra));
  const [uyariEsigi, setUyariEsigi] = useState(String(ayar.uyariEsigi));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const body = {
        cariDonem: Number(cariDonem),
        azamiSure: Number(azamiSure),
        zorunluAra: Number(zorunluAra),
        uyariEsigi: Number(uyariEsigi),
      };
      const res = await fetch("/api/rotasyon/ayarlar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Bir hata oluştu");
        return;
      }
      onSaved({
        cariDonem: data.cariDonem,
        azamiSure: data.azamiSure,
        zorunluAra: data.zorunluAra,
        uyariEsigi: data.uyariEsigi,
      });
    } catch {
      setError("Sunucu hatası");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Ayarlar</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cari hesap dönemi</label>
              <input
                type="number"
                value={cariDonem}
                onChange={(e) => setCariDonem(e.target.value)}
                required
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Azami süre (yıl)</label>
              <input
                type="number"
                value={azamiSure}
                onChange={(e) => setAzamiSure(e.target.value)}
                required
                min={1}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Zorunlu ara (yıl)</label>
              <input
                type="number"
                value={zorunluAra}
                onChange={(e) => setZorunluAra(e.target.value)}
                required
                min={0}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kaç yıl kala uyarı verilsin</label>
            <select
              value={uyariEsigi}
              onChange={(e) => setUyariEsigi(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>{n} yıl kala</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">Aynı eşik hem kuruluş hem denetçi rotasyonu için geçerlidir.</p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-[#F57C28] text-white rounded-lg py-2 text-sm font-medium hover:bg-[#e06d1f] disabled:opacity-50 transition-colors"
            >
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg py-2 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Kapat
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
