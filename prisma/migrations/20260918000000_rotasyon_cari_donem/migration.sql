-- Rotasyon ayarlarına "cari hesap dönemi" alanı ekler.
-- Referans arayüzdeki Ayarlar modalı bunu ayrı, kullanıcı tarafından
-- ayarlanabilir bir alan olarak bekliyor — gerçek takvim yılından bağımsız
-- (ör. mali yıl kayması olan durumlar için). ARA/DOLDU ayrımı ve "yıl planı"
-- artık bu alana göre hesaplanır.

-- AlterTable
ALTER TABLE "RotasyonAyar" ADD COLUMN "cariDonem" INTEGER NOT NULL DEFAULT 2026;
