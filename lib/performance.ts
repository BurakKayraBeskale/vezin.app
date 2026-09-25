/**
 * Personel Performansı — hesaplama penceresi.
 *
 * PERFORMANS_BASLANGIC'dan ÖNCEKİ dueDate'e sahip görevler performans
 * hesabına (başarı yüzdesi, zamanında/geciken sayıları) KATILMAZ. Bu tarih
 * öncesindeki görev verisi silinmez — yalnızca app/api/performance ve
 * app/api/performance/[userId] uçlarındaki hesaplama penceresi daralır.
 *
 * Tek doğru kaynak — iki uca da ayrı ayrı yazılmaz, buradan import edilir.
 */
export const PERFORMANS_BASLANGIC = new Date("2026-09-24T00:00:00.000Z");

export interface BasariOraniSonuc {
  /** Payda — zamanında + geciken görev sayısı. */
  total: number;
  /** Başarı yüzdesi (0-100). Payda 0 ise 0 döner — null DEĞİL. */
  pct: number;
}

/**
 * Başarı yüzdesi hesabı — TEK doğru kaynak. Hem GET /api/performance (liste)
 * hem GET /api/performance/[userId] (kişi dökümü) buradan geçer; ikisinin de
 * ayrı ayrı "payda 0 ise ne olsun" kararı vermesi (biri null biri farklı bir
 * şey döndürebilir) hataya açıktı — artık tek yerde.
 *
 * Payda (onTime+late) 0 ise pct=0 döner (null DEĞİL) — "%0 — 0/0" gösterimi
 * için. "Hiç görevi yok" ile "hepsini kaçırdı" karışmasın diye UI tarafı
 * bunu `total === 0` ile ayırt eder (ham onTime/total sayıları ayrıca gösterilir),
 * pct'in kendisi hep sayıdır.
 */
export function basariOrani(onTime: number, late: number): BasariOraniSonuc {
  const total = onTime + late;
  const pct = total > 0 ? Math.round((onTime / total) * 100) : 0;
  return { total, pct };
}
