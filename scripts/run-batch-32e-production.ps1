param(
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
Set-Location C:\dev\neejee-plaform2

$env:dotenv_config_path = ".env.production.local"
$env:dotenv_config_encoding = "utf8"

try {
  $dbJson = node -r dotenv/config .\scripts\check-seller-db.cjs
  if ($LASTEXITCODE -ne 0) { throw "DB check failed." }

  $db = $dbJson | ConvertFrom-Json
  $db | ConvertTo-Json -Depth 6

  if ([int]$db.sellerCount -le 0) {
    throw "Production env still returns 0 sellers. Stop here."
  }

  node -r dotenv/config .\scripts\report-seller-address-coverage.cjs
  if ($LASTEXITCODE -ne 0) { throw "Coverage audit failed." }

  node -r dotenv/config .\scripts\export-legacy-seller-address-candidates.cjs
  if ($LASTEXITCODE -ne 0) { throw "Candidate export failed." }

  node -r dotenv/config .\scripts\backfill-legacy-seller-addresses.cjs --file=.\scripts\legacy-seller-addresses.ready.json --dry-run
  if ($LASTEXITCODE -ne 0) { throw "Dry run failed." }

  if ($Force) {
    node -r dotenv/config .\scripts\backfill-legacy-seller-addresses.cjs --file=.\scripts\legacy-seller-addresses.ready.json --force
  } else {
    node -r dotenv/config .\scripts\backfill-legacy-seller-addresses.cjs --file=.\scripts\legacy-seller-addresses.ready.json
  }
  if ($LASTEXITCODE -ne 0) { throw "Live backfill failed." }

  Get-Content .\scripts\seller-address-coverage.json -First 120
  Get-Content .\scripts\legacy-seller-addresses.ready.json -First 120
  git status --short
}
finally {
  Remove-Item Env:dotenv_config_path -ErrorAction SilentlyContinue
  Remove-Item Env:dotenv_config_encoding -ErrorAction SilentlyContinue
}