param(
  [string]$Root = (Get-Location).Path
)

$ErrorActionPreference = 'Stop'
$OutDir = Join-Path $Root '_phase1\reports'
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$File = Join-Path $Root 'app\admin\settings\page.tsx'
if (!(Test-Path $File)) { throw "Missing admin settings page: $File" }

$Patterns = @(
  @{ Type = 'hardcoded-url'; Pattern = 'https?://' },
  @{ Type = 'live-supabase-host'; Pattern = 'supabase\.co' },
  @{ Type = 'insecure-wording'; Pattern = 'Using default \(insecure\)' },
  @{ Type = 'secret-value-display'; Pattern = 'AUTH_SECRET.*Set|RAZORPAY.*Set|WATI.*Set|RESEND.*Set' }
)

$Hits = @()
$lineNo = 0
Get-Content -LiteralPath $File | ForEach-Object {
  $lineNo++
  $line = $_
  foreach ($p in $Patterns) {
    if ($line -match $p.Pattern) {
      $Hits += [PSCustomObject]@{
        Type = $p.Type
        LineNumber = $lineNo
        Text = $line.Trim()
      }
    }
  }
}

$Hits | Export-Csv -NoTypeInformation -Encoding UTF8 -Path (Join-Path $OutDir 'admin-settings-exposure.csv')

if ($Hits.Count -gt 0) {
  Write-Host "Admin exposure check found issues: $OutDir" -ForegroundColor Yellow
  exit 1
}

Write-Host "Admin exposure check passed: $OutDir" -ForegroundColor Green
exit 0
