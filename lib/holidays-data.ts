/**
 * Resmî Tatiller — sunucu tarafı okuma (prisma). Saf açılım: lib/holidays.ts.
 * Dashboard takvimi, izin talebi gün hesabı ve /api/holidays aynı fonksiyonu kullanır.
 */

import { prisma } from "@/lib/prisma";
import {
  HOLIDAY_MAX_SPAN_DAYS,
  addDaysKey,
  expandHolidays,
  fullDayHolidayKeys,
  parseDateKey,
  type HolidayOccurrence,
} from "@/lib/holidays";

export const holidaySelect = {
  id: true,
  name: true,
  startDate: true,
  endDate: true,
  dayType: true,
  halfDayPeriod: true,
  description: true,
  isRecurringAnnually: true,
  isActive: true,
} as const;

/** [fromKey, toKey] (dahil) aralığındaki aktif tatil günleri. */
export async function loadHolidayOccurrences(fromKey: string, toKey: string): Promise<HolidayOccurrence[]> {
  const from = parseDateKey(fromKey);
  const to = parseDateKey(toKey);
  if (!from || !to || to < from) return [];
  // Tekrarlayanlar her zaman aday; tekil kayıtlar yalnız aralıkla kesişenler
  // (bir tatil en fazla HOLIDAY_MAX_SPAN_DAYS sürer → başlangıç alt sınırı).
  const rows = await prisma.publicHoliday.findMany({
    where: {
      isActive: true,
      OR: [
        { isRecurringAnnually: true },
        { startDate: { lte: to, gte: parseDateKey(addDaysKey(fromKey, -HOLIDAY_MAX_SPAN_DAYS))! }, endDate: { gte: from } },
      ],
    },
    select: holidaySelect,
  });
  return expandHolidays(rows, fromKey, toKey);
}

/** İzin iş günü hesabında düşülecek tam gün tatiller (lib/leave.ts → isGunuSayisi). */
export async function loadFullDayHolidayKeys(fromKey: string, toKey: string): Promise<Set<string>> {
  return fullDayHolidayKeys(await loadHolidayOccurrences(fromKey, toKey));
}

// ── Admin yönetimi ───────────────────────────────────────────────────────────

/**
 * Resmî Tatiller yönetim kapısı — yalnız AKTİF ADMIN. Rol oturumdan değil
 * DB'den okunur (bayat JWT ile yetki kalmasın). Middleware /api/admin'i
 * korumaz (yalnız /admin sayfalarını); her uç bu kapıyı kendisi çağırır.
 */
export async function loadHolidayAdmin(sessionUserId: string | undefined): Promise<{ id: string } | null> {
  if (!sessionUserId) return null;
  const u = await prisma.user.findUnique({ where: { id: sessionUserId }, select: { id: true, role: true, status: true } });
  return u && u.role === "ADMIN" && u.status === "ACTIVE" ? { id: u.id } : null;
}

export const holidayAdminSelect = {
  ...holidaySelect,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, name: true } },
} as const;

/**
 * Admin listesi. year verilirse: o yıl içinde başlayan kayıtlar + başlangıç yılı
 * ≤ year olan tekrarlayan kayıtlar (o yıl da uygulanır).
 */
export async function listHolidaysForAdmin(year: number | null) {
  const where = year
    ? {
        OR: [
          { startDate: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) } },
          { isRecurringAnnually: true, startDate: { lt: new Date(Date.UTC(year + 1, 0, 1)) } },
        ],
      }
    : {};
  const rows = await prisma.publicHoliday.findMany({ where, select: holidayAdminSelect, orderBy: { startDate: "asc" } });
  // Seçili yılda gerçekleşeceği güne göre sırala (tekrarlayanlar ay/güne göre araya girer)
  const sortKey = (r: (typeof rows)[number]) =>
    year && r.isRecurringAnnually ? `${year}${r.startDate.toISOString().slice(4, 10)}` : r.startDate.toISOString().slice(0, 10);
  return rows.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
}
