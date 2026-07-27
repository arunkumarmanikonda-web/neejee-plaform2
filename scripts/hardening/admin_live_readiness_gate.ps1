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

$buildLogPath = Join-Path $reportDir 'admin_live_readiness_build.log'
$safeModePath = Join-Path $reportDir 'admin_live_readiness_safe_mode_hits.txt'
$runtimePath = Join-Path $reportDir 'admin_live_readiness_runtime_hits.txt'
$featuredPath = Join-Path $reportDir 'admin_live_readiness_featured_checks.txt'
$summaryPath = Join-Path $reportDir 'admin_live_readiness_summary.txt'

$featuredChecks = @(
  @{ Route = '/admin/products';   File = 'app\admin\products\page.tsx' },
  @{ Route = '/admin/orders';     File = 'app\admin\orders\page.tsx' },
  @{ Route = '/admin/customers';  File = 'app\admin\customers\page.tsx' },
  @{ Route = '/admin/categories'; File = 'app\admin\categories\page.tsx' },
  @{ Route = '/admin/analytics';  File = 'app\admin\analytics\page.tsx' },
  @{ Route = '/admin/seo';        File = 'app\admin\seo\page.tsx' },
  @{ Route = '/admin/erp';        File = 'app\admin\erp\page.tsx' },
  @{ Route = '/admin/sellers';    File = 'app\admin\sellers\page.tsx' }
)

$adminPage = 'app\admin\page.tsx'

Get-Content $adminPage |
  Select-String -Pattern 'SAFE MODE|Prisma queries|production pool|database connection mode|SECTION JUMP BAR|Ctrl / Cmd \+ K' |
  ForEach-Object { $_.Line } |
  Set-Content -Path $safeModePath

Get-ChildItem 'app' -Recurse -File -Include *.ts,*.tsx |
  Select-String -Pattern 'runtime health|VERCEL_ACCESS_TOKEN|VERCEL_PROJECT_ID|safe mode|production pool|database connection mode' |
  ForEach-Object { "$($_.Path):$($_.LineNumber): $($_.Line.Trim())" } |
  Set-Content -Path $runtimePath

$missingFeatured = @()
$featuredLines = @()
foreach ($item in $featuredChecks) {
  $exists = Test-Path $item.File
  $featuredLines += ("{0} => {1} => {2}" -f $item.Route, $item.File, $(if ($exists) { 'OK' } else { 'MISSING' }))
  if (-not $exists) {
    $missingFeatured += $item.Route
  }
}
$featuredLines | Set-Content -Path $featuredPath

cmd /c "npm run build > `"$buildLogPath`" 2>&1"
$buildExit = $LASTEXITCODE

$summary = @()
$summary += "Build exit code: $buildExit"
$summary += "Safe mode evidence: $safeModePath"
$summary += "Runtime evidence: $runtimePath"
$summary += "Featured route checks: $featuredPath"
$summary += "Build log: $buildLogPath"
$summary += "Missing featured routes: $(if ($missingFeatured.Count -eq 0) { 'none' } else { ($missingFeatured -join ', ') })"
$summary | Set-Content -Path $summaryPath

Assert-Step ($buildExit -eq 0) "Build failed with exit code $buildExit"
Assert-Step ($missingFeatured.Count -eq 0) ("Missing featured route files: " + ($missingFeatured -join ', '))

Write-Host "Saved live readiness summary: $summaryPath"
Write-Host "Saved live readiness build log: $buildLogPath"
Write-Host "Saved safe mode evidence: $safeModePath"
Write-Host "Saved runtime evidence: $runtimePath"
Write-Host "Saved featured checks: $featuredPath"
Write-Host "Build exit code: $buildExit"
Write-Host "Missing featured routes: none"
Write-Host "Admin live readiness gate passed."