param(
  [string]$Root = (Get-Location).Path
)

$ErrorActionPreference = 'Stop'

& (Join-Path $Root 'scripts\phase1\scan-auth-session.ps1') -Root $Root
& (Join-Path $Root 'scripts\phase1\validate-env-runtime.ps1') -Root $Root
& (Join-Path $Root 'scripts\phase1\check-logout-safety.ps1') -Root $Root

Write-Host ''
Write-Host 'Phase 1 preflight complete.' -ForegroundColor Green
Write-Host 'Review:' -ForegroundColor Cyan
Write-Host '  .\_phase1\reports\auth-session-summary.csv'
Write-Host '  .\_phase1\reports\auth-session-hits.txt'
Write-Host '  .\_phase1\reports\env-runtime-risks.csv'
Write-Host '  .\_phase1\reports\logout-safety.csv'
