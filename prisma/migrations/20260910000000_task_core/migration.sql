-- Görev veri modeli genişletmesi — A BLOĞU
-- reviewOwnerId        : inceleme sahibi (varsayılan: görevi oluşturan)
-- assignmentLevelSnapshot: atama anındaki atayan kıdem seviyesi
-- departmentId         : proje dışı görevlerin departman bilgisi (user dept formatı)
-- deletedAt            : yumuşak silme tarihi

ALTER TABLE "Task" ADD COLUMN "reviewOwnerId" TEXT;
ALTER TABLE "Task" ADD COLUMN "assignmentLevelSnapshot" INTEGER;
ALTER TABLE "Task" ADD COLUMN "departmentId" TEXT;
ALTER TABLE "Task" ADD COLUMN "deletedAt" DATETIME;

-- Mevcut görevleri doldur: inceleme sahibi = oluşturan
UPDATE "Task" SET "reviewOwnerId" = "createdById" WHERE "reviewOwnerId" IS NULL;

-- Mevcut görevleri doldur: atama kıdemi = oluşturanın mevcut kıdemi
UPDATE "Task" SET "assignmentLevelSnapshot" = (
  SELECT "seniorityLevel" FROM "User" WHERE "User"."id" = "Task"."createdById"
) WHERE "assignmentLevelSnapshot" IS NULL;

-- Mevcut görevleri doldur: departman = oluşturanın departmanı (yalnızca proje dışı görevler)
UPDATE "Task" SET "departmentId" = (
  SELECT "department" FROM "User" WHERE "User"."id" = "Task"."createdById"
) WHERE "projectId" IS NULL AND "departmentId" IS NULL;
