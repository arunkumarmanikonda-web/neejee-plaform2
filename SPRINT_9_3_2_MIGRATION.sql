-- v23.20 — OTP + Social Login migration.
-- Run once in Supabase SQL Editor before deploying.

CREATE TABLE IF NOT EXISTS "OtpToken" (
  "id"          TEXT NOT NULL,
  "phone"       TEXT NOT NULL,
  "codeHash"    TEXT NOT NULL,
  "attempts"    INTEGER NOT NULL DEFAULT 0,
  "expiresAt"   TIMESTAMP(3) NOT NULL,
  "consumedAt"  TIMESTAMP(3),
  "ipAddress"   TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OtpToken_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "OtpToken_phone_createdAt_idx" ON "OtpToken"("phone", "createdAt");
CREATE INDEX IF NOT EXISTS "OtpToken_expiresAt_idx" ON "OtpToken"("expiresAt");
