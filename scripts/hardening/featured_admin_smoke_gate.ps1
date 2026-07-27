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

$buildLogPath = Join-Path $reportDir 'featured_admin_smoke_build.log'
$routeCheckPath = Join-Path $reportDir 'featured_admin_smoke_route_checks.txt'
$summaryPath = Join-Path $reportDir 'featured_admin_smoke_summary.txt'

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

cmd /c "npm run build > `"$buildLogPath`" 2>&1"
$buildExit = $LASTEXITCODE

Assert-Step ($buildExit -eq 0) "Build failed with exit code $buildExit"

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
$summary += "Build exit code: $buildExit"
$summary += "Route checks: $routeCheckPath"
$summary += "Build log: $buildLogPath"
$summary += "Missing featured routes in build output: $missingText"
$summary | Set-Content -Path $summaryPath

Assert-Step ($missingRoutes.Count -eq 0) ("Missing featured routes in build output: " + ($missingRoutes -join ', '))

Write-Host "Saved featured smoke summary: $summaryPath"
Write-Host "Saved featured smoke build log: $buildLogPath"
Write-Host "Saved featured route checks: $routeCheckPath"
Write-Host "Build exit code: $buildExit"
Write-Host "Missing featured routes in build output: none"
Write-Host "Featured admin smoke gate passed."