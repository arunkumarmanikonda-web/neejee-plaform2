#!/usr/bin/env bash
# Build a locally signed Android test APK. Uses Android SDK Platform 36, Build Tools 36 and a JDK 17+.
set -euo pipefail
mobile_dir=$(cd "$(dirname "$0")/.." && pwd)
repo_dir=$(cd "$mobile_dir/.." && pwd)
sdk_dir=${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}
: "${sdk_dir:?Set ANDROID_SDK_ROOT to the Android SDK root}"
tools_dir="$sdk_dir/build-tools/36.0.0"
platform="$sdk_dir/platforms/android-36/android.jar"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
output=${NEEJEE_APK_OUTPUT:-"$repo_dir/mobile/build/Neejee-Android-Test.apk"}
mkdir -p "$work"/{assets,classes,dex,res/drawable-nodpi} "$(dirname "$output")"
cp -R "$mobile_dir/android/res/." "$work/res/"
cp "$repo_dir/public/brand/identity/icon-512.png" "$work/res/drawable-nodpi/app_icon.png"
cp "$mobile_dir/wordmark.png" "$work/assets/wordmark.png"
cp "$repo_dir/public/brand/surkh-campaign/portrait-768.webp" "$work/assets/surkh.webp"
: > "$work/assets/review-hosts.txt"
for review_host in "$@"; do
  if [[ ! "$review_host" =~ ^neejee-plaform2-[a-z0-9-]+-akms-projects-1230b0a9\.vercel\.app$ ]]; then
    echo 'Only exact approved Neejee project hostnames may be packaged.' >&2; exit 2
  fi
  printf '%s\n' "$review_host" >> "$work/assets/review-hosts.txt"
done
"$tools_dir/aapt2" compile --dir "$work/res" -o "$work/res.zip"
"$tools_dir/aapt2" link -o "$work/base.apk" -I "$platform" --manifest "$mobile_dir/android/AndroidManifest.xml" -A "$work/assets" "$work/res.zip"
java -m jdk.compiler/com.sun.tools.javac.Main -source 8 -target 8 -bootclasspath "$tools_dir/core-lambda-stubs.jar:$platform" -d "$work/classes" "$mobile_dir/android/src/com/neejee/mobile/"*.java
"$tools_dir/d8" --min-api 26 --lib "$platform" --output "$work/dex" "$work/classes/com/neejee/mobile/"*.class
python3 - "$work/base.apk" "$work/dex/classes.dex" <<'PY'
import sys, zipfile
with zipfile.ZipFile(sys.argv[1], 'a', zipfile.ZIP_DEFLATED) as archive:
    archive.write(sys.argv[2], 'classes.dex')
PY
"$tools_dir/zipalign" -f 4 "$work/base.apk" "$work/zipaligned.apk"
keytool -genkeypair -keystore "$work/test.p12" -storetype PKCS12 -storepass android -keypass android \
  -alias test-only -dname 'CN=Neejee Temporary Test Build' -keyalg RSA -keysize 2048 -validity 30 >/dev/null 2>&1
"$tools_dir/apksigner" sign --ks "$work/test.p12" --ks-pass pass:android --ks-key-alias test-only --out "$output" "$work/zipaligned.apk"
"$tools_dir/apksigner" verify --verbose "$output"
printf 'Built test APK: %s\n' "$output"
