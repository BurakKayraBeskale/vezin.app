/**
 * Resmî Tatiller — CLIENT-SAFE saf fonksiyonlar (prisma import etmez).
 *
 * Merkezi TEK kaynak: PublicHoliday tablosu (Sistem Ayarları → Resmî Tatiller,
 * yalnız Admin yönetir). Dashboard takvimi ve izin iş günü hesabı
 * (lib/leave.ts → isGunuSayisi) aynı açılımı kullanır; ikinci bir hard-coded
 * liste YOKTUR. Veritabanı okuması: lib/holidays-data.ts.
 *
 * Tarihler tarih-yalnızdır: "YYYY-MM-DD" anahtarı, saklama UTC gece yarısı
 * (Task.dueDate ile aynı biçim).
 *
 * Her Yıl Tekrarla: kayıt bir kez girilir; ay/gün, başlangıç yılından itibaren
 * her yıl uygulanır (yıl başına satır üretilmez). Tarihi yıldan yıla değişen
 * dini bayramlar tekrarlanmaz — Admin yıl bazında ayrı kayıt girer.
 */

export const HOLIDAY_DAY_TYPES = ["FULL", "HALF"] as const;
export type HolidayDayType = (typeof HOLIDAY_DAY_TYPES)[number];

export const HOLIDAY_HALF_PERIODS = ["MORNING", "AFTERNOON"] as const;
export type HolidayHalfPeriod = (typeof HOLIDAY_HALF_PERIODS)[number];

export const HOLIDAY_DAY_TYPE_LABELS: Record<HolidayDayType, string> = {
  FULL: "Tam Gün",
  HALF: "Yarım Gün",
};

export const HOLIDAY_HALF_PERIOD_LABELS: Record<HolidayHalfPeriod, string> = {
  MORNING: "Öğleden Önce",
  AFTERNOON: "Öğleden Sonra",
};

/** Tek kaydın en fazla kaç gün sürebileceği (bayram + köprü için yeterli). */
export const HOLIDAY_MAX_SPAN_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Açılımda gereken alanlar (DB satırı veya API DTO'su). */
export interface HolidayRecord {
  id: string;
  name: string;
  startDate: Date | string;
  endDate: Date | string;
  dayType: string;
  halfDayPeriod: string | null;
  description: string | null;
  isRecurringAnnually: boolean;
  isActive: boolean;
}

/** Takvimde tek bir güne düşen tatil. */
export interface HolidayOccurrence {
  holidayId: string;
  name: string;
  /** YYYY-MM-DD */
  date: string;
  dayType: HolidayDayType;
  halfDayPeriod: HolidayHalfPeriod | null;
  description: string | null;
  isRecurringAnnually: boolean;
}

// ── Tarih anahtarları ────────────────────────────────────────────────────────

/** UTC bileşenlerinden "YYYY-MM-DD" (tarih-yalnız alanlar UTC gece yarısı saklanır). */
export function utcDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Yerel bileşenlerden "YYYY-MM-DD" (lib/leave.ts isGunuSayisi yerel gün yürür). */
export function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "YYYY-MM-DD" → UTC gece yarısı; geçersiz/var olmayan tarih (31 Şubat) → null. */
export function parseDateKey(key: string): Date | null {
  const m = DATE_KEY_RE.exec(key);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return utcDateKey(d) === key ? d : null;
}

export function addDaysKey(key: string, days: number): string {
  return utcDateKey(new Date(parseDateKey(key)!.getTime() + days * DAY_MS));
}

function toUtcMidnight(v: Date | string): Date {
  const d = new Date(v);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

// ── Açılım ───────────────────────────────────────────────────────────────────

/**
 * Aktif tatilleri [fromKey, toKey] (iki uç dahil) aralığındaki günlere açar.
 * Pasif kayıtlar hiçbir yerde (takvim / izin hesabı) kullanılmaz.
 *
 * Tekrarlayan kayıt: başlangıç yılından itibaren her yıl aynı ay/gün ve aynı
 * süre. 29 Şubat gibi o yıl var olmayan günler o yıl atlanır (1 Mart'a kaymaz).
 */
export function expandHolidays(records: HolidayRecord[], fromKey: string, toKey: string): HolidayOccurrence[] {
  const from = parseDateKey(fromKey);
  const to = parseDateKey(toKey);
  if (!from || !to || to < from) return [];

  const out: HolidayOccurrence[] = [];
  for (const h of records) {
    if (!h.isActive) continue;
    const start = toUtcMidnight(h.startDate);
    const end = toUtcMidnight(h.endDate);
    if (end < start) continue;
    const spanDays = Math.min(Math.round((end.getTime() - start.getTime()) / DAY_MS), HOLIDAY_MAX_SPAN_DAYS - 1);
    const dayType: HolidayDayType = h.dayType === "HALF" ? "HALF" : "FULL";
    const halfDayPeriod = dayType === "HALF" && (h.halfDayPeriod === "MORNING" || h.halfDayPeriod === "AFTERNOON") ? h.halfDayPeriod : null;

    const instanceStarts: Date[] = [];
    if (h.isRecurringAnnually) {
      // Aralığa değebilecek yıllar (bir önceki yıldan başlayan çok günlü tatil dahil)
      const firstYear = Math.max(start.getUTCFullYear(), from.getUTCFullYear() - 1);
      for (let y = firstYear; y <= to.getUTCFullYear(); y++) {
        const s = new Date(Date.UTC(y, start.getUTCMonth(), start.getUTCDate()));
        if (s.getUTCMonth() !== start.getUTCMonth()) continue; // 29 Şubat, artık olmayan yıl
        instanceStarts.push(s);
      }
    } else {
      instanceStarts.push(start);
    }

    for (const s of instanceStarts) {
      for (let i = 0; i <= spanDays; i++) {
        const d = new Date(s.getTime() + i * DAY_MS);
        if (d < from || d > to) continue;
        out.push({
          holidayId: h.id,
          name: h.name,
          date: utcDateKey(d),
          dayType,
          halfDayPeriod,
          description: h.description,
          isRecurringAnnually: h.isRecurringAnnually,
        });
      }
    }
  }
  out.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name, "tr"));
  return out;
}

/**
 * İzin iş günü hesabından düşülecek TAM GÜN tatil günleri.
 * Yarım gün tatiller düşülmez: LeaveRequest.days tam sayıdır (bkz. lib/leave.ts).
 */
export function fullDayHolidayKeys(occurrences: HolidayOccurrence[]): Set<string> {
  return new Set(occurrences.filter((o) => o.dayType === "FULL").map((o) => o.date));
}

/** "Tam Gün" / "Yarım Gün (Öğleden Sonra)" */
export function holidayDayTypeText(dayType: string, halfDayPeriod: string | null): string {
  if (dayType !== "HALF") return HOLIDAY_DAY_TYPE_LABELS.FULL;
  const period = halfDayPeriod === "MORNING" || halfDayPeriod === "AFTERNOON" ? HOLIDAY_HALF_PERIOD_LABELS[halfDayPeriod] : null;
  return period ? `${HOLIDAY_DAY_TYPE_LABELS.HALF} (${period})` : HOLIDAY_DAY_TYPE_LABELS.HALF;
}

// ── Doğrulama (Admin API ve form ortak) ──────────────────────────────────────

export interface HolidayInput {
  name: string;
  startDate: string;
  endDate: string;
  dayType: HolidayDayType;
  halfDayPeriod: HolidayHalfPeriod | null;
  description: string | null;
  isRecurringAnnually: boolean;
  isActive: boolean;
}

/** Gövdeyi doğrular; hata varsa { error } döner. Admin API'nin tek doğrulama kaynağı. */
export function validateHolidayInput(body: unknown): { value: HolidayInput } | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name) return { error: "Tatil adı zorunludur" };
  if (name.length > 120) return { error: "Tatil adı en fazla 120 karakter olabilir" };

  const startKey = typeof b.startDate === "string" ? b.startDate.slice(0, 10) : "";
  const endKey = typeof b.endDate === "string" && b.endDate ? b.endDate.slice(0, 10) : startKey;
  const start = parseDateKey(startKey);
  const end = parseDateKey(endKey);
  if (!start) return { error: "Geçerli bir başlangıç tarihi girin" };
  if (!end) return { error: "Geçerli bir bitiş tarihi girin" };
  if (end < start) return { error: "Bitiş tarihi başlangıçtan önce olamaz" };
  const span = Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;
  if (span > HOLIDAY_MAX_SPAN_DAYS) return { error: `Bir tatil kaydı en fazla ${HOLIDAY_MAX_SPAN_DAYS} gün sürebilir` };

  const dayType = b.dayType === "HALF" ? "HALF" : b.dayType === "FULL" || b.dayType === undefined ? "FULL" : null;
  if (!dayType) return { error: "Geçersiz gün tipi" };
  let halfDayPeriod: HolidayHalfPeriod | null = null;
  if (dayType === "HALF") {
    if (b.halfDayPeriod !== "MORNING" && b.halfDayPeriod !== "AFTERNOON") {
      return { error: "Yarım gün tatil için Öğleden Önce / Öğleden Sonra seçin" };
    }
    if (span !== 1) return { error: "Yarım gün tatil tek günlük olmalıdır" };
    halfDayPeriod = b.halfDayPeriod;
  }

  const description = typeof b.description === "string" ? b.description.trim() || null : null;
  if (description && description.length > 500) return { error: "Açıklama en fazla 500 karakter olabilir" };

  return {
    value: {
      name,
      startDate: startKey,
      endDate: endKey,
      dayType,
      halfDayPeriod,
      description,
      isRecurringAnnually: b.isRecurringAnnually === true,
      isActive: b.isActive === undefined ? true : b.isActive === true,
    },
  };
}
