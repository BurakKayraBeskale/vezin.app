/**
 * Rotasyon Takip — saf hesaplama fonksiyonları (UI'dan ve Prisma'dan bağımsız).
 *
 * Denetçi rotasyonu HESAPLANMAZ, uyarı üretmez — yalnızca bilgi amaçlıdır.
 * Buradaki tüm hesaplar İŞLETME bazlıdır (sözleşme dönemleri üzerinden).
 */

export interface RotasyonAyarlar {
  cariDonem: number;
  azamiSure: number;
  zorunluAra: number;
  uyariEsigi: number;
}

export const VARSAYILAN_ROTASYON_AYARLARI: RotasyonAyarlar = {
  cariDonem: new Date().getFullYear(),
  azamiSure: 7,
  zorunluAra: 3,
  uyariEsigi: 3,
};

export type RotasyonDurum = "NORMAL" | "UYARI" | "DOLDU" | "ARA";

export interface RotasyonHesap {
  donemler: number[];
  seriler: number[][];
  aktifSeri: number[];
  aktifSeriBaslangic: number;
  aktifSeriBitis: number;
  denetlenenSure: number;
  kalanSure: number;
  sonDenetlenebilirDonem: number;
  yenidenUstlenmeYili: number;
  durum: RotasyonDurum;
}

/** Dönemleri distinct + yıla göre sıralı liste haline getirir. */
export function distinctSortedDonemler(donemler: number[]): number[] {
  return Array.from(new Set(donemler)).sort((a, b) => a - b);
}

/**
 * Dönem listesini okunabilir aralığa çevirir: tekse yıl, kesintisizse "y0–y1",
 * aralıklıysa tüm yıllar virgülle ("2015, 2016, 2019" gibi).
 */
export function donemAraligi(donemlerRaw: number[]): string {
  const y = distinctSortedDonemler(donemlerRaw);
  if (y.length === 0) return "—";
  if (y.length === 1) return String(y[0]);
  const kesintisiz = y[y.length - 1] - y[0] + 1 === y.length;
  return kesintisiz ? `${y[0]}–${y[y.length - 1]}` : y.join(", ");
}

/**
 * Sıralı dönem listesini ardışık serilere ayırır.
 * İki dönem arasındaki boşluk >= zorunluAra ise sayaç sıfırlanır, yeni seri başlar.
 *
 * Örnek: zorunluAra=3, dönemler=[2015,2016,2017,2021,2022]
 *   → boşluk(2017→2021)=4 >= 3 → seriler: [[2015,2016,2017],[2021,2022]]
 */
export function seriler(donemlerSirali: number[], zorunluAra: number): number[][] {
  if (donemlerSirali.length === 0) return [];
  const result: number[][] = [[donemlerSirali[0]]];
  for (let i = 1; i < donemlerSirali.length; i++) {
    const prev = donemlerSirali[i - 1];
    const curr = donemlerSirali[i];
    const bosluk = curr - prev;
    if (bosluk >= zorunluAra) {
      result.push([curr]);
    } else {
      result[result.length - 1].push(curr);
    }
  }
  return result;
}

/**
 * Bir işletmenin tüm sözleşme dönemlerinden rotasyon durumunu hesaplar.
 * `donemlerRaw` boşsa (hiç sözleşme yoksa) null döner.
 *
 * @param simdikiYil ARA/DOLDU ayrımı için "şimdi" — saf fonksiyon olduğundan
 *   çağıran taraf verir (varsayılan: gerçek takvim yılı).
 */
export function hesaplaRotasyon(
  donemlerRaw: number[],
  ayar: RotasyonAyarlar,
  simdikiYil: number = new Date().getFullYear()
): RotasyonHesap | null {
  const donemler = distinctSortedDonemler(donemlerRaw);
  if (donemler.length === 0) return null;

  const tumSeriler = seriler(donemler, ayar.zorunluAra);
  const aktifSeri = tumSeriler[tumSeriler.length - 1];
  const aktifSeriBaslangic = aktifSeri[0];
  const aktifSeriBitis = aktifSeri[aktifSeri.length - 1];

  const denetlenenSure = aktifSeri.length;
  const kalanSure = ayar.azamiSure - denetlenenSure;
  const sonDenetlenebilirDonem = aktifSeriBaslangic + ayar.azamiSure - 1;
  const yenidenUstlenmeYili = aktifSeriBitis + ayar.zorunluAra + 1;

  let durum: RotasyonDurum;
  if (kalanSure > ayar.uyariEsigi) {
    durum = "NORMAL";
  } else if (kalanSure > 0) {
    durum = "UYARI";
  } else if (aktifSeriBitis < simdikiYil && simdikiYil < yenidenUstlenmeYili) {
    // Süre dolmuş; aktif seri geçmişte kaldı ve zorunlu ara penceresi içindeyiz.
    durum = "ARA";
  } else {
    durum = "DOLDU";
  }

  return {
    donemler,
    seriler: tumSeriler,
    aktifSeri,
    aktifSeriBaslangic,
    aktifSeriBitis,
    denetlenenSure,
    kalanSure,
    sonDenetlenebilirDonem,
    yenidenUstlenmeYili,
    durum,
  };
}

/**
 * Uyarı merkezi sütunu — yalnızca eylem gerektiren durumlar kategorize edilir.
 * "DOLDU" | "ARA" | "KALAN_N" (N = 1..uyariEsigi, ayarlardan dinamik).
 */
export type UyariKategori = "DOLDU" | "ARA" | `KALAN_${number}`;

export function uyariKategori(hesap: RotasyonHesap, ayar: RotasyonAyarlar): UyariKategori | null {
  if (hesap.durum === "DOLDU") return "DOLDU";
  if (hesap.durum === "ARA") return "ARA";
  if (hesap.durum === "UYARI" && hesap.kalanSure >= 1 && hesap.kalanSure <= ayar.uyariEsigi) {
    return `KALAN_${hesap.kalanSure}`;
  }
  return null; // NORMAL → eylem gerekmez; uyariEsigi dışında kalan UYARI da özet dışıdır
}

/** Uyarı merkezinin sütun sırası: Azami süre doldu, 1..uyariEsigi yıl kaldı, Ara veriliyor. */
export function uyariKategoriSirasi(uyariEsigi: number): UyariKategori[] {
  const kalanlar: UyariKategori[] = [];
  for (let r = 1; r <= uyariEsigi; r++) kalanlar.push(`KALAN_${r}`);
  return ["DOLDU", ...kalanlar, "ARA"];
}

// ── VKN / TCKN doğrulama ──────────────────────────────────────────────────────

/** VKN (10 hane) veya TCKN (11 hane) — yalnızca rakam, uzunluk kontrolü. */
export function isValidVknOrTckn(value: string): boolean {
  return /^\d{10}$|^\d{11}$/.test(value.trim());
}

// ── Sözleşme türü / kadro tipi ────────────────────────────────────────────────

export const ROTASYON_SOZLESME_TURLERI = [
  "TTK_ZORUNLU",
  "SPK_ZORUNLU",
  "IHTIYARI_TFRS",
  "GUVENCE",
  "SURDURULEBILIRLIK",
] as const;
export type RotasyonSozlesmeTuru = (typeof ROTASYON_SOZLESME_TURLERI)[number];

export const ROTASYON_SOZLESME_TURU_LABELS: Record<RotasyonSozlesmeTuru, string> = {
  TTK_ZORUNLU: "TTK — Zorunlu Denetim",
  SPK_ZORUNLU: "SPK — Zorunlu Denetim",
  IHTIYARI_TFRS: "İhtiyari Denetim (TFRS-IFRS)",
  GUVENCE: "Güvence Denetimi",
  SURDURULEBILIRLIK: "Sürdürülebilirlik Denetimi",
};

export const ROTASYON_KADRO_TIPLERI = ["ASIL", "YEDEK"] as const;
export type RotasyonKadroTipi = (typeof ROTASYON_KADRO_TIPLERI)[number];

/** Kadro formundaki unvan seçenekleri — sözleşme başına sabit 3 asıl + 3 yedek satır. */
export const ROTASYON_KADRO_UNVANLARI = [
  "Sorumlu denetçi",
  "Kıdemli denetçi",
  "Denetçi",
  "Denetçi yardımcısı",
] as const;

/** Bir sözleşmedeki kadro satırlarının kuralı: en fazla 3 ASIL + 3 YEDEK. */
export function kadroSayilariGecerliMi(kadrolar: { tip: string }[]): boolean {
  const asil = kadrolar.filter((k) => k.tip === "ASIL").length;
  const yedek = kadrolar.filter((k) => k.tip === "YEDEK").length;
  return asil <= 3 && yedek <= 3;
}

export interface RotasyonKadroInput {
  adSoyad: string;
  unvan: string;
  tip: string;
  fiilenGorevAldi: boolean;
}

/**
 * API gövdesindeki ham kadro dizisini doğrular ve Prisma create-input'una çevirir.
 * Sözleşme oluşturma/güncelleme uçlarının ikisinde de kullanılır (tek doğru kaynak).
 */
export function parseKadroInput(
  raw: unknown
): { data: RotasyonKadroInput[] } | { error: string } {
  if (!Array.isArray(raw)) return { error: "Kadro listesi gerekli" };

  const parsed: RotasyonKadroInput[] = [];
  for (const k of raw as { adSoyad?: string; unvan?: string; tip?: string; fiilenGorevAldi?: boolean }[]) {
    const adSoyad = k.adSoyad?.trim();
    const unvan = k.unvan?.trim();
    const tip = k.tip;
    if (!adSoyad || !unvan) return { error: "Her kadro satırında ad soyad ve unvan zorunlu" };
    if (!tip || !(ROTASYON_KADRO_TIPLERI as readonly string[]).includes(tip)) {
      return { error: "Geçersiz kadro tipi (ASIL veya YEDEK olmalı)" };
    }
    parsed.push({ adSoyad, unvan, tip, fiilenGorevAldi: k.fiilenGorevAldi ?? true });
  }

  if (!kadroSayilariGecerliMi(parsed)) {
    return { error: "Bir sözleşmede en fazla 3 ASIL + 3 YEDEK kadro olabilir" };
  }
  return { data: parsed };
}
