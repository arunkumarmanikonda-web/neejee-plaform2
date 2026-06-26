param(
  [string]$Root = (Get-Location).Path
)

$ErrorActionPreference = 'Stop'
$OutDir = Join-Path $Root '_phase1\reports'
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$ManifestPath = Join-Path $Root 'config\phase1-env-manifest.json'
$ExamplePath = Join-Path $Root '_phase0\env\.env.phase0.normalized.example'
$RuntimeVarsPath = Join-Path $OutDir 'env-runtime-vars.txt'

if (!(Test-Path $ManifestPath)) { throw "Missing manifest: $ManifestPath" }
if (!(Test-Path $ExamplePath)) { throw "Missing example env file: $ExamplePath" }
if (!(Test-Path $RuntimeVarsPath)) { throw "Missing runtime vars file: $RuntimeVarsPath" }

$Manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
$ExampleLines = Get-Content -LiteralPath $ExamplePath | Where-Object { $_ -match '^[A-Z0-9_]+=' }
$ExampleVars = $ExampleLines | ForEach-Object { ($_ -split '=',2)[0].Trim() } | Sort-Object -Unique
$RuntimeVars = Get-Content -LiteralPath $RuntimeVarsPath | Where-Object { $_.Trim() -ne '' } | Sort-Object -Unique

$Rows = @()

foreach ($v in $RuntimeVars) {
  $Rows += [PSCustomObject]@{
    Variable = $v
    InExample = ($ExampleVars -contains $v)
    IsPublic = ($v -like 'NEXT_PUBLIC_*')
    SecretLike = ($v -match 'SECRET|KEY|TOKEN|PASSWORD')
    PublicAllowed = ($Manifest.public_allowed -contains $v)
  }
}

$Rows | Export-Csv -NoTypeInformation -Encoding UTF8 -Path (Join-Path $OutDir 'env-consistency.csv')

$Failures = @()

foreach ($v in $Manifest.critical_required) {
  if ($ExampleVars -notcontains $v) {
    $Failures += "Critical variable missing from example: $v"
  }
}

foreach ($v in $Manifest.deployment_required) {
  if ($ExampleVars -notcontains $v) {
    $Failures += "Deployment variable missing from example: $v"
  }
}

foreach ($row in $Rows) {
  if (-not $row.InExample) {
    $Failures += "Runtime variable missing from example: $($row.Variable)"
  }
  if ($row.IsPublic -and $row.SecretLike -and -not $row.PublicAllowed) {
    $Failures += "Public variable looks secret-like and is not allowlisted: $($row.Variable)"
  }
}

$ExampleMap = @{}
foreach ($line in $ExampleLines) {
  $parts = $line -split '=',2
  $ExampleMap[$parts[0].Trim()] = $parts[1]
}

$Manifest.phase0_runtime_flags.PSObject.Properties | ForEach-Object {
  $name = $_.Name
  $expected = [string]$_.Value
  if (-not $ExampleMap.ContainsKey($name)) {
    $Failures += "Phase0 flag missing from example: $name"
  } elseif (($ExampleMap[$name]).Trim() -ne $expected) {
    $Failures += "Phase0 flag has unexpected value in example: $name=$($ExampleMap[$name]) expected $expected"
  }
}

$Failures | Set-Content -LiteralPath (Join-Path $OutDir 'env-consistency-failures.txt') -Encoding UTF8

if ($Failures.Count -gt 0) {
  Write-Host "Env consistency check found issues: $OutDir" -ForegroundColor Yellow
  exit 1
}

Write-Host "Env consistency check passed: $OutDir" -ForegroundColor Green
exit 0
