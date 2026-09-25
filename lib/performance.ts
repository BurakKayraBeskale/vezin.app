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
