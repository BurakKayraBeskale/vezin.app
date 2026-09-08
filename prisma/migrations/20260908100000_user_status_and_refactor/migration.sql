-- Kullanıcı durum alanı: ACTIVE | INACTIVE | DELETED
ALTER TABLE "User" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';

-- MANAGER rolü kaldırılıyor → EMPLOYEE'ye geçiş
UPDATE "User" SET "role" = 'EMPLOYEE' WHERE "role" = 'MANAGER';

-- ── Kıdem seviyelerini yeni 14-seviyeli sisteme güncelle ──────────────────
-- Yalnızca tanınan unvanlı kayıtlar güncellenir; boş unvanlı kayıtlar atlanır.
-- YMM unvanı Partner'a taşınır (level: 14).
UPDATE "User" SET "title" = 'Partner', "seniorityLevel" = 14 WHERE "title" = 'YMM';
UPDATE "User" SET "seniorityLevel" = 1  WHERE "title" = 'Stajyer';
UPDATE "User" SET "seniorityLevel" = 2  WHERE "title" IN ('Assistant', 'Asistant');
UPDATE "User" SET "seniorityLevel" = 3  WHERE "title" = 'Experienced Assistant 1';
UPDATE "User" SET "seniorityLevel" = 4  WHERE "title" IN ('Experienced Assistant 2', 'Experienced Audit Assistant 1');
UPDATE "User" SET "seniorityLevel" = 5  WHERE "title" = 'Senior 1';
UPDATE "User" SET "seniorityLevel" = 6  WHERE "title" = 'Senior 2';
UPDATE "User" SET "seniorityLevel" = 7  WHERE "title" IN ('Assistant Manager', 'Asistant Manager');
UPDATE "User" SET "seniorityLevel" = 8  WHERE "title" = 'Manager 1';
UPDATE "User" SET "seniorityLevel" = 9  WHERE "title" = 'Manager 2';
UPDATE "User" SET "seniorityLevel" = 10 WHERE "title" = 'Manager 3';
UPDATE "User" SET "seniorityLevel" = 11 WHERE "title" = 'Senior Manager 1';
UPDATE "User" SET "seniorityLevel" = 12 WHERE "title" = 'Senior Manager 2';
UPDATE "User" SET "seniorityLevel" = 13 WHERE "title" = 'Senior Manager 3';
UPDATE "User" SET "seniorityLevel" = 14 WHERE "title" = 'Partner';
