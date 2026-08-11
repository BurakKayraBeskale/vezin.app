-- AlterTable: User — kıdem ve unvan alanları
ALTER TABLE "User" ADD COLUMN "title" TEXT NOT NULL DEFAULT '';
ALTER TABLE "User" ADD COLUMN "seniorityLevel" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "canViewAllTasks" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: Task — üst görev (self-relation)
ALTER TABLE "Task" ADD COLUMN "parentTaskId" TEXT;

-- CreateIndex: Task_parentTaskId (sorgularda FK join hızlandırmak için)
CREATE INDEX "Task_parentTaskId_idx" ON "Task"("parentTaskId");
