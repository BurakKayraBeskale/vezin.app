-- 20260925000000_leave_carryover
-- İzin Yönetimi — birikmiş hak modeli + devir (uygulama öncesi kullanım) bakiyesi.
--
-- 1) User.carryUsedDays — uygulamaya geçmeden önce kullanılmış yıllık izin
--    günleri (firma Excel'inden devir). REAL: yarım günler var (ör. 44.5).
-- 2) İşe giriş tarihi düzeltmeleri (9) + yeni eklenenler (2) — yeni kaynak
--    dosya esas alındı. ahmetoruc / gulsengulyilmaz kaynak dosyada yok,
--    tarihlerine DOKUNULMAZ.
-- 3) carryUsedDays değerleri (33 kullanıcı). Listede olmayanlar 0 kalır.
--
-- Tümü e-posta ile eşleştirilir, isimle DEĞİL. Eşleşmeyen e-posta olursa ilgili
-- UPDATE 0 satır etkiler, hata vermez. Aynı eşleme prisma/seed.ts
-- LEAVE_DATA_MAP'te de tutulur.
--
-- NOT: Klasör adı 20260925000000_leave_soft_delete ile aynı zaman damgasını
-- taşır; alfabetik olarak ondan ÖNCE sıralanır. Yalnızca "User" tablosuna
-- dokunduğu için soft_delete ile bağımlılığı yoktur; sıfırdan kurulumda
-- sırayla çalışması sorun çıkarmaz.

-- AlterTable: User.carryUsedDays
ALTER TABLE "User" ADD COLUMN "carryUsedDays" REAL NOT NULL DEFAULT 0;

-- ── İşe giriş tarihi düzeltmeleri ─────────────────────────────────────────
UPDATE "User" SET "hireDate" = '2016-11-14T00:00:00.000Z' WHERE "email" = 'emreguvenc@vezin.com.tr';
UPDATE "User" SET "hireDate" = '2022-03-28T00:00:00.000Z' WHERE "email" = 'hasankaraagac@vezin.com.tr';
UPDATE "User" SET "hireDate" = '2022-03-28T00:00:00.000Z' WHERE "email" = 'nursatiyilmaz@vezin.com.tr';
UPDATE "User" SET "hireDate" = '2019-11-18T00:00:00.000Z' WHERE "email" = 'ahmetyasinozkul@vezin.com.tr';
UPDATE "User" SET "hireDate" = '2020-10-21T00:00:00.000Z' WHERE "email" = 'alperencoskunoglu@vezin.com.tr';
UPDATE "User" SET "hireDate" = '2021-06-23T00:00:00.000Z' WHERE "email" = 'mustafaagaherturk@vezin.com.tr';
UPDATE "User" SET "hireDate" = '2023-05-26T00:00:00.000Z' WHERE "email" = 'fatihgozyuman@vezin.com.tr';
UPDATE "User" SET "hireDate" = '2025-04-17T00:00:00.000Z' WHERE "email" = 'kadernuryesil@vezin.com.tr';
UPDATE "User" SET "hireDate" = '2022-09-19T00:00:00.000Z' WHERE "email" = 'bugrahanbozkurt@vezin.com.tr';

-- ── Yeni eklenen işe giriş tarihleri ──────────────────────────────────────
UPDATE "User" SET "hireDate" = '2026-02-02T00:00:00.000Z' WHERE "email" = 'fatmanurarslan@vezin.com.tr';
UPDATE "User" SET "hireDate" = '2025-06-17T00:00:00.000Z' WHERE "email" = 'berkkaranfil@vezin.com.tr';

-- ── Devir: uygulama öncesi kullanılan yıllık izin günleri ─────────────────
UPDATE "User" SET "carryUsedDays" = 142   WHERE "email" = 'emreguvenc@vezin.com.tr';
UPDATE "User" SET "carryUsedDays" = 143   WHERE "email" = 'ebubekirozturk@vezin.com.tr';
UPDATE "User" SET "carryUsedDays" = 31.5  WHERE "email" = 'muratozgur@vezin.com.tr';
UPDATE "User" SET "carryUsedDays" = 104   WHERE "email" = 'sedazincirkara@vezin.com.tr';
UPDATE "User" SET "carryUsedDays" = 81.5  WHERE "email" = 'ahmetyasinozkul@vezin.com.tr';
UPDATE "User" SET "carryUsedDays" = 64.5  WHERE "email" = 'alperencoskunoglu@vezin.com.tr';
UPDATE "User" SET "carryUsedDays" = 59.5  WHERE "email" = 'mustafaagaherturk@vezin.com.tr';
UPDATE "User" SET "carryUsedDays" = 44.5  WHERE "email" = 'nursatiyilmaz@vezin.com.tr';
UPDATE "User" SET "carryUsedDays" = 49    WHERE "email" = 'hasankaraagac@vezin.com.tr';
UPDATE "User" SET "carryUsedDays" = 52    WHERE "email" = 'bugrahanbozkurt@vezin.com.tr';
UPDATE "User" SET "carryUsedDays" = 32.5  WHERE "email" = 'fatihgozyuman@vezin.com.tr';
UPDATE "User" SET "carryUsedDays" = 44.5  WHERE "email" = 'seymagungor@vezin.com.tr';
UPDATE "User" SET "carryUsedDays" = 46    WHERE "email" = 'filizodogan@vezin.com.tr';
UPDATE "User" SET "carryUsedDays" = 33.5  WHERE "email" = 'meryemengin@vezin.com.tr';
UPDATE "User" SET "carryUsedDays" = 41    WHERE "email" = 'tunahankocaoglu@vezin.com.tr';
UPDATE "User" SET "carryUsedDays" = 16.5  WHERE "email" = 'oguzcetin@vezin.com.tr';
UPDATE "User" SET "carryUsedDays" = 22    WHERE "email" = 'tahabolek@vezin.com.tr';
UPDATE "User" SET "carryUsedDays" = 30    WHERE "email" = 'esrafirat@vezin.com.tr';
UPDATE "User" SET "carryUsedDays" = 16.5  WHERE "email" = 'selinkotan@vezin.com.tr';
UPDATE "User" SET "carryUsedDays" = 23    WHERE "email" = 'kerimdogan@vezin.com.tr';
UPDATE "User" SET "carryUsedDays" = 36.5  WHERE "email" = 'asenaobay@vezin.com.tr';
UPDATE "User" SET "carryUsedDays" = 31    WHERE "email" = 'efecanguvenir@vezin.com.tr';
UPDATE "User" SET "carryUsedDays" = 23.5  WHERE "email" = 'sitkikandazoglu@vezin.com.tr';
UPDATE "User" SET "carryUsedDays" = 21    WHERE "email" = 'alimertyilmaz@vezin.com.tr';
UPDATE "User" SET "carryUsedDays" = 15.5  WHERE "email" = 'kadernuryesil@vezin.com.tr';
UPDATE "User" SET "carryUsedDays" = 17.5  WHERE "email" = 'berkkaranfil@vezin.com.tr';
UPDATE "User" SET "carryUsedDays" = 26    WHERE "email" = 'jansetturkoglu@vezin.com.tr';
UPDATE "User" SET "carryUsedDays" = 25.5  WHERE "email" = 'merveucan@vezin.com.tr';
UPDATE "User" SET "carryUsedDays" = 28    WHERE "email" = 'elifdemirci@vezin.com.tr';
UPDATE "User" SET "carryUsedDays" = 12    WHERE "email" = 'muhammedergurum@vezin.com.tr';
UPDATE "User" SET "carryUsedDays" = 2     WHERE "email" = 'fatmanurarslan@vezin.com.tr';
UPDATE "User" SET "carryUsedDays" = 10    WHERE "email" = 'zeynepyanik@vezin.com.tr';
UPDATE "User" SET "carryUsedDays" = 6     WHERE "email" = 'ozlemince@vezin.com.tr';
