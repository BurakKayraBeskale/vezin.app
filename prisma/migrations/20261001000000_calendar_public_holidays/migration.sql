-- 20261001000000_calendar_public_holidays
-- Dashboard B bloğu: Akıllı Takvim + merkezi Resmî Tatiller. ELLE yazıldı —
-- yalnız EKLER (yeni sütun, yeni tablo, indeks, başlangıç verisi); mevcut
-- tablo yeniden kurulmaz, mevcut veri değişmez.

-- 1) Görev: planlanan başlangıç tarihi (opsiyonel). Mevcut görevlerde NULL kalır.
-- AlterTable
ALTER TABLE "Task" ADD COLUMN "startDate" DATETIME;

-- 2) Resmî Tatiller — Sistem Ayarları'ndan yalnız Admin yönetir.
-- CreateTable
CREATE TABLE "PublicHoliday" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "dayType" TEXT NOT NULL DEFAULT 'FULL',
    "halfDayPeriod" TEXT,
    "description" TEXT,
    "isRecurringAnnually" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PublicHoliday_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PublicHoliday_startDate_idx" ON "PublicHoliday"("startDate");

-- 3) Başlangıç verisi: sabit tarihli ulusal tatiller (Her Yıl Tekrarla, 2026'dan
-- itibaren). Eski components/DashboardCalendar.tsx içindeki hard-coded liste bu
-- tabloya taşındı; tarihi değişen dini bayramlar Admin tarafından yıl bazında
-- eklenir. Tarihler tarih-yalnız: UTC gece yarısı, epoch ms (Prisma SQLite biçimi).
-- Admin bu kayıtları Sistem Ayarları → Resmî Tatiller'den düzenleyebilir / pasife alabilir.
INSERT INTO "PublicHoliday" ("id", "name", "startDate", "endDate", "dayType", "halfDayPeriod", "isRecurringAnnually", "isActive", "updatedAt") VALUES
('seed_holiday_0101', 'Yılbaşı', 1767225600000, 1767225600000, 'FULL', NULL, 1, 1, 1790812800000),
('seed_holiday_0423', 'Ulusal Egemenlik ve Çocuk Bayramı', 1776902400000, 1776902400000, 'FULL', NULL, 1, 1, 1790812800000),
('seed_holiday_0501', 'Emek ve Dayanışma Günü', 1777593600000, 1777593600000, 'FULL', NULL, 1, 1, 1790812800000),
('seed_holiday_0519', 'Atatürk''ü Anma, Gençlik ve Spor Bayramı', 1779148800000, 1779148800000, 'FULL', NULL, 1, 1, 1790812800000),
('seed_holiday_0715', 'Demokrasi ve Millî Birlik Günü', 1784073600000, 1784073600000, 'FULL', NULL, 1, 1, 1790812800000),
('seed_holiday_0830', 'Zafer Bayramı', 1788048000000, 1788048000000, 'FULL', NULL, 1, 1, 1790812800000),
('seed_holiday_1028', 'Cumhuriyet Bayramı Arifesi', 1793145600000, 1793145600000, 'HALF', 'AFTERNOON', 1, 1, 1790812800000),
('seed_holiday_1029', 'Cumhuriyet Bayramı', 1793232000000, 1793232000000, 'FULL', NULL, 1, 1, 1790812800000);
