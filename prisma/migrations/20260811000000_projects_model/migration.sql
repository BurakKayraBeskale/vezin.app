-- Add new columns to User
ALTER TABLE "User" ADD COLUMN "canViewAllProjects" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "overseesDepartment" TEXT;

-- Create Project table
CREATE TABLE "Project" (
  "id"          TEXT NOT NULL PRIMARY KEY,
  "name"        TEXT NOT NULL,
  "department"  TEXT NOT NULL DEFAULT 'VERGI',
  "taxNumber"   TEXT,
  "sector"      TEXT,
  "startDate"   DATETIME,
  "notes"       TEXT,
  "about"       TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Project_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Create ProjectMember join table
CREATE TABLE "ProjectMember" (
  "id"         TEXT NOT NULL PRIMARY KEY,
  "projectId"  TEXT NOT NULL,
  "userId"     TEXT NOT NULL,
  "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "assignedBy" TEXT NOT NULL DEFAULT '',
  CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProjectMember_userId_fkey"  FOREIGN KEY ("userId")    REFERENCES "User"("id")    ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ProjectMember_projectId_userId_key" ON "ProjectMember"("projectId", "userId");
CREATE INDEX "ProjectMember_projectId_idx" ON "ProjectMember"("projectId");
CREATE INDEX "ProjectMember_userId_idx"    ON "ProjectMember"("userId");

-- Add projectId to Task
ALTER TABLE "Task" ADD COLUMN "projectId" TEXT;
CREATE INDEX "Task_projectId_idx" ON "Task"("projectId");
