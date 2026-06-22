# v23.20 — Auth Providers Setup Guide

This release adds **Fast2SMS OTP** + **Google / Apple / Facebook** social login.
All four are optional — the login page works in mock mode until you wire each one.

---

## 1. Fast2SMS (Indian SMS OTP)

1. Sign up at https://www.fast2sms.com → Verify your business
2. Buy credits (start with ₹500 — gets you ~1,600 OTPs)
3. Dashboard → **Dev API** → copy your **API Authorization Key**
4. In Vercel → Project Settings → Environment Variables, add:
   - `FAST2SMS_API_KEY` = `<your authorization key>`
5. Redeploy

**Until this is set:** the OTP flow runs in **mock mode** — the code is returned
in the API response and shown in the login UI inside a haldi-coloured box. Perfect
for testing without spending credits.

---

## 2. Google Sign-In

1. Go to https://console.cloud.google.com/apis/credentials
2. Create an **OAuth 2.0 Client ID** of type **Web application**
3. Authorized JavaScript origins: add `https://www.neejee.com` (and `http://localhost:3000` for dev)
4. Authorized redirect URIs: not required for ID-token flow
5. Copy the **Client ID**
6. In Vercel env vars add:
   - `GOOGLE_CLIENT_ID` = `<the client id>` (server-side verification)
   - `NEXT_PUBLIC_GOOGLE_CLIENT_ID` = `<same value>` (client-side button rendering)

---

## 3. Apple Sign-In

1. https://developer.apple.com/account → Certificates, IDs & Profiles
2. **Identifiers** → register a new **Services ID** (NOT an App ID)
   - Identifier: e.g. `com.neejee.web`
   - Enable **Sign in with Apple**
   - Configure: domains and subdomains → `neejee.com` · Return URLs → `https://www.neejee.com/login`
3. Save the Services ID — this is your `APPLE_CLIENT_ID`
4. In Vercel env vars:
   - `APPLE_CLIENT_ID` = `com.neejee.web`
   - `NEXT_PUBLIC_APPLE_CLIENT_ID` = `com.neejee.web`

Note: For server-to-server features (revoke, refresh) you'd also need an Apple
private key, but that's not required for our verification-only flow.

---

## 4. Facebook Login

1. https://developers.facebook.com/apps → Create app → Type: **Consumer** → Name: NEEJEE
2. Add the **Facebook Login** product
3. Settings → Basic → copy **App ID** and **App Secret**
4. Facebook Login → Settings:
   - Valid OAuth Redirect URIs: `https://www.neejee.com/login`
   - Add `www.neejee.com` under **App Domains**
5. Add a **Privacy Policy URL** and **Terms URL** (required before going live)
6. In Vercel env vars:
   - `FACEBOOK_APP_ID` = `<app id>`
   - `FACEBOOK_APP_SECRET` = `<app secret>`  *(server-side, never exposed)*
   - `NEXT_PUBLIC_FACEBOOK_APP_ID` = `<same as app id>` (client-side button)

---

## Quick sanity check after each provider is wired

Visit `/api/auth/social/availability` — should return:
```json
{ "google": true, "apple": true, "facebook": true }
```
Each `true` means that provider's button appears on `/login`.

---

## Costs at a glance

| Provider          | Cost                              |
|-------------------|-----------------------------------|
| Fast2SMS OTP      | ~₹0.30 per SMS                    |
| Google login      | Free                              |
| Apple login       | Free (requires $99/yr Apple Dev) |
| Facebook login    | Free                              |
