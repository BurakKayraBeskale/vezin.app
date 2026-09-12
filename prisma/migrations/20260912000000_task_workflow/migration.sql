-- Görev iş akışı — C BLOĞU
-- reopenReason  : yeniden açma sebebi (DONE→TODO geçişinde zorunlu)
-- TaskReviewRound: her inceleme turu kaydı (gönderim + geri bildirim)
-- TaskSource    : görev kaynakları (LINK veya FILE meta verisi)
-- TaskAttachment: gönderim/inceleme eki (dosya/not metadatası)

ALTER TABLE "Task" ADD COLUMN "reopenReason" TEXT;

-- ── TaskReviewRound ──────────────────────────────────────────────────────────
-- reviewAction: "APPROVED" | "REVISION_REQUESTED"
CREATE TABLE "TaskReviewRound" (
  "id"             TEXT     NOT NULL PRIMARY KEY,
  "taskId"         TEXT     NOT NULL,
  "roundNumber"    INTEGER  NOT NULL,
  "submittedById"  TEXT     NOT NULL,
  "submissionNote" TEXT     NOT NULL,
  "submittedAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedById"   TEXT,
  "reviewAction"   TEXT,
  "reviewNote"     TEXT,
  "reviewedAt"     DATETIME,
  CONSTRAINT "TaskReviewRound_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TaskReviewRound_submittedById_fkey"
    FOREIGN KEY ("submittedById") REFERENCES "User" ("id") ON UPDATE CASCADE,
  CONSTRAINT "TaskReviewRound_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "User" ("id") ON UPDATE CASCADE
);

-- ── TaskSource ───────────────────────────────────────────────────────────────
-- type: "LINK" | "FILE"
CREATE TABLE "TaskSource" (
  "id"          TEXT     NOT NULL PRIMARY KEY,
  "taskId"      TEXT     NOT NULL,
  "type"        TEXT     NOT NULL,
  "name"        TEXT     NOT NULL,
  "url"         TEXT,
  "storageKey"  TEXT,
  "description" TEXT,
  "addedById"   TEXT     NOT NULL,
  "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskSource_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TaskSource_addedById_fkey"
    FOREIGN KEY ("addedById") REFERENCES "User" ("id") ON UPDATE CASCADE
);

-- ── TaskAttachment ───────────────────────────────────────────────────────────
-- kind: "SUBMISSION" | "FEEDBACK"
-- type: "LINK" | "FILE"
CREATE TABLE "TaskAttachment" (
  "id"             TEXT     NOT NULL PRIMARY KEY,
  "taskId"         TEXT     NOT NULL,
  "reviewRoundId"  TEXT,
  "kind"           TEXT     NOT NULL,
  "type"           TEXT     NOT NULL,
  "name"           TEXT     NOT NULL,
  "url"            TEXT,
  "storageKey"     TEXT,
  "size"           INTEGER,
  "uploadedById"   TEXT     NOT NULL,
  "createdAt"      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "retentionUntil" DATETIME,
  "purgedAt"       DATETIME,
  CONSTRAINT "TaskAttachment_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TaskAttachment_reviewRoundId_fkey"
    FOREIGN KEY ("reviewRoundId") REFERENCES "TaskReviewRound" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "TaskAttachment_uploadedById_fkey"
    FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON UPDATE CASCADE
);
