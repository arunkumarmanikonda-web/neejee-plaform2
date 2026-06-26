# Phase 1.5 — Supabase from Git (read-only scaffolding stage)

## Scope
Move Supabase database/migration deployment off local CLI and into Git-driven CI/CD.

## Currently in this commit
- supabase/ folder scaffolding
- supabase/config.toml placeholder (NO secrets)
- .github/workflows/supabase-verify.yml — runs ONLY against an ephemeral local Postgres in CI
- Documentation

## Currently NOT in this commit
- No production schema has been pulled
- No production migration has been applied
- No GitHub Actions secrets have been added
- No db push, no db reset, no destructive operations against production

## Frozen (do NOT touch)
- checkout
- payments / Razorpay
- finance
- pricing
- stock
- taxonomy
- warehouse
- inventory loading

## Next manual steps (handled in a later PowerShell block, with your confirmation)
1. Install Supabase CLI locally
2. supabase login (interactive, one-time)
3. supabase link --project-ref <PROD_PROJECT_REF> (read-only metadata)
4. supabase db pull (read-only schema capture into supabase/migrations)
5. Commit captured migrations to a NEW branch (not main)
6. Open a PR — the verify workflow will run against an ephemeral CI database only
7. After review, decide whether to enable a production-apply workflow (gated, manual approval)

## Rollback
- Tag of last good state: phase1-vercel-git-live
- All previous protected zones and pre-commit gates remain active
