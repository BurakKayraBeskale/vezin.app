-- AlterTable: Project alanlarına status ve deletedAt ekle
ALTER TABLE "Project" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Project" ADD COLUMN "deletedAt" DATETIME;

-- DataMigration: "VERGI" → "YMM" (Project departmanı)
UPDATE "Project" SET "department" = 'YMM' WHERE "department" = 'VERGI';

-- DataMigration: User.overseesDepartment "VERGI" → "YMM"
UPDATE "User" SET "overseesDepartment" = 'YMM' WHERE "overseesDepartment" = 'VERGI';
