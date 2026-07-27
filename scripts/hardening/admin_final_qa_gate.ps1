param()

$ErrorActionPreference = 'Stop'

function Assert-Step {
  param(
    [bool]$Condition,
    [string]$Message
  )
  if (-not $Condition) {
    throw $Message
  }
}

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $repoRoot

$reportDir = Join-Path $repoRoot 'hardening_reports'
New-Item -ItemType Directory -Force -Path $reportDir | Out-Null

$summaryPath = Join-Path $reportDir 'admin_final_qa_summary.txt'
$buildLogPath = Join-Path $reportDir 'admin_final_qa_build.log'
$safeModePath = Join-Path $reportDir 'admin_final_qa_safe_mode_hits.txt'
$routeCheckPath = Join-Path $reportDir 'admin_final_qa_route_checks.txt'

$liveGate = Join-Path $repoRoot 'scripts\hardening\admin_live_readiness_gate.ps1'
$smokeGate = Join-Path $repoRoot 'scripts\hardening\featured_admin_smoke_gate.ps1'

Assert-Step (Test-Path $liveGate) "Missing live readiness gate script"
Assert-Step (Test-Path $smokeGate) "Missing featured smoke gate script"

powershell -ExecutionPolicy Bypass -File $liveGate
Assert-Step ($LASTEXITCODE -eq 0) "Live readiness gate failed"

powershell -ExecutionPolicy Bypass -File $smokeGate
Assert-Step ($LASTEXITCODE -eq 0) "Featured smoke gate failed"

cmd /c "npm run build > `"$buildLogPath`" 2>&1"
$buildExit = $LASTEXITCODE
Assert-Step ($buildExit -eq 0) "Build failed with exit code $buildExit"

Get-ChildItem -Recurse -File -Include *.ts,*.tsx |
  Select-String -Pattern 'SAFE MODE' |
  ForEach-Object { "{0}:{1}:{2}" -f $_.Path, $_.LineNumber, $_.Line.Trim() } |
  Set-Content -Path $safeModePath

Assert-Step ((Test-Path $safeModePath) -and ((Get-Item $safeModePath).Length -gt 0)) "No SAFE MODE evidence found"

$featuredRoutes = @(
  '/admin/products',
  '/admin/orders',
  '/admin/customers',
  '/admin/categories',
  '/admin/analytics',
  '/admin/seo',
  '/admin/erp',
  '/admin/sellers'
)

$buildLines = Get-Content $buildLogPath
$missingRoutes = @()
$routeLines = @()

foreach ($route in $featuredRoutes) {
  $found = $false
  foreach ($line in $buildLines) {
    if ($line -match [regex]::Escape($route)) {
      $found = $true
      break
    }
  }

  if ($found) {
    $routeLines += "$route => OK"
  } else {
    $routeLines += "$route => MISSING_FROM_BUILD_OUTPUT"
    $missingRoutes += $route
  }
}

$routeLines | Set-Content -Path $routeCheckPath

$missingText = if ($missingRoutes.Count -eq 0) { 'none' } else { ($missingRoutes -join ', ') }

$summary = @()
$summary += "HEAD: $((git rev-parse --short HEAD).Trim())"
$summary += "Build exit code: $buildExit"
$summary += "Live gate: PASS"
$summary += "Smoke gate: PASS"
$summary += "Safe mode evidence: $safeModePath"
$summary += "Route checks: $routeCheckPath"
$summary += "Build log: $buildLogPath"
$summary += "Missing featured routes: $missingText"
$summary | Set-Content -Path $summaryPath

Assert-Step ($missingRoutes.Count -eq 0) ("Missing featured routes in final QA: " + ($missingRoutes -join ', '))

Write-Host "Saved final QA summary: $summaryPath"
Write-Host "Saved final QA build log: $buildLogPath"
Write-Host "Saved final QA safe mode evidence: $safeModePath"
Write-Host "Saved final QA route checks: $routeCheckPath"
Write-Host "Build exit code: $buildExit"
Write-Host "Missing featured routes in final QA: none"
Write-Host "Admin final QA gate passed."