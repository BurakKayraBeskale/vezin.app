-- İzin Yönetimi modülü — şema genişletmesi + işe giriş tarihi verisi.
--
-- 1) User.hireDate — izin hakkı hesabı (İş Kanunu md.53) için.
-- 2) LeaveRequest.reviewedAt / reviewNote / updatedAt — onay/ret akışı.
-- 3) LeaveAttachment (yeni tablo) — izin talebi ek dosyaları (mevcut dosya
--    yükleme desenine uygun: blob DB'de tutulmaz, yalnızca storageKey).
-- 4) E-posta eşleştirmeli işe giriş tarihi UPDATE'leri (32 kullanıcı).
--
-- Mevcut kayıtlara (LeaveRequest/LeaveBalance boş, User satırları) veri
-- kaybına yol açacak hiçbir işlem yok — yalnızca sütun ekleme ve hireDate
-- UPDATE'i. Eşleşmeyen e-posta olursa ilgili UPDATE 0 satır etkiler, hata
-- vermez.

-- AlterTable: User.hireDate
ALTER TABLE "User" ADD COLUMN "hireDate" DATETIME;

-- AlterTable: LeaveRequest — reviewedAt / reviewNote / updatedAt
ALTER TABLE "LeaveRequest" ADD COLUMN "reviewedAt" DATETIME;
ALTER TABLE "LeaveRequest" ADD COLUMN "reviewNote" TEXT;
-- NOT: SQLite, ALTER TABLE ... ADD COLUMN'da CURRENT_TIMESTAMP gibi sabit
-- olmayan varsayılanları reddeder ("Cannot add a column with non-constant
-- default"). LeaveRequest bu tur itibarıyla boş (0 kayıt) olduğundan sabit
-- bir literal tarih kullanmak veri açısından zararsızdır.
ALTER TABLE "LeaveRequest" ADD COLUMN "updatedAt" DATETIME NOT NULL DEFAULT '2026-09-24T00:00:00.000Z';

-- CreateTable: LeaveAttachment
CREATE TABLE "LeaveAttachment" (
    "id"             TEXT NOT NULL PRIMARY KEY,
    "leaveRequestId" TEXT NOT NULL,
    "name"           TEXT NOT NULL,
    "url"            TEXT,
    "storageKey"     TEXT,
    "size"           INTEGER,
    "uploadedById"   TEXT NOT NULL,
    "createdAt"      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeaveAttachment_leaveRequestId_fkey" FOREIGN KEY ("leaveRequestId") REFERENCES "LeaveRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LeaveAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "LeaveAttachment_leaveRequestId_idx" ON "LeaveAttachment"("leaveRequestId");

-- ── İşe giriş tarihleri — e-posta ile eşleştirilir, isimle DEĞİL ───────────
UPDATE "User" SET "hireDate" = '2017-01-02T00:00:00.000Z' WHERE "email" = 'ebubekirozturk@vezin.com.tr';
UPDATE "User" SET "hireDate" = '2016-11-09T00:00:00.000Z' WHERE "email" = 'sedazincirkara@vezin.com.tr';
UPDATE "User" SET "hireDate" = '2021-04-06T00:00:00.000Z' WHERE "email" = 'emreguvenc@vezin.com.tr';
UPDATE "User" SET "hireDate" = '2022-09-19T00:00:00.000Z' WHERE "email" = 'hasankaraagac@vezin.com.tr';
UPDATE "User" SET "hireDate" = '2022-09-19T00:00:00.000Z' WHERE "email" = 'nursatiyilmaz@vezin.com.tr';
UPDATE "User" SET "hireDate" = '2023-05-26T00:00:00.000Z' WHERE "email" = 'seymagungor@vezin.com.tr';
UPDATE "User" SET "hireDate" = '2023-05-26T00:00:00.000Z' WHERE "email" = 'filizodogan@vezin.com.tr';
UPDATE "User" SET "hireDate" = '2023-12-06T00:00:00.000Z' WHERE "email" = 'oguzcetin@vezin.com.tr';
UPDATE "User" SET "hireDate" = '2023-12-06T00:00:00.000Z' WHERE "email" = 'elifdemirci@vezin.com.tr';
UPDATE "User" SET "hireDate" = '2023-12-06T00:00:00.000Z' WHERE "email" = 'tahabolek@vezin.com.tr';
UPDATE "User" SET "hireDate" = '2023-12-06T00:00:00.000Z' WHERE "email" = 'esrafirat@vezin.com.tr';
UPDATE "User" SET "hireDate" = '2023-12-06T00:00:00.000Z' WHERE "email" = 'meryemengin@vezin.com.tr';
UPDATE "User" SET "hireDate" = '2024-04-03T00:00:00.000Z' WHERE "email" = 'ahmetoruc@vezin.com.tr';
UPDATE "User" SET "hireDate" = '2024-04-03T00:00:00.000Z' WHERE "email" = 'ahmetyasinozkul@vezin.com.tr';
UPDATE "User" SET "hireDate" = '2024-04-29T00:00:00.000Z' WHERE "email" = 'tunahankocaoglu@vezin.com.tr';
UPDATE "User" SET "hireDate" = '2024-08-26T00:00:00.000Z' WHERE "email" = 'kerimdogan@vezin.com.tr';
UPDATE "User" SET "hireDate" = '2024-09-02T00:00:00.000Z' WHERE "email" = 'alimertyilmaz@vezin.com.tr';
UPDATE "User" SET "hireDate" = '2024-09-09T00:00:00.000Z' WHERE "email" = 'selinkotan@vezin.com.tr';
UPDATE "User" SET "hireDate" = '2024-11-25T00:00:00.000Z' WHERE "email" = 'efecanguvenir@vezin.com.tr';
UPDATE "User" SET "hireDate" = '2024-12-05T00:00:00.000Z' WHERE "email" = 'asenaobay@vezin.com.tr';
UPDATE "User" SET "hireDate" = '2025-01-08T00:00:00.000Z' WHERE "email" = 'sitkikandazoglu@vezin.com.tr';
UPDATE "User" SET "hireDate" = '2025-03-25T00:00:00.000Z' WHERE "email" = 'alperencoskunoglu@vezin.com.tr';
UPDATE "User" SET "hireDate" = '2025-03-25T00:00:00.000Z' WHERE "email" = 'mustafaagaherturk@vezin.com.tr';
UPDATE "User" SET "hireDate" = '2025-07-04T00:00:00.000Z' WHERE "email" = 'fatihgozyuman@vezin.com.tr';
UPDATE "User" SET "hireDate" = '2025-07-17T00:00:00.000Z' WHERE "email" = 'jansetturkoglu@vezin.com.tr';
UPDATE "User" SET "hireDate" = '2025-07-17T00:00:00.000Z' WHERE "email" = 'merveucan@vezin.com.tr';
UPDATE "User" SET "hireDate" = '2025-08-06T00:00:00.000Z' WHERE "email" = 'kadernuryesil@vezin.com.tr';
UPDATE "User" SET "hireDate" = '2025-12-08T00:00:00.000Z' WHERE "email" = 'muhammedergurum@vezin.com.tr';
UPDATE "User" SET "hireDate" = '2026-06-03T00:00:00.000Z' WHERE "email" = 'ozlemince@vezin.com.tr';
UPDATE "User" SET "hireDate" = '2026-01-10T00:00:00.000Z' WHERE "email" = 'gulsengulyilmaz@vezin.com.tr';
UPDATE "User" SET "hireDate" = '2026-02-02T00:00:00.000Z' WHERE "email" = 'zeynepyanik@vezin.com.tr';
UPDATE "User" SET "hireDate" = '2026-08-14T00:00:00.000Z' WHERE "email" = 'bugrahanbozkurt@vezin.com.tr';
