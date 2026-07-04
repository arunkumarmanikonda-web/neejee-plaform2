# OTP / DLT Template Mapping Decision

- Decision date: 2026-07-04
- Tracker item: P0-005
- Status: Controlled deferral with explicit ownership
- Reason: OTP engine is already live for currently verified flows; full template expansion is not required to continue blueprint execution.

## Scope reviewed
The following OTP purposes were reviewed for DLT template coverage:

1. Customer login
2. Customer signup
3. Admin 2FA
4. Checkout guest OTP
5. Change phone number

## Decision
For blueprint execution, each OTP purpose must satisfy one of the following:
- mapped to an approved DLT template ID, or
- explicitly deferred with owner and target date

Current closure decision:
- Existing verified live flows remain allowed
- Any not-yet-used or not-yet-verified template mappings remain deferred
- No new OTP surface should be expanded without confirming its DLT template ID first

## Expected environment coverage
Review these environment variables in the runtime configuration where applicable:

- FAST2SMS_DLT_LOGIN_MESSAGE_ID
- FAST2SMS_DLT_SIGNUP_MESSAGE_ID
- FAST2SMS_DLT_ADMIN_2FA_MESSAGE_ID
- FAST2SMS_DLT_CHECKOUT_GUEST_MESSAGE_ID
- FAST2SMS_DLT_CHANGE_PHONE_MESSAGE_ID

## Deferral record
- Owner: Platform / Auth
- Target date: 2026-07-11
- Tracking source: blueprint tracker row P0-005
- Launch blocking status: No, for currently verified OTP flows only

## Gate for future changes
Before enabling any additional OTP journey in production:
1. verify the exact DLT template ID exists
2. verify the correct env variable is present
3. run one end-to-end OTP test for that purpose
4. update the tracker and this document

## Result
P0-005 is closed as a documented decision item, with explicit owner, date, and scope limitation.
