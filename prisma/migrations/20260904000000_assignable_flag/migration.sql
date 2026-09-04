-- 20260904000000_assignable_flag
-- Birim müdürleri (canBeAssignedTasks=false): kendilerine görev ATANAMAZ ama görev atayabilirler.
ALTER TABLE "User" ADD COLUMN "canBeAssignedTasks" BOOLEAN NOT NULL DEFAULT true;

-- Proje bitiş tarihi
ALTER TABLE "Project" ADD COLUMN "endDate" DATETIME;
