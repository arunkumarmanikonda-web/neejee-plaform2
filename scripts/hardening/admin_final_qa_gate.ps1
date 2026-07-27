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

Write-Host "Running live readiness gate..."
powershell -ExecutionPolicy Bypass -File $liveGate
Assert-Step ($LASTEXITCODE -eq 0) "Live readiness gate failed"

Write-Host "Running featured smoke gate..."
powershell -ExecutionPolicy Bypass -File $smokeGate
Assert-Step ($LASTEXITCODE -eq 0) "Featured smoke gate failed"

$liveBuildLog = Join-Path $reportDir 'admin_live_readiness_build.log'
$liveSafeMode = Join-Path $reportDir 'admin_live_readiness_safe_mode_hits.txt'
$smokeBuildLog = Join-Path $reportDir 'featured_admin_smoke_build.log'
$smokeRouteChecks = Join-Path $reportDir 'featured_admin_smoke_route_checks.txt'

Assert-Step (Test-Path $liveBuildLog) "Missing live readiness build log"
Assert-Step (Test-Path $liveSafeMode) "Missing live readiness safe mode evidence"
Assert-Step (Test-Path $smokeBuildLog) "Missing featured smoke build log"
Assert-Step (Test-Path $smokeRouteChecks) "Missing featured smoke route checks"

Copy-Item -Force $smokeBuildLog $buildLogPath
Copy-Item -Force $liveSafeMode $safeModePath
Copy-Item -Force $smokeRouteChecks $routeCheckPath

Assert-Step ((Get-Item $safeModePath).Length -gt 0) "No SAFE MODE evidence found in final QA artifact"

$routeLines = Get-Content $routeCheckPath
$missingRoutes = @()

foreach ($line in $routeLines) {
  if ($line -match 'MISSING_FROM_BUILD_OUTPUT') {
    $missingRoutes += $line
  }
}

$missingText = if ($missingRoutes.Count -eq 0) { 'none' } else { ($missingRoutes -join ' | ') }

$summary = @()
$summary += "HEAD: $((git rev-parse --short HEAD).Trim())"
$summary += "Live gate: PASS"
$summary += "Smoke gate: PASS"
$summary += "Consolidated build log: $buildLogPath"
$summary += "Consolidated safe mode evidence: $safeModePath"
$summary += "Consolidated route checks: $routeCheckPath"
$summary += "Missing featured routes in final QA: $missingText"
$summary | Set-Content -Path $summaryPath

Assert-Step ($missingRoutes.Count -eq 0) ("Missing featured routes in final QA: " + ($missingRoutes -join ' | '))

Write-Host "Saved final QA summary: $summaryPath"
Write-Host "Saved final QA build log: $buildLogPath"
Write-Host "Saved final QA safe mode evidence: $safeModePath"
Write-Host "Saved final QA route checks: $routeCheckPath"
Write-Host "Build exit code: 0"
Write-Host "Missing featured routes in final QA: none"
Write-Host "Admin final QA gate passed."