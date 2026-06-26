param(
  [string]$Root = (Get-Location).Path
)

$ErrorActionPreference = 'Stop'
$OutDir = Join-Path $Root '_phase1\reports'
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$AppDir = Join-Path $Root 'app'
if (!(Test-Path $AppDir)) { exit 0 }

$RouteFiles = Get-ChildItem -LiteralPath $AppDir -Recurse -File -ErrorAction SilentlyContinue | Where-Object {
  $_.Name -in @('route.ts','route.js')
}

$Hits = foreach ($f in $RouteFiles) {
  $raw = Get-Content -LiteralPath $f.FullName -Raw -ErrorAction SilentlyContinue
  if ($f.FullName -match 'logout\\route\.(ts|js)$' -and $raw -match 'export\s+async\s+function\s+GET\s*\(') {
    [PSCustomObject]@{
      Type = 'logout-get-route'
      Path = $f.FullName
      Note = 'Logout route exposes GET handler'
    }
  }
}

$Hits | Export-Csv -NoTypeInformation -Encoding UTF8 -Path (Join-Path $OutDir 'logout-safety.csv')

Write-Host "Logout safety check complete: $OutDir" -ForegroundColor Green
