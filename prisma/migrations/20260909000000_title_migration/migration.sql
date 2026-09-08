-- Eski unvan adlarını yeni 14-seviyeli sisteme çevir (hem title hem seniorityLevel)
-- Boş unvanlı (title = '') kayıtlara DOKUNULMAZ.

-- ── 1. Adı yanlış/eski olan unvanları yeniden adlandır ve seviyeyi düzelt ──
UPDATE "User" SET "title" = 'Assistant',               "seniorityLevel" = 2  WHERE "title" = 'Asistant';
UPDATE "User" SET "title" = 'Experienced Assistant 1', "seniorityLevel" = 3  WHERE "title" = 'Experienced Audit Assistant 1';
UPDATE "User" SET "title" = 'Assistant Manager',        "seniorityLevel" = 7  WHERE "title" = 'Asistant Manager';

-- ── 2. Unvanı zaten doğru, seniorityLevel eksik/yanlış olabilecek tüm kayıtlar ──
UPDATE "User" SET "title" = 'Assistant',               "seniorityLevel" = 2  WHERE "title" = 'Assistant';
UPDATE "User" SET "title" = 'Experienced Assistant 1', "seniorityLevel" = 3  WHERE "title" = 'Experienced Assistant 1';
UPDATE "User" SET "title" = 'Experienced Assistant 2', "seniorityLevel" = 4  WHERE "title" = 'Experienced Assistant 2';
UPDATE "User" SET "title" = 'Senior 1',                "seniorityLevel" = 5  WHERE "title" = 'Senior 1';
UPDATE "User" SET "title" = 'Senior 2',                "seniorityLevel" = 6  WHERE "title" = 'Senior 2';
UPDATE "User" SET "title" = 'Assistant Manager',        "seniorityLevel" = 7  WHERE "title" = 'Assistant Manager';
UPDATE "User" SET "title" = 'Manager 1',               "seniorityLevel" = 8  WHERE "title" = 'Manager 1';
UPDATE "User" SET "title" = 'Manager 2',               "seniorityLevel" = 9  WHERE "title" = 'Manager 2';
UPDATE "User" SET "title" = 'Manager 3',               "seniorityLevel" = 10 WHERE "title" = 'Manager 3';
UPDATE "User" SET "title" = 'Senior Manager 1',        "seniorityLevel" = 11 WHERE "title" = 'Senior Manager 1';
UPDATE "User" SET "title" = 'Senior Manager 2',        "seniorityLevel" = 12 WHERE "title" = 'Senior Manager 2';
UPDATE "User" SET "title" = 'Senior Manager 3',        "seniorityLevel" = 13 WHERE "title" = 'Senior Manager 3';
UPDATE "User" SET "title" = 'Partner',                 "seniorityLevel" = 14 WHERE "title" = 'Partner';
