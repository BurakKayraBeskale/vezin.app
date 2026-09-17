"use client";

import { useState, FormEvent } from "react";
import type { RotasyonIsletmeRecord } from "./types";

interface Props {
  isletme?: RotasyonIsletmeRecord | null; // varsa düzenleme, yoksa oluşturma
  onClose: () => void;
  onSaved: (isletme: RotasyonIsletmeRecord) => void;
}

export default function IsletmeForm({ isletme, onClose, onSaved }: Props) {
  const [unvan, setUnvan] = useState(isletme?.unvan ?? "");
  const [vkn, setVkn] = useState(isletme?.vkn ?? "");
  const [ilkDonem, setIlkDonem] = useState(isletme?.oncekiDenetciIlkDonem?.toString() ?? "");
  const [sonDonem, setSonDonem] = useState(isletme?.oncekiDenetciSonDonem?.toString() ?? "");
  const [not, setNot] = useState(isletme?.not ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const body = {
        unvan,
        vkn,
        oncekiDenetciIlkDonem: ilkDonem ? Number(ilkDonem) : null,
        oncekiDenetciSonDonem: sonDonem ? Number(sonDonem) : null,
        not: not || null,
      };
      const res = await fetch(
        isletme ? `/api/rotasyon/isletmeler/${isletme.id}` : "/api/rotasyon/isletmeler",
        {
          method: isletme ? "PATCH" : "POST",
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isletme ? "İşletmeyi Düzenle" : "Yeni İşletme Tanımla"}
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Unvan *</label>
            <input
              value={unvan}
              onChange={(e) => setUnvan(e.target.value)}
              required
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">VKN / TCKN *</label>
            <input
              value={vkn}
              onChange={(e) => setVkn(e.target.value.replace(/\D/g, ""))}
              required
              maxLength={11}
              placeholder="10 (VKN) veya 11 (TCKN) hane"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Önceki Denetçi İlk Dönem</label>
              <input
                type="number"
                value={ilkDonem}
                onChange={(e) => setIlkDonem(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Önceki Denetçi Son Dönem</label>
              <input
                type="number"
                value={sonDonem}
                onChange={(e) => setSonDonem(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Not</label>
            <textarea
              value={not}
              onChange={(e) => setNot(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-[#F57C28] text-white rounded-lg py-2 text-sm font-medium hover:bg-[#e06d1f] disabled:opacity-50 transition-colors"
            >
              {saving ? "Kaydediliyor..." : isletme ? "Güncelle" : "Oluştur"}
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
  );
}
