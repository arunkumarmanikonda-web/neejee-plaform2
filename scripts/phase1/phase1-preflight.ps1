param(
  [string]$Root = (Get-Location).Path
)

$ErrorActionPreference = 'Stop'
$ReportsDir = Join-Path $Root '_phase1\reports'
New-Item -ItemType Directory -Force -Path $ReportsDir | Out-Null

& (Join-Path $Root 'scripts\phase1\scan-auth-session.ps1') -Root $Root
& (Join-Path $Root 'scripts\phase1\validate-env-runtime.ps1') -Root $Root
& (Join-Path $Root 'scripts\phase1\check-logout-safety.ps1') -Root $Root

Write-Host ''
Write-Host 'Phase 1 preflight complete.' -ForegroundColor Green
Write-Host 'Review:' -ForegroundColor Cyan
Write-Host "  $ReportsDir\auth-session-summary.csv"
Write-Host "  $ReportsDir\auth-session-hits.txt"
Write-Host "  $ReportsDir\env-runtime-risks.csv"
Write-Host "  $ReportsDir\logout-safety.csv"
