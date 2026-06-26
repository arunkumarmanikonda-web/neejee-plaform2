param(
  [string]$Root = (Get-Location).Path
)

$ErrorActionPreference = "Stop"

if (!(Test-Path -LiteralPath $Root)) {
  throw "Project path not found: $Root"
}

$Phase0Dir  = Join-Path $Root "_phase0"
$BackupDir  = Join-Path $Phase0Dir "backups"
$ReportDir  = Join-Path $Phase0Dir "reports"
$EnvDir     = Join-Path $Phase0Dir "env"

New-Item -ItemType Directory -Force -Path $Phase0Dir,$BackupDir,$ReportDir,$EnvDir | Out-Null

# ---------------------------
# 1) Backup
# ---------------------------
$ts = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupCopy = Join-Path $BackupDir "repo_copy_$ts"
New-Item -ItemType Directory -Force -Path $BackupCopy | Out-Null

$excludeNames = @("node_modules",".next","dist","out",".git","_phase0")

Get-ChildItem -LiteralPath $Root -Force | Where-Object {
  $excludeNames -notcontains $_.Name
} | ForEach-Object {
  Copy-Item -LiteralPath $_.FullName -Destination $BackupCopy -Recurse -Force
}

$BackupZip = Join-Path $BackupDir "repo_copy_$ts.zip"
Compress-Archive -Path (Join-Path $BackupCopy "*") -DestinationPath $BackupZip -Force

# ---------------------------
# 2) Collect target files
# ---------------------------
$Targets = @(
  (Join-Path $Root "app"),
  (Join-Path $Root "lib"),
  (Join-Path $Root "prisma"),
  (Join-Path $Root "src"),
  (Join-Path $Root "components")
) | Where-Object { Test-Path -LiteralPath $_ }

$AllowedExt = @(".ts",".tsx",".js",".jsx",".mjs",".cjs",".json",".env",".md")

$CodeFiles = foreach ($t in $Targets) {
  Get-ChildItem -LiteralPath $t -Recurse -File -ErrorAction SilentlyContinue | Where-Object {
    $AllowedExt -contains $_.Extension
  }
}

$CodeFiles = $CodeFiles | Sort-Object FullName -Unique

"Scanned files: $($CodeFiles.Count)" | Set-Content -LiteralPath (Join-Path $ReportDir "00_summary.txt")
$Targets | Add-Content -LiteralPath (Join-Path $ReportDir "00_summary.txt")

# ---------------------------
# 3) Candidate files
# ---------------------------
$CodeFiles |
Where-Object {
  $_.Name -match 'auth|otp|login|verify|order|payment|webhook|ship|deliver|refund|cancel|telecaller|notify|notification|whatsapp|sms|template|message'
} |
Select-Object -ExpandProperty FullName |
Sort-Object |
Set-Content -LiteralPath (Join-Path $ReportDir "01_candidate_files.txt")

# ---------------------------
# 4) Keyword scan
# ---------------------------
$Patterns = @(
  "aisensy",
  "whatsapp",
  "sendwhatsapp",
  "sendmessage",
  "sms",
  "fast2sms",
  "dlt",
  "otp",
  "notification",
  "notify",
  "template",
  "order",
  "payment",
  "refund",
  "cancel",
  "shipped",
  "delivery",
  "telecaller",
  "webhook",
  "razorpay"
)

$KeywordHits = foreach ($f in $CodeFiles) {
  $lineNo = 0
  Get-Content -LiteralPath $f.FullName -ErrorAction SilentlyContinue | ForEach-Object {
    $lineNo++
    $line = $_
    foreach ($p in $Patterns) {
      if ($line -like "*$p*") {
        [PSCustomObject]@{
          Path = $f.FullName
          LineNumber = $lineNo
          Text = $line.Trim()
        }
        break
      }
    }
  }
}

$KeywordHits |
Sort-Object Path, LineNumber |
ForEach-Object {
  "{0}`t{1}`t{2}" -f $_.Path, $_.LineNumber, $_.Text
} |
Set-Content -LiteralPath (Join-Path $ReportDir "02_keyword_hits.txt")

# ---------------------------
# 5) Env ref scan
# ---------------------------
$EnvHits = foreach ($f in $CodeFiles) {
  $lineNo = 0
  Get-Content -LiteralPath $f.FullName -ErrorAction SilentlyContinue | ForEach-Object {
    $lineNo++
    $line = $_
    if ($line -match 'process\.env\.[A-Z0-9_]+|NEXT_PUBLIC_[A-Z0-9_]+') {
      [PSCustomObject]@{
        Path = $f.FullName
        LineNumber = $lineNo
        Text = $line.Trim()
      }
    }
  }
}

$EnvHits |
Sort-Object Path, LineNumber |
ForEach-Object {
  "{0}`t{1}`t{2}" -f $_.Path, $_.LineNumber, $_.Text
} |
Set-Content -LiteralPath (Join-Path $ReportDir "03_env_refs.txt")

# ---------------------------
# 6) API route inventory
# ---------------------------
Get-ChildItem -LiteralPath (Join-Path $Root "app") -Recurse -File -ErrorAction SilentlyContinue |
Where-Object { $_.Name -in "route.ts","route.js","route.tsx","route.jsx" } |
Select-Object -ExpandProperty FullName |
Sort-Object |
Set-Content -LiteralPath (Join-Path $ReportDir "04_api_route_files.txt")

# ---------------------------
# 7) OTP/auth focus
# ---------------------------
$OtpPatterns = @("otp","login","verify","auth","signin","phone","mobile")

$OtpHits = foreach ($f in $CodeFiles) {
  $lineNo = 0
  Get-Content -LiteralPath $f.FullName -ErrorAction SilentlyContinue | ForEach-Object {
    $lineNo++
    $line = $_
    foreach ($p in $OtpPatterns) {
      if ($line -like "*$p*") {
        [PSCustomObject]@{
          Path = $f.FullName
          LineNumber = $lineNo
          Text = $line.Trim()
        }
        break
      }
    }
  }
}

$OtpHits |
Sort-Object Path, LineNumber |
ForEach-Object {
  "{0}`t{1}`t{2}" -f $_.Path, $_.LineNumber, $_.Text
} |
Set-Content -LiteralPath (Join-Path $ReportDir "05_otp_focus.txt")

# ---------------------------
# 8) Extract env variable names
# ---------------------------
$RuntimeFiles = foreach ($t in $Targets) {
  Get-ChildItem -LiteralPath $t -Recurse -File -ErrorAction SilentlyContinue | Where-Object {
    $_.Extension -in @(".ts",".tsx",".js",".jsx",".mjs",".cjs")
  }
}

$RuntimeFiles = $RuntimeFiles | Sort-Object FullName -Unique
$Vars = New-Object System.Collections.Generic.HashSet[string]

foreach ($f in $RuntimeFiles) {
  $content = Get-Content -LiteralPath $f.FullName -Raw -ErrorAction SilentlyContinue

  [regex]::Matches($content, 'process\.env\.([A-Z0-9_]+)') | ForEach-Object {
    [void]$Vars.Add($_.Groups[1].Value)
  }

  [regex]::Matches($content, '\b(NEXT_PUBLIC_[A-Z0-9_]+)\b') | ForEach-Object {
    [void]$Vars.Add($_.Groups[1].Value)
  }
}

@("AUTH_SECRET","DATABASE_URL") | ForEach-Object { [void]$Vars.Add($_) }

$SortedVars = @($Vars) | Sort-Object
$SortedVars | ForEach-Object { "$_=" } |
Set-Content -LiteralPath (Join-Path $EnvDir ".env.phase0.required.example")

$SortedVars | ForEach-Object {
  [PSCustomObject]@{
    Secret = $_
    Purpose = ""
    UsedBy = ""
    EnvironmentsRequired = "dev,preview,prod"
    Owner = ""
    RotationPolicy = ""
    Notes = ""
  }
} | Export-Csv -NoTypeInformation -Encoding UTF8 -Path (Join-Path $EnvDir "ENV_REGISTRY_TEMPLATE.csv")

# ---------------------------
# 9) Safety checks
# ---------------------------
$LogoutGetRoutes = foreach ($f in (Get-ChildItem -LiteralPath (Join-Path $Root "app") -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -eq "route.ts" -and $_.FullName -match 'logout\\route\.ts$' })) {
  $raw = Get-Content -LiteralPath $f.FullName -Raw -ErrorAction SilentlyContinue
  if ($raw -match 'export\s+async\s+function\s+GET\s*\(') {
    [PSCustomObject]@{ File = $f.FullName; Issue = "GET logout route detected" }
  }
}
$LogoutGetRoutes | Export-Csv -NoTypeInformation -Encoding UTF8 -Path (Join-Path $ReportDir "logout_get_routes.csv")

$UnderscoreApiDirs = Get-ChildItem -LiteralPath (Join-Path $Root "app\api") -Recurse -Directory -ErrorAction SilentlyContinue | Where-Object {
  $_.Name -like "_*"
}
$UnderscoreApiDirs | Select-Object FullName | Export-Csv -NoTypeInformation -Encoding UTF8 -Path (Join-Path $ReportDir "underscore_api_dirs.csv")

$Summary = [PSCustomObject]@{
  ScannedFiles = $CodeFiles.Count
  BackupCopy = $BackupCopy
  BackupZip = $BackupZip
  CandidateFileList = (Join-Path $ReportDir "01_candidate_files.txt")
  KeywordHits = (Join-Path $ReportDir "02_keyword_hits.txt")
  EnvRefs = (Join-Path $ReportDir "03_env_refs.txt")
  ApiRoutes = (Join-Path $ReportDir "04_api_route_files.txt")
  OtpFocus = (Join-Path $ReportDir "05_otp_focus.txt")
  EnvTemplate = (Join-Path $EnvDir ".env.phase0.required.example")
  EnvRegistry = (Join-Path $EnvDir "ENV_REGISTRY_TEMPLATE.csv")
}
$Summary | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $Phase0Dir "phase0-output.json")

Write-Host ""
Write-Host "Phase 0 complete." -ForegroundColor Green
Write-Host "Backup zip:  $BackupZip"
Write-Host "Reports:     $ReportDir"
Write-Host "Env files:   $EnvDir"
Write-Host ""
Write-Host "Open these next:"
Write-Host "  $(Join-Path $ReportDir '00_summary.txt')"
Write-Host "  $(Join-Path $ReportDir '02_keyword_hits.txt')"
Write-Host "  $(Join-Path $ReportDir '03_env_refs.txt')"
Write-Host "  $(Join-Path $ReportDir '04_api_route_files.txt')"
Write-Host "  $(Join-Path $EnvDir '.env.phase0.required.example')"

