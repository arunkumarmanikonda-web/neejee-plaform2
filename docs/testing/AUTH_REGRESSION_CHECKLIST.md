# Auth Regression Checklist

Status: Active  
Owner: Engineering  
Phase: P0-008

This checklist validates the end-to-end auth surface after OTP cleanup and template-mapping stabilization.

---

## Scope

Covered surfaces:
- `app/(auth)/login/page.tsx`
- `app/api/auth/otp/request/route.ts`
- `app/api/auth/otp/verify/route.ts`
- `app/api/me/route.ts`
- `app/api/auth/logout/route.ts`
- `app/complete-profile/page.tsx`
- `app/account/page.tsx`

---

## Required environment baseline

- `DATABASE_URL` configured
- `AUTH_SECRET` configured
- OTP enabled if OTP flows are being tested
- Fast2SMS credentials and DLT IDs configured if live OTP SMS delivery is being tested

Suggested OTP env contract:
- `FAST2SMS_API_KEY` or `FAST2SMS_AUTH_KEY` or `FAST2SMS_API_TOKEN`
- `FAST2SMS_DLT_SENDER_ID`
- `FAST2SMS_DLT_LOGIN_MESSAGE_ID`
- `FAST2SMS_DLT_ADMIN_MESSAGE_ID`

---

## Test evidence format

For each test:
- Result: PASS / FAIL
- Date:
- Environment:
- Tester:
- Notes:
- Screenshot / log reference:

---

# A. OTP Request

## A1. Existing user login OTP request
**Input**
- valid existing phone
- purpose = `login`

**Expected**
- 200 response
- `ok: true`
- normalized phone returned
- `expiresAt`, `expiresInSec`, `cooldownSec` present

**Actual**
- Result:
- Notes:

---

## A2. Missing phone
**Input**
- empty request body or phone missing

**Expected**
- 400 response
- error message indicates phone is required

**Actual**
- Result:
- Notes:

---

## A3. Invalid phone format
**Input**
- malformed phone

**Expected**
- 400 response
- `Please enter a valid mobile number`

**Actual**
- Result:
- Notes:

---

## A4. Login OTP for non-existing user
**Input**
- unknown phone
- purpose = `login`

**Expected**
- 404 response
- `No account found for this mobile number`

**Actual**
- Result:
- Notes:

---

## A5. Signup OTP for existing user
**Input**
- existing phone
- purpose = `signup`

**Expected**
- 409 response
- `An account already exists for this mobile number`

**Actual**
- Result:
- Notes:

---

## A6. Cooldown enforcement
**Input**
- request OTP twice quickly for same phone + purpose

**Expected**
- second request blocked with 429
- cooldown information returned

**Actual**
- Result:
- Notes:

---

# B. OTP Verify

## B1. Wrong OTP
**Input**
- valid phone
- wrong OTP
- valid purpose

**Expected**
- 401 response
- `Incorrect OTP`

**Actual**
- Result:
- Notes:

---

## B2. Expired OTP
**Input**
- expired OTP

**Expected**
- 401 response
- `OTP expired. Please request a new code.`

**Actual**
- Result:
- Notes:

---

## B3. Max attempts lockout
**Input**
- repeatedly wrong OTP until threshold hit

**Expected**
- final response indicates max attempts
- OTP becomes unusable

**Actual**
- Result:
- Notes:

---

## B4. Signup OTP success
**Input**
- new phone
- valid OTP
- purpose = `signup` or `signup_customer`

**Expected**
- user created
- session cookie set
- redirect returned
- `needsProfileCompletion` likely true

**Actual**
- Result:
- Notes:

---

## B5. Login OTP success
**Input**
- existing customer phone
- valid OTP
- purpose = `login`

**Expected**
- session cookie set
- redirect returned
- user payload returned

**Actual**
- Result:
- Notes:

---

## B6. Admin 2FA OTP success
**Input**
- admin user phone
- valid OTP
- purpose = `admin_2fa`

**Expected**
- session cookie set
- redirect = `/admin`

**Actual**
- Result:
- Notes:

---

# C. Session / /api/me

## C1. /api/me unsigned
**Expected**
- 401 response
- `user: null`

**Actual**
- Result:
- Notes:

---

## C2. /api/me signed in
**Expected**
- user payload present
- role present
- `needsProfileCompletion` returned

**Actual**
- Result:
- Notes:

---

## C3. /api/me after profile update
**Expected**
- updated values reflected
- session remains valid

**Actual**
- Result:
- Notes:

---

# D. Account Page

## D1. /account unsigned
**Expected**
- redirect to `/login?next=/account`

**Actual**
- Result:
- Notes:

---

## D2. /account signed in as customer
**Expected**
- account page loads normally

**Actual**
- Result:
- Notes:

---

## D3. /account signed in as admin/content role
**Expected**
- redirected to `/admin`

**Actual**
- Result:
- Notes:

---

# E. Complete Profile

## E1. Placeholder signup user
**Expected**
- redirected to `/complete-profile`
- form loads correctly

**Actual**
- Result:
- Notes:

---

## E2. Complete profile submission
**Expected**
- profile saved
- post-completion redirect works
- `needsProfileCompletion` becomes false when appropriate

**Actual**
- Result:
- Notes:

---

# F. Logout

## F1. Logout while signed in
**Expected**
- POST `/api/auth/logout` returns success
- `neejee-session` cookie cleared

**Actual**
- Result:
- Notes:

---

## F2. Post-logout access
**Expected**
- `/api/me` returns 401
- protected account flow redirects back to login

**Actual**
- Result:
- Notes:

---

# Final sign-off

## Summary
- Total tests:
- Passed:
- Failed:
- Blocked:

## Blocking issues
- None / list below

## Sign-off
- Auth regression complete: YES / NO
- Ready to close P0-008: YES / NO

