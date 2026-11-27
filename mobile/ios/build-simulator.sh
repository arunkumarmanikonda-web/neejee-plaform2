#!/usr/bin/env bash
# macOS, Xcode 16+ with the iOS SDK. Test target covers iPhone and iPad.
set -euo pipefail
mobile_dir=$(cd "$(dirname "$0")/.." && pwd)
repo_dir=$(cd "$mobile_dir/.." && pwd)
ios_dir="$mobile_dir/ios"
resources="$ios_dir/Neejee/Assets.xcassets"
cp "$mobile_dir/wordmark.png" "$resources/Wordmark.imageset/wordmark.png"
sips -s format jpeg "$repo_dir/public/brand/surkh-campaign/portrait-768.webp" --out "$resources/Surkh.imageset/surkh.jpg" >/dev/null
sips -z 1024 1024 -s format png "$repo_dir/public/brand/identity/icon-512.png" --out "$resources/AppIcon.appiconset/icon.png" >/dev/null
: > "$ios_dir/Neejee/review-hosts.txt"
for review_host in neejee-plaform2-git-release-neeje-ddbb5c-akms-projects-1230b0a9.vercel.app "$@"; do
  if [[ ! "$review_host" =~ ^neejee-plaform2-[a-z0-9-]+-akms-projects-1230b0a9\.vercel\.app$ ]]; then
    echo 'Only exact approved Neejee project hostnames may be packaged.' >&2; exit 2
  fi
  printf '%s\n' "$review_host" >> "$ios_dir/Neejee/review-hosts.txt"
done
xcodebuild -project "$ios_dir/Neejee.xcodeproj" -target Neejee -configuration Debug -sdk iphonesimulator \
  SYMROOT="$repo_dir/mobile/build/ios" CODE_SIGNING_ALLOWED=NO build
