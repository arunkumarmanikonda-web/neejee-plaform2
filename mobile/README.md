# Neejee mobile

The Android and iPhone/iPad companions use the existing Neejee identity and Surkh artwork. The native home opens the same shopping bag, Aaina, account and role-protected staff screens the website uses. Product data, customer authentication, camera consent and checkout stay with the first-party site in an Android browser Custom Tab or iOS Safari View Controller. A browser compatible with HTTPS is required on Android. Native screens do not read cookies, handle card data or hold integration keys.

## Test builds

| Platform | Build command | Output |
| --- | --- | --- |
| Android 8+ | With JDK 17+, Android SDK Platform 36 and Build Tools 36.0.0 present, set ANDROID_SDK_ROOT and run bash mobile/android/build-test.sh | mobile/build/Neejee-Android-Test.apk |
| iPhone and iPad, iOS 16+ | On macOS with Xcode 16+ and the iOS SDK, run bash mobile/ios/build-simulator.sh | mobile/build/ios/Debug-iphonesimulator/Neejee.app |

The optional positional arguments to either build script are exact, trusted deployment hostnames from the Neejee Vercel project. Each must be independently verified as belonging to the project before inclusion. Without these arguments the app opens the public store. With at least one, the native home also offers Open a review link. Testers can paste the protected preview URL there. Only its origin is retained by the native shell; the browser receives the share link for normal preview access. The native app does not store preview tokens.

The **Build Neejee test apps** workflow builds both targets on manual dispatch. On a push to the integration release branch it can build the iPhone/iPad simulator app when its source or native artwork changes. Each Android build creates its own temporary testing signature. Uninstall an earlier test APK before installing a different test build. The iOS simulator product runs in Simulator and cannot be installed on a physical iPhone. The web app can be installed on iPhone or iPad from Safari.

## Distribution

The application ID and bundle ID are both com.neejee.mobile.preview for testing. Confirm the verified production IDs, existing Play upload lineage, app version counters and Apple provisioning before preparing store releases. The scripts never publish or access signing accounts. Complete on-device tests for login, staff camera consent and retake, bag, payment-provider handoff and return-to-order on each platform before release.
