param()

$ErrorActionPreference = 'Stop'

if (-not (Test-Path '.git')) {
  Write-Host 'No git repo yet. Protected-zone check skipped.'
  exit 0
}

$protected = @(
  'app/api/checkout',
  'app/api/razorpay',
  'app/api/admin/finance',
  'app/api/cron/finance',
  'prisma',
  'lib/pricing',
  'lib/inventory',
  'lib/warehouse',
  'lib/taxonomy'
)

$files = git diff --cached --name-only
if (-not $files) { exit 0 }

$hits = @()

foreach ($f in $files) {
  $n = $f.Replace('\','/')
  foreach ($p in $protected) {
    if ($n.StartsWith($p)) {
      $hits += $n
      break
    }
  }
}

if ($hits.Count -gt 0) {
  Write-Host ''
  Write-Host 'Phase 0 blocked commit. Protected zones touched:' -ForegroundColor Red
  $hits | Sort-Object -Unique | ForEach-Object { Write-Host " - $_" -ForegroundColor Red }
  Write-Host ''
  exit 1
}

exit 0
