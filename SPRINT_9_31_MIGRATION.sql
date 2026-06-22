-- v23.40.25.2 — Separate public website contact from authorised-signatory contact.
-- Adds publicEmail / publicPhone / publicWhatsapp / publicAddressLine / socialInstagram
-- to LegalEntity. The existing contactEmail/contactPhone stay PRIVATE (invoice + finance).
-- Safe to run multiple times.

ALTER TABLE "LegalEntity"
  ADD COLUMN IF NOT EXISTS "publicEmail"       TEXT,
  ADD COLUMN IF NOT EXISTS "publicPhone"       TEXT,
  ADD COLUMN IF NOT EXISTS "publicWhatsapp"    TEXT,
  ADD COLUMN IF NOT EXISTS "publicAddressLine" TEXT,
  ADD COLUMN IF NOT EXISTS "socialInstagram"   TEXT;
