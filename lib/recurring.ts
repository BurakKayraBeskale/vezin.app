/**
 * Tekrarlayan görev yardımcıları — D BLOĞU
 *
 * Dönem hesaplamaları ve seri durumu kontrolleri.
 */

/**
 * Bir dönemden sonraki tetikleme tarihini hesaplar.
 *
 * recurringDay:
 *   WEEKLY  → 0=Pzt, 1=Sal, 2=Çar, 3=Per, 4=Cum, 5=Cmt, 6=Paz
 *   MONTHLY → 1–31 (ayın günü; son geçerli güne sınırlanır)
 */
export function computeNextOccurrence(
  from: Date,
  type: string,
  day?: number | null
): Date {
  const next = new Date(from);

  switch (type) {
    case "DAILY":
      next.setDate(next.getDate() + 1);
      break;

    case "WEEKLY": {
      // recurringDay 0=Mon … 6=Sun → JS 1=Mon … 0=Sun
      const targetJS = day != null ? (day + 1) % 7 : next.getDay();
      next.setDate(next.getDate() + 1); // en az 1 gün ilerlet
      while (next.getDay() !== targetJS) {
        next.setDate(next.getDate() + 1);
      }
      break;
    }

    case "MONTHLY": {
      const targetDay = day ?? next.getDate();
      next.setMonth(next.getMonth() + 1, 1); // ayın 1'ine git
      const daysInMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      next.setDate(Math.min(targetDay, daysInMonth));
      break;
    }

    case "YEARLY":
      next.setFullYear(next.getFullYear() + 1);
      break;

    default:
      next.setDate(next.getDate() + 1);
  }

  return next;
}

/**
 * Serinin bir sonraki tekrar üretip üretmemesi gerektiğini kontrol eder.
 * isStopped ise veya endType=SPECIFIC_DATE ve endDate geçmişse → false
 */
export function seriesShouldGenerate(series: {
  isStopped: boolean;
  endType: string;
  endDate?: Date | null;
  nextOccurrenceAt: Date;
}): boolean {
  if (series.isStopped) return false;
  if (series.endType === "SPECIFIC_DATE" && series.endDate) {
    if (series.nextOccurrenceAt > series.endDate) return false;
  }
  return true;
}

/**
 * 1 yıl sonraki retention bitiş tarihini hesaplar.
 */
export function computeRetentionUntil(completedAt: Date): Date {
  const d = new Date(completedAt);
  d.setFullYear(d.getFullYear() + 1);
  return d;
}
