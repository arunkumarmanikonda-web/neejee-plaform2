-- Sprint 9.5 (v23.22) — Notification Engine
-- Run AFTER all prior sprint migrations.

DO $$ BEGIN
  CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL','WHATSAPP','SMS');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "NotificationStatus" AS ENUM ('QUEUED','SENT','DELIVERED','FAILED','SKIPPED','BOUNCED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "NotificationLog" (
  "id"            TEXT PRIMARY KEY,
  "userId"        TEXT,
  "event"         TEXT NOT NULL,
  "channel"       "NotificationChannel" NOT NULL,
  "recipient"     TEXT NOT NULL,
  "subject"       TEXT,
  "bodySnippet"   TEXT,
  "status"        "NotificationStatus" NOT NULL DEFAULT 'QUEUED',
  "providerId"    TEXT,
  "errorMessage"  TEXT,
  "contextType"   TEXT,
  "contextId"     TEXT,
  "attemptedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deliveredAt"   TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationLog_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "NotificationLog_userId_createdAt_idx"
  ON "NotificationLog"("userId","createdAt");
CREATE INDEX IF NOT EXISTS "NotificationLog_event_createdAt_idx"
  ON "NotificationLog"("event","createdAt");
CREATE INDEX IF NOT EXISTS "NotificationLog_status_createdAt_idx"
  ON "NotificationLog"("status","createdAt");
CREATE INDEX IF NOT EXISTS "NotificationLog_contextType_contextId_idx"
  ON "NotificationLog"("contextType","contextId");
