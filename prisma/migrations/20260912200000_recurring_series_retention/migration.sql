-- Görev sistemi D BLOĞU
-- RecurringSeries : tekrarlayan görev serisi şablonu ve zamanlayıcı
-- Task.recurringSeriesId : tekrarı diziye bağlar
-- File.retentionUntil    : completedAt + 1 yıl (task tamamlandığında atanır)
-- File.purgedAt          : fiziksel silme tarihi (meta veri korunur)

-- ── RecurringSeries ──────────────────────────────────────────────────────────
-- recurringType : "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY"
-- endType       : "INDEFINITE" | "SPECIFIC_DATE"
CREATE TABLE "RecurringSeries" (
  "id"               TEXT     NOT NULL PRIMARY KEY,
  "recurringType"    TEXT     NOT NULL,
  "recurringDay"     INTEGER,
  "startDate"        DATETIME NOT NULL,
  "endType"          TEXT     NOT NULL DEFAULT 'INDEFINITE',
  "endDate"          DATETIME,
  "isStopped"        BOOLEAN  NOT NULL DEFAULT 0,
  "nextOccurrenceAt" DATETIME NOT NULL,
  "title"            TEXT     NOT NULL,
  "description"      TEXT,
  "priority"         TEXT     NOT NULL DEFAULT 'MEDIUM',
  "assignedToId"     TEXT     NOT NULL,
  "projectId"        TEXT,
  "departmentId"     TEXT,
  "ownerId"          TEXT     NOT NULL,
  "createdAt"        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecurringSeries_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON UPDATE CASCADE,
  CONSTRAINT "RecurringSeries_assignedToId_fkey"
    FOREIGN KEY ("assignedToId") REFERENCES "User" ("id") ON UPDATE CASCADE
);

-- ── Task — seri bağlantısı ───────────────────────────────────────────────────
ALTER TABLE "Task" ADD COLUMN "recurringSeriesId" TEXT;

-- ── File — fiziksel dosya saklama ────────────────────────────────────────────
ALTER TABLE "File" ADD COLUMN "retentionUntil" DATETIME;
ALTER TABLE "File" ADD COLUMN "purgedAt" DATETIME;
