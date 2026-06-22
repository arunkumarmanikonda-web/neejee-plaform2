// app/api/auth/otp/resend/route.ts
// v26.3b — Resend OTP. Same logic as /request but always re-runs the
// cooldown check, so genuine retries within 60s are blocked here too.

export { POST } from '../request/route';
