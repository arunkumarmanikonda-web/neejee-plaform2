# Phase 1.5 — Cloud Schema Capture (Option B)

## Why
We do NOT want to depend on Docker Desktop or local CLI for capturing schema.
Instead, GitHub Actions performs the schema capture in the cloud.

## How it works
1. Manual trigger only (workflow_dispatch).
2. CI installs Supabase CLI.
3. CI uses these GitHub Actions secrets:
   - SUPABASE_ACCESS_TOKEN   (from https://supabase.com/dashboard/account/tokens)
   - SUPABASE_DB_PASSWORD    (your Supabase production DB password)
4. CI runs supabase link --project-ref <from supabase/config.toml>.
5. CI runs supabase db pull (READ-ONLY).
6. CI opens a PR into dev/supabase-from-git-stage2 with the captured schema.

## What it does NOT do
- Does not write to the production database
- Does not push to main
- Does not run any migration apply
- Does not touch checkout, finance, pricing, stock, taxonomy, warehouse, inventory

## Required one-time setup (manual)
In GitHub repo: Settings -> Secrets and variables -> Actions -> New repository secret
Add:
  SUPABASE_ACCESS_TOKEN
  SUPABASE_DB_PASSWORD

## How to trigger
GitHub repo -> Actions tab -> "Supabase Schema Capture (read-only, cloud)" -> Run workflow

## After it runs
- A PR titled "phase1.5: captured production schema (read-only via CI)" will appear.
- Review the generated SQL under supabase/migrations.
- If clean, merge into dev/supabase-from-git-stage2 (NOT main).

## Rollback
- Tag of last good production state: phase1-vercel-git-live