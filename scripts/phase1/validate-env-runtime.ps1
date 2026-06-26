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

$Vars = New-Object System.Collections.Generic.HashSet[string]

foreach ($f in $Files) {
  $content = Get-Content -LiteralPath $f.FullName -Raw -ErrorAction SilentlyContinue
  [regex]::Matches($content, 'process\.env\.([A-Z0-9_]+)') | ForEach-Object {
    [void]$Vars.Add($_.Groups[1].Value)
  }
  [regex]::Matches($content, '\b(NEXT_PUBLIC_[A-Z0-9_]+)\b') | ForEach-Object {
    [void]$Vars.Add($_.Groups[1].Value)
  }
}

$AllVars = @($Vars) | Sort-Object

$Flags = foreach ($v in $AllVars) {
  [PSCustomObject]@{
    Variable = $v
    IsPublic = $v -like 'NEXT_PUBLIC_*'
    IsSecretish = ($v -match 'SECRET|KEY|TOKEN|PASSWORD')
    IsMessaging = ($v -match 'WATI|FAST2SMS|SMS|WHATSAPP|OTP|AISENSY|WA_')
    IsPayments = ($v -match 'RAZORPAY|PAY')
    IsStorage = ($v -match 'SUPABASE|S3|BLOB|STORAGE')
  }
}

$Flags | Export-Csv -NoTypeInformation -Encoding UTF8 -Path (Join-Path $OutDir 'env-runtime-flags.csv')

$Problems = @()
foreach ($row in $Flags) {
  if ($row.IsPublic -and $row.IsSecretish) {
    $Problems += [PSCustomObject]@{
      Type = 'public-secret-risk'
      Variable = $row.Variable
      Note = 'NEXT_PUBLIC variable appears secret-like'
    }
  }
}

$Problems | Export-Csv -NoTypeInformation -Encoding UTF8 -Path (Join-Path $OutDir 'env-runtime-risks.csv')
$AllVars | Set-Content -LiteralPath (Join-Path $OutDir 'env-runtime-vars.txt') -Encoding UTF8

Write-Host "Env/runtime validation complete: $OutDir" -ForegroundColor Green
