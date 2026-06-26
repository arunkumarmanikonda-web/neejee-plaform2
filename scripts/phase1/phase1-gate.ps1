param(
  [string]$Root = (Get-Location).Path
)

$ErrorActionPreference = 'Stop'
$Failures = @()

$ReportsDir = Join-Path $Root '_phase1\reports'

$LogoutReport = Join-Path $ReportsDir 'logout-safety.csv'
if (Test-Path $LogoutReport) {
  $rows = Import-Csv $LogoutReport
  if ($rows.Count -gt 0) {
    $Failures += 'logout-safety.csv contains blocking rows'
  }
}

$EnvRiskReport = Join-Path $ReportsDir 'env-runtime-risks.csv'
if (Test-Path $EnvRiskReport) {
  $rows = Import-Csv $EnvRiskReport
  if ($rows.Count -gt 0) {
    $Failures += 'env-runtime-risks.csv contains blocking rows'
  }
}

$ScanFiles = @(
  '.\app\api\auth\login\route.ts',
  '.\app\api\auth\otp\send\route.ts',
  '.\app\api\auth\logout\route.ts',
  '.\app\(auth)\login\page.tsx',
  '.\components\auth\OtpLogin.tsx',
  '.\lib\otp.ts'
) | ForEach-Object {
  Join-Path $Root $_.TrimStart('.\')
} | Where-Object { Test-Path $_ }

$Needles = @(
  'demo-bypass',
  'devCode',
  'mockCode',
  'export async function GET('
)

foreach ($file in $ScanFiles) {
  foreach ($needle in $Needles) {
    $hits = Select-String -Path $file -SimpleMatch -Pattern $needle -ErrorAction SilentlyContinue
    if ($hits) {
      foreach ($hit in $hits) {
        if ($file -like '*logout\route.ts' -and $needle -eq 'export async function GET(') {
          $Failures += "GET logout handler found in $file"
        } elseif ($needle -ne 'export async function GET(') {
          $Failures += "$needle found in $file at line $($hit.LineNumber)"
        }
      }
    }
  }
}

if ($Failures.Count -gt 0) {
  Write-Host ''
  Write-Host 'Phase 1 gate failed:' -ForegroundColor Red
  $Failures | Sort-Object -Unique | ForEach-Object { Write-Host " - $_" -ForegroundColor Red }
  Write-Host ''
  exit 1
}

Write-Host 'Phase 1 gate passed.' -ForegroundColor Green
exit 0
