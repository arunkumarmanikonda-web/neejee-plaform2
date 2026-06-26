param(
  [string]$Root = (Get-Location).Path
)

$ErrorActionPreference = 'Stop'
$OutDir = Join-Path $Root '_phase1\reports'
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$Targets = @(
  (Join-Path $Root 'app'),
  (Join-Path $Root 'lib'),
  (Join-Path $Root 'src'),
  (Join-Path $Root 'components')
) | Where-Object { Test-Path $_ }

$Files = foreach ($t in $Targets) {
  Get-ChildItem -LiteralPath $t -Recurse -File -ErrorAction SilentlyContinue | Where-Object {
    $_.Extension -in @('.ts','.tsx','.js','.jsx','.mjs','.cjs')
  }
}

$Patterns = @(
  @{ Name = 'logout-link'; Pattern = '<Link\s+[^>]*href=.*/logout' },
  @{ Name = 'logout-get-fetch'; Pattern = 'fetch\([^)]*logout[^)]*method:\s*["'' ]*GET' },
  @{ Name = 'cookie-delete'; Pattern = 'cookies?\(\).*delete|response\.cookies\.delete|cookies\.delete' },
  @{ Name = 'auth-secret-ref'; Pattern = 'AUTH_SECRET|NEXTAUTH_SECRET' },
  @{ Name = 'session-token-ref'; Pattern = 'session|jwt|token' },
  @{ Name = 'otp-ref'; Pattern = 'otp|2fa|twofa|admin_2fa' },
  @{ Name = 'mock-dev-auth'; Pattern = 'devCode|mockCode|demo-bypass|DEV ONLY' }
)

$Hits = foreach ($f in $Files) {
  $lineNo = 0
  Get-Content -LiteralPath $f.FullName -ErrorAction SilentlyContinue | ForEach-Object {
    $lineNo++
    $line = $_
    foreach ($p in $Patterns) {
      if ($line -match $p.Pattern) {
        [PSCustomObject]@{
          Type = $p.Name
          Path = $f.FullName
          LineNumber = $lineNo
          Text = $line.Trim()
        }
      }
    }
  }
}

$Hits | Sort-Object Type, Path, LineNumber | Export-Csv -NoTypeInformation -Encoding UTF8 -Path (Join-Path $OutDir 'auth-session-hits.csv')
$Hits | Sort-Object Type, Path, LineNumber | ForEach-Object {
  "{0}`t{1}`t{2}`t{3}" -f $_.Type, $_.Path, $_.LineNumber, $_.Text
} | Set-Content -LiteralPath (Join-Path $OutDir 'auth-session-hits.txt') -Encoding UTF8

$Summary = $Hits | Group-Object Type | Sort-Object Name | ForEach-Object {
  [PSCustomObject]@{
    Type = $_.Name
    Count = $_.Count
  }
}

$Summary | Export-Csv -NoTypeInformation -Encoding UTF8 -Path (Join-Path $OutDir 'auth-session-summary.csv')

Write-Host "Auth/session scan complete: $OutDir" -ForegroundColor Green
