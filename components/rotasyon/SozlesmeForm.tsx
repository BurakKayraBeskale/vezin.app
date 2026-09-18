"use client";

import { useState, useMemo, FormEvent } from "react";
import {
  ROTASYON_SOZLESME_TURLERI,
  ROTASYON_SOZLESME_TURU_LABELS,
  ROTASYON_KADRO_UNVANLARI,
  hesaplaRotasyon,
  donemAraligi,
  type RotasyonSozlesmeTuru,
  type RotasyonAyarlar,
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
  kaynakDonem: number;
}

interface Props {
  isletmeler: RotasyonIsletmeRecord[];
  ayar: RotasyonAyarlar;
  sozlesme?: RotasyonSozlesmeRecord | null; // varsa düzenleme
  prefill?: Prefill | null; // "Yeni dönem" — oluşturma, önceden doldurulmuş
  defaultIsletmeId?: string;
  onClose: () => void;
  onSaved: (sozlesme: RotasyonSozlesmeRecord) => void;
  onIsletmeCreated: (isletme: RotasyonIsletmeRecord) => void;
}

const YENI = "__yeni__";

function bosRows(kind: "ASIL" | "YEDEK"): KadroRow[] {
  return [0, 1, 2].map(() => ({ adSoyad: "", unvan: ROTASYON_KADRO_UNVANLARI[2], tip: kind, fiilenGorevAldi: kind === "ASIL" }));
}

export default function SozlesmeForm({
  isletmeler, ayar, sozlesme, prefill, defaultIsletmeId, onClose, onSaved, onIsletmeCreated,
}: Props) {
  const [isletmeId, setIsletmeId] = useState(sozlesme?.isletmeId ?? prefill?.isletmeId ?? defaultIsletmeId ?? "");
  const [sozlesmeNo, setSozlesmeNo] = useState(sozlesme?.sozlesmeNo ?? "");
  const [donem, setDonem] = useState(sozlesme?.donem ?? prefill?.donem ?? ayar.cariDonem);
  const [tur, setTur] = useState<string>(sozlesme?.tur ?? prefill?.tur ?? ROTASYON_SOZLESME_TURLERI[0]);
  const [not, setNot] = useState(sozlesme?.not ?? "");
  const [kaynakDonem, setKaynakDonem] = useState<number | null>(prefill?.kaynakDonem ?? null);

  const initialAsil = useMemo(() => {
    const rows = bosRows("ASIL");
    const kaynak = sozlesme?.kadrolar ?? prefill?.kadrolar ?? [];
    kaynak.filter((k) => k.tip === "ASIL").forEach((k, i) => { if (rows[i]) rows[i] = { ...k, tip: "ASIL" }; });
    return rows;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const initialYedek = useMemo(() => {
    const rows = bosRows("YEDEK");
    const kaynak = sozlesme?.kadrolar ?? prefill?.kadrolar ?? [];
    kaynak.filter((k) => k.tip === "YEDEK").forEach((k, i) => { if (rows[i]) rows[i] = { ...k, tip: "YEDEK" }; });
    return rows;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [asilRows, setAsilRows] = useState<KadroRow[]>(initialAsil);
  const [yedekRows, setYedekRows] = useState<KadroRow[]>(initialYedek);
  const [showYeniIsletme, setShowYeniIsletme] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function updateAsil(i: number, patch: Partial<KadroRow>) {
    setAsilRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function updateYedek(i: number, patch: Partial<KadroRow>) {
    setYedekRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  const secilenIsletme = isletmeler.find((i) => i.id === isletmeId) ?? null;
  const duzenlenenId = sozlesme?.id ?? null;

  // Sözleşme türü + kadroyu seçilen işletmenin son döneminden doldurur (yalnızca oluşturma, işletme değişince)
  function isletmeDegisti(yeniId: string) {
    setIsletmeId(yeniId);
    setKaynakDonem(null);
    if (duzenlenenId) return; // düzenlemede otomatik doldurma yok
    const isl = isletmeler.find((i) => i.id === yeniId);
    const sonSozlesme = isl ? [...isl.sozlesmeler].sort((a, b) => b.donem - a.donem)[0] : null;
    if (!sonSozlesme) {
      setDonem(ayar.cariDonem);
      setAsilRows(bosRows("ASIL"));
      setYedekRows(bosRows("YEDEK"));
      return;
    }
    setDonem(Math.min(sonSozlesme.donem + 1, ayar.cariDonem + 2));
    setTur(sonSozlesme.tur);
    const asil = bosRows("ASIL");
    sonSozlesme.kadrolar.filter((k) => k.tip === "ASIL").forEach((k, i) => { if (asil[i]) asil[i] = { adSoyad: k.adSoyad, unvan: k.unvan, tip: "ASIL", fiilenGorevAldi: k.fiilenGorevAldi }; });
    const yedek = bosRows("YEDEK");
    sonSozlesme.kadrolar.filter((k) => k.tip === "YEDEK").forEach((k, i) => { if (yedek[i]) yedek[i] = { adSoyad: k.adSoyad, unvan: k.unvan, tip: "YEDEK", fiilenGorevAldi: k.fiilenGorevAldi }; });
    setAsilRows(asil);
    setYedekRows(yedek);
    setKaynakDonem(sonSozlesme.donem);
  }

  // Yıl seçeneği: cari dönem - 15 .. cari dönem + 2, azalan — düzenlenen kaydın
  // dönemi bu aralığın dışındaysa (eski tarihli kayıt) yine de listeye eklenir.
  const yilSecenekleri = useMemo(() => {
    const arr: number[] = [];
    for (let y = ayar.cariDonem + 2; y >= ayar.cariDonem - 15; y--) arr.push(y);
    if (!arr.includes(donem)) {
      arr.push(donem);
      arr.sort((a, b) => b - a);
    }
    return arr;
  }, [ayar.cariDonem, donem]);

  // Firma özeti kutusu
  const firmaOzeti = useMemo(() => {
    if (!isletmeId) {
      if (isletmeler.length === 0) {
        return { tip: "uyari" as const, text: 'Henüz tanımlı işletme yok. Listeden "+ Yeni işletme tanımla…" seçeneğiyle işletmeyi tanımlayın; kayıttan sonra bu forma geri dönülür.' };
      }
      return null;
    }
    if (!secilenIsletme) return null;
    const hesap = hesaplaRotasyon(secilenIsletme.sozlesmeler.map((s) => s.donem), ayar, ayar.cariDonem);
    const kopyaNotu = !duzenlenenId && kaynakDonem != null ? `Sözleşme türü ve kadro ${kaynakDonem} döneminden getirildi — gerekiyorsa değiştirin.` : null;
    if (!hesap) {
      return { tip: "normal" as const, text: "Bu işletme için henüz kayıtlı dönem yok. Bu sözleşme 1. dönem olacak.", kopyaNotu };
    }
    const sira = duzenlenenId ? hesap.denetlenenSure : hesap.denetlenenSure + 1;
    const durumLabel =
      hesap.durum === "DOLDU" ? "Azami süre doldu" :
      hesap.durum === "ARA" ? `Ara veriliyor · ${hesap.yenidenUstlenmeYili}'den itibaren` :
      `${hesap.kalanSure} yıl kaldı`;
    const siraMetni = duzenlenenId ? "" : ` · bu kayıt ${sira}. dönem olacak`;
    return {
      tip: "normal" as const,
      text: `Kayıtlı dönemler: ${donemAraligi(secilenIsletme.sozlesmeler.map((s) => s.donem))} · toplam ${hesap.denetlenenSure} / ${ayar.azamiSure} dönem${siraMetni} — ${durumLabel}`,
      kopyaNotu,
    };
  }, [isletmeId, secilenIsletme, isletmeler.length, ayar, duzenlenenId, kaynakDonem]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!isletmeId) { setError("Denetlenen işletmeyi seçin."); return; }
    const gecerliKadrolar = [...asilRows, ...yedekRows].filter((k) => k.adSoyad.trim());
    if (gecerliKadrolar.length === 0) { setError("En az bir kadro satırı gerekli."); return; }

    setSaving(true);
    try {
      const body = {
        isletmeId,
        sozlesmeNo,
        donem,
        tur,
        not: not || null,
        kadrolar: gecerliKadrolar.map((k) => ({ adSoyad: k.adSoyad.trim(), unvan: k.unvan, tip: k.tip, fiilenGorevAldi: k.fiilenGorevAldi })),
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

  const baslik = sozlesme
    ? "Sözleşmeyi düzenle"
    : prefill
    ? `Yeni dönem — ${secilenIsletme?.unvan ?? ""}`
    : "Sözleşme dönemi ekle";

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{baslik}</h2>
            <p className="text-xs text-gray-400 mt-1">Tek bir hesap dönemini kaydeder. Rotasyon süresi işletme kartında toplanır.</p>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* İşletme */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Denetlenen işletme</label>
              <select
                value={isletmeId}
                onChange={(e) => {
                  if (e.target.value === YENI) { setShowYeniIsletme(true); return; }
                  isletmeDegisti(e.target.value);
                }}
                disabled={!!sozlesme}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-60"
              >
                <option value="">— işletme seçin —</option>
                {[...isletmeler].sort((a, b) => a.unvan.localeCompare(b.unvan, "tr")).map((i) => (
                  <option key={i.id} value={i.id}>{i.unvan}</option>
                ))}
                {!sozlesme && <option value={YENI}>+ Yeni işletme tanımla…</option>}
              </select>
            </div>

            {/* Firma özeti */}
            {firmaOzeti && (
              <div className={
                "rounded-lg px-3 py-2.5 text-xs -mt-1 " +
                (firmaOzeti.tip === "uyari"
                  ? "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300"
                  : "bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300")
              }>
                <p>{firmaOzeti.text}</p>
                {"kopyaNotu" in firmaOzeti && firmaOzeti.kopyaNotu && (
                  <p className="mt-1.5 pt-1.5 border-t border-gray-200 dark:border-gray-700 text-blue-600 dark:text-blue-400">{firmaOzeti.kopyaNotu}</p>
                )}
              </div>
            )}

            {/* Sözleşme türü */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sözleşme türü</label>
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sözleşme numarası</label>
                <input
                  value={sozlesmeNo}
                  onChange={(e) => setSozlesmeNo(e.target.value)}
                  required
                  placeholder="Örn. 2026/014"
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hesap dönemi</label>
                <select
                  value={donem}
                  onChange={(e) => setDonem(Number(e.target.value))}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {yilSecenekleri.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>

            {/* Kadro */}
            <div>
              <div className="text-sm font-semibold text-gray-800 dark:text-gray-100 pt-2 pb-1.5 mt-2 border-b border-gray-200 dark:border-gray-700">Asıl kadro</div>
              <div className="space-y-1.5 mt-2">
                {asilRows.map((row, i) => (
                  <KadroSatiri key={i} idx={i} row={row} onChange={(patch) => updateAsil(i, patch)} />
                ))}
              </div>
              <div className="text-sm font-semibold text-gray-800 dark:text-gray-100 pt-2 pb-1.5 mt-3 border-b border-gray-200 dark:border-gray-700">Yedek kadro</div>
              <div className="space-y-1.5 mt-2">
                {yedekRows.map((row, i) => (
                  <KadroSatiri key={i} idx={i} row={row} onChange={(patch) => updateYedek(i, patch)} />
                ))}
              </div>
            </div>

            {/* Not */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Not</label>
              <textarea
                value={not}
                onChange={(e) => setNot(e.target.value)}
                rows={2}
                placeholder="İç notlar..."
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
              />
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
                Vazgeç
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
            isletmeDegisti(created.id);
            setShowYeniIsletme(false);
          }}
        />
      )}
    </>
  );
}

function KadroSatiri({ idx, row, onChange }: { idx: number; row: KadroRow; onChange: (patch: Partial<KadroRow>) => void }) {
  return (
    <div className="grid grid-cols-[18px_1fr_130px_auto] gap-2 items-center">
      <span className="font-mono text-[11px] text-gray-400">{idx + 1}</span>
      <input
        value={row.adSoyad}
        onChange={(e) => onChange({ adSoyad: e.target.value })}
        placeholder={`${row.tip === "ASIL" ? "Asıl" : "Yedek"} kadro ${idx + 1} — ad soyad`}
        className="min-w-0 border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1.5 text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
      />
      <select
        value={row.unvan}
        onChange={(e) => onChange({ unvan: e.target.value })}
        className="border border-gray-300 dark:border-gray-600 rounded-md px-1.5 py-1.5 text-[11px] bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
      >
        {ROTASYON_KADRO_UNVANLARI.map((u) => <option key={u} value={u}>{u}</option>)}
      </select>
      <label className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400 flex-shrink-0 whitespace-nowrap" title="Fiilen görev aldı">
        <input
          type="checkbox"
          checked={row.fiilenGorevAldi}
          onChange={(e) => onChange({ fiilenGorevAldi: e.target.checked })}
          className="rounded"
        />
        fiilen görev aldı
      </label>
    </div>
  );
}
