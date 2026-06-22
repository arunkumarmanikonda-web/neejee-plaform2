# ─── NEEJEE v23.35 Deploy Script (PowerShell) ────────────────────────────────
# Fast2SMS DLT + OTP Everywhere
# Usage: Open PowerShell in C:\Users\arunk\OneDrive\Desktop\neejee-v6 and run:
#   .\DEPLOY_v23_35.ps1
# ─────────────────────────────────────────────────────────────────────────────

$ErrorActionPreference = 'Stop'

# CONFIG — adjust if your paths differ
$DesktopRoot   = "C:\Users\arunk\OneDrive\Desktop\neejee-v6"
$ZipUrl        = "https://www.genspark.ai/api/files/s/1KZEt4Se"
$ZipFile       = Join-Path $DesktopRoot "neejee-platform-v23-35.zip"
$ExtractDir    = Join-Path $DesktopRoot "neejee-platform-v23-35"
$ProjectDir    = Join-Path $DesktopRoot "neejee-platform"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  NEEJEE v23.35 Deploy — Fast2SMS DLT + OTP" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Step 1 — Download zip
Write-Host "[1/7] Downloading v23.35 bundle..." -ForegroundColor Yellow
if (Test-Path $ZipFile) { Remove-Item $ZipFile -Force }
Invoke-WebRequest -Uri $ZipUrl -OutFile $ZipFile -UseBasicParsing
Write-Host "       Downloaded: $ZipFile" -ForegroundColor Green

# Step 2 — Extract
Write-Host "[2/7] Extracting..." -ForegroundColor Yellow
if (Test-Path $ExtractDir) { Remove-Item $ExtractDir -Recurse -Force }
Expand-Archive -Path $ZipFile -DestinationPath $ExtractDir -Force
$ExtractedRoot = Join-Path $ExtractDir "neejee-platform"
Write-Host "       Extracted to: $ExtractedRoot" -ForegroundColor Green

# Step 3 — Sync into project (skip node_modules, .next, .git, .env*)
Write-Host "[3/7] Syncing files into project..." -ForegroundColor Yellow
if (-not (Test-Path $ProjectDir)) {
    Write-Host "       Project dir not found at $ProjectDir" -ForegroundColor Red
    Write-Host "       Creating fresh checkout..." -ForegroundColor Yellow
    Copy-Item -Path $ExtractedRoot -Destination $ProjectDir -Recurse -Force
} else {
    robocopy $ExtractedRoot $ProjectDir /MIR `
        /XD node_modules .next .git .vercel `
        /XF .env .env.local .env.production `
        /NFL /NDL /NJH /NJS /NC /NS /NP | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "robocopy failed with exit code $LASTEXITCODE" }
}
Write-Host "       Files synced." -ForegroundColor Green

# Step 4 — Install deps (only if package.json changed or node_modules missing)
Set-Location $ProjectDir
$nodeModulesExists = Test-Path (Join-Path $ProjectDir "node_modules")
if (-not $nodeModulesExists) {
    Write-Host "[4/7] Installing dependencies (npm ci)..." -ForegroundColor Yellow
    npm ci
} else {
    Write-Host "[4/7] node_modules exists — running npm install for safety..." -ForegroundColor Yellow
    npm install
}
Write-Host "       Dependencies ready." -ForegroundColor Green

# Step 5 — Regenerate Prisma client (new SmsTemplate + OtpCode models)
Write-Host "[5/7] Generating Prisma client..." -ForegroundColor Yellow
npx prisma generate
Write-Host "       Prisma client regenerated." -ForegroundColor Green

# Step 6 — Reminders BEFORE pushing
Write-Host ""
Write-Host "[6/7] === PRE-DEPLOY CHECKLIST ===" -ForegroundColor Magenta
Write-Host ""
Write-Host "   ☐ Run SPRINT_9_17_MIGRATION.sql in Supabase SQL editor" -ForegroundColor White
Write-Host "     (creates SmsTemplate + OtpCode tables, seeds 10 events)" -ForegroundColor Gray
Write-Host ""
Write-Host "   ☐ Vercel env vars set (Production + Preview):" -ForegroundColor White
Write-Host "       FAST2SMS_API_KEY        = (from Fast2SMS dashboard → Dev API)" -ForegroundColor Gray
Write-Host "       FAST2SMS_SENDER_ID      = NEEJEE" -ForegroundColor Gray
Write-Host "       FAST2SMS_DLT_ENTITY_ID  = (your 19-digit PEID from Jio TrueConnect)" -ForegroundColor Gray
Write-Host "       FAST2SMS_MODE           = live" -ForegroundColor Gray
Write-Host ""
$confirm = Read-Host "   Have you done both? (y/n)"
if ($confirm -ne 'y' -and $confirm -ne 'Y') {
    Write-Host ""
    Write-Host "Stopped before deploy. Complete checklist, then re-run this script." -ForegroundColor Yellow
    exit 0
}

# Step 7 — Deploy
Write-Host ""
Write-Host "[7/7] Deploying to Vercel (production, forced)..." -ForegroundColor Yellow
vercel --prod --force

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  ✓ Deploy complete" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Open https://www.neejee.com/admin/settings/sms" -ForegroundColor White
Write-Host "  2. Paste each 19-digit DLT Template ID against its event" -ForegroundColor White
Write-Host "     (Jio TrueConnect → Content Template → copy ID for each)" -ForegroundColor White
Write-Host "  3. Click Save on each row" -ForegroundColor White
Write-Host "  4. Use Send Test panel to verify each template with your own phone" -ForegroundColor White
Write-Host "  5. Watch the Last 50 SMS log to confirm SENT status" -ForegroundColor White
Write-Host ""
