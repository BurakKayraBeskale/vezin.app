-- 20260928000000_expense_module
-- Personel Harcama Formu modülü (A bloğu) — yalnızca YENİ tablolar.
--
-- Mevcut tablolara (User dahil) hiçbir ALTER/UPDATE/DELETE yok; User'a eklenen
-- Prisma ilişki alanları (expenseForms, expenseApproverConfig, expenseApprovals)
-- sanal alanlardır, veritabanında sütun oluşturmaz. Canlı veriye dokunmaz.
--
-- Tutarlar REAL; hesaplar uygulamada kuruş (tam sayı) üzerinden yapılır.

-- CreateTable: ExpenseForm
CREATE TABLE "ExpenseForm" (
    "id"                  TEXT NOT NULL PRIMARY KEY,
    "formNo"              TEXT NOT NULL,
    "ownerId"             TEXT NOT NULL,
    "status"              TEXT NOT NULL DEFAULT 'DRAFT',
    "note"                TEXT,
    "cashAdvance"         REAL NOT NULL DEFAULT 0,
    "totalAmount"         REAL NOT NULL DEFAULT 0,
    "netAmount"           REAL NOT NULL DEFAULT 0,
    "ownerNameSnapshot"   TEXT,
    "departmentSnapshot"  TEXT,
    "titleSnapshot"       TEXT,
    "snapshotAt"          DATETIME,
    "firstSubmittedAt"    DATETIME,
    "lastSubmittedAt"     DATETIME,
    "reachedAccountingAt" DATETIME,
    "lastActionAt"        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version"             INTEGER NOT NULL DEFAULT 0,
    "createdAt"           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           DATETIME NOT NULL,
    CONSTRAINT "ExpenseForm_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable: ExpenseFormItem
CREATE TABLE "ExpenseFormItem" (
    "id"            TEXT NOT NULL PRIMARY KEY,
    "formId"        TEXT NOT NULL,
    "sortOrder"     INTEGER NOT NULL DEFAULT 0,
    "date"          DATETIME,
    "subject"       TEXT NOT NULL DEFAULT '',
    "vendor"        TEXT NOT NULL DEFAULT '',
    "description"   TEXT NOT NULL DEFAULT '',
    "clientProject" TEXT,
    "amount"        REAL NOT NULL DEFAULT 0,
    "createdAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExpenseFormItem_formId_fkey" FOREIGN KEY ("formId") REFERENCES "ExpenseForm" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable: ExpenseApprovalConfig
CREATE TABLE "ExpenseApprovalConfig" (
    "id"          TEXT NOT NULL PRIMARY KEY,
    "department"  TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExpenseApprovalConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable: ExpenseApprovalRound
CREATE TABLE "ExpenseApprovalRound" (
    "id"               TEXT NOT NULL PRIMARY KEY,
    "formId"           TEXT NOT NULL,
    "roundNumber"      INTEGER NOT NULL,
    "status"           TEXT NOT NULL DEFAULT 'PENDING',
    "bypassed"         BOOLEAN NOT NULL DEFAULT false,
    "requiredCount"    INTEGER NOT NULL DEFAULT 0,
    "submittedById"    TEXT NOT NULL,
    "submittedAt"      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt"         DATETIME,
    "closedById"       TEXT,
    "rejectionNote"    TEXT,
    "adminOverride"    BOOLEAN NOT NULL DEFAULT false,
    "accountingStatus" TEXT,
    "accountingById"   TEXT,
    "accountingAt"     DATETIME,
    "accountingNote"   TEXT,
    CONSTRAINT "ExpenseApprovalRound_formId_fkey" FOREIGN KEY ("formId") REFERENCES "ExpenseForm" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable: ExpenseApproval
CREATE TABLE "ExpenseApproval" (
    "id"                 TEXT NOT NULL PRIMARY KEY,
    "roundId"            TEXT NOT NULL,
    "approverId"         TEXT NOT NULL,
    "status"             TEXT NOT NULL DEFAULT 'PENDING',
    "decidedAt"          DATETIME,
    "note"               TEXT,
    "replacedAt"         DATETIME,
    "replacedById"       TEXT,
    "replacesApprovalId" TEXT,
    "createdAt"          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExpenseApproval_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "ExpenseApprovalRound" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExpenseApproval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable: ExpenseDocument
CREATE TABLE "ExpenseDocument" (
    "id"             TEXT NOT NULL PRIMARY KEY,
    "formId"         TEXT NOT NULL,
    "name"           TEXT NOT NULL,
    "storageKey"     TEXT NOT NULL,
    "size"           INTEGER NOT NULL,
    "mimeType"       TEXT NOT NULL DEFAULT 'application/pdf',
    "uploadedById"   TEXT NOT NULL,
    "uploadedByName" TEXT NOT NULL,
    "createdAt"      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "replacedAt"     DATETIME,
    "deletedAt"      DATETIME,
    "deletedById"    TEXT,
    CONSTRAINT "ExpenseDocument_formId_fkey" FOREIGN KEY ("formId") REFERENCES "ExpenseForm" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable: ExpenseSettlement
CREATE TABLE "ExpenseSettlement" (
    "id"              TEXT NOT NULL PRIMARY KEY,
    "formId"          TEXT NOT NULL,
    "type"            TEXT NOT NULL,
    "amount"          REAL NOT NULL,
    "transactionDate" DATETIME NOT NULL,
    "note"            TEXT,
    "createdById"     TEXT NOT NULL,
    "createdByName"   TEXT NOT NULL,
    "createdAt"       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revertedAt"      DATETIME,
    "revertedById"    TEXT,
    "revertedByName"  TEXT,
    "revertReason"    TEXT,
    CONSTRAINT "ExpenseSettlement_formId_fkey" FOREIGN KEY ("formId") REFERENCES "ExpenseForm" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable: ExpenseAudit
CREATE TABLE "ExpenseAudit" (
    "id"         TEXT NOT NULL PRIMARY KEY,
    "formId"     TEXT NOT NULL,
    "action"     TEXT NOT NULL,
    "actorId"    TEXT,
    "actorName"  TEXT,
    "fromStatus" TEXT,
    "toStatus"   TEXT,
    "note"       TEXT,
    "meta"       TEXT,
    "createdAt"  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExpenseAudit_formId_fkey" FOREIGN KEY ("formId") REFERENCES "ExpenseForm" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseForm_formNo_key" ON "ExpenseForm"("formNo");
CREATE INDEX "ExpenseForm_ownerId_idx" ON "ExpenseForm"("ownerId");
CREATE INDEX "ExpenseForm_status_idx" ON "ExpenseForm"("status");
CREATE INDEX "ExpenseForm_departmentSnapshot_idx" ON "ExpenseForm"("departmentSnapshot");
CREATE INDEX "ExpenseFormItem_formId_idx" ON "ExpenseFormItem"("formId");
CREATE UNIQUE INDEX "ExpenseApprovalConfig_department_userId_key" ON "ExpenseApprovalConfig"("department", "userId");
CREATE INDEX "ExpenseApprovalConfig_department_idx" ON "ExpenseApprovalConfig"("department");
CREATE UNIQUE INDEX "ExpenseApprovalRound_formId_roundNumber_key" ON "ExpenseApprovalRound"("formId", "roundNumber");
CREATE INDEX "ExpenseApproval_roundId_idx" ON "ExpenseApproval"("roundId");
CREATE INDEX "ExpenseApproval_approverId_status_idx" ON "ExpenseApproval"("approverId", "status");
CREATE INDEX "ExpenseDocument_formId_idx" ON "ExpenseDocument"("formId");
CREATE INDEX "ExpenseSettlement_formId_idx" ON "ExpenseSettlement"("formId");
CREATE INDEX "ExpenseAudit_formId_createdAt_idx" ON "ExpenseAudit"("formId", "createdAt");
