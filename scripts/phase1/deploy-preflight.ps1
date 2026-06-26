param(
  [string]$Root = (Get-Location).Path
)

$ErrorActionPreference = 'Stop'
$Failures = @()

$MustExist = @(
  'docs\PHASE0_FREEZE.md',
  'docs\PHASE1_SCOPE.md',
  'scripts\phase0\check-protected-zones.ps1',
  'scripts\phase1\phase1-gate.ps1',
  'scripts\phase1\check-env-consistency.ps1',
  'scripts\phase1\check-admin-exposure.ps1',
  'config\phase1-env-manifest.json',
  '.githooks\pre-commit',
  'config\phase0-protected-zones.json'
)

foreach ($rel in $MustExist) {
  $path = Join-Path $Root $rel
  if (!(Test-Path $path)) {
    $Failures += "Missing required file: $rel"
  }
}

$LogoutFile = Join-Path $Root 'app\api\auth\logout\route.ts'
if (Test-Path $LogoutFile) {
  $raw = Get-Content -LiteralPath $LogoutFile -Raw
  if ($raw -match 'export\s+async\s+function\s+GET\s*\(') {
    $Failures += 'Logout route still contains GET handler'
  }
  if ($raw -notmatch 'export\s+async\s+function\s+POST\s*\(') {
    $Failures += 'Logout route does not contain POST handler'
  }
}

$Hook = Join-Path $Root '.githooks\pre-commit'
if (Test-Path $Hook) {
  $hookRaw = Get-Content -LiteralPath $Hook -Raw
  if ($hookRaw -notmatch 'phase0/check-protected-zones\.ps1') {
    $Failures += 'pre-commit hook does not call Phase 0 check'
  }
  if ($hookRaw -notmatch 'phase1/phase1-gate\.ps1') {
    $Failures += 'pre-commit hook does not call Phase 1 gate'
  }
}

if ($Failures.Count -gt 0) {
  Write-Host ''
  Write-Host 'Deploy preflight failed:' -ForegroundColor Red
  $Failures | ForEach-Object { Write-Host " - $_" -ForegroundColor Red }
  Write-Host ''
  exit 1
}

Write-Host 'Deploy preflight passed.' -ForegroundColor Green
exit 0

