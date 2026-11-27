// Vercel CLI imports and pasted .env values can retain quotes or line endings.
function readCredential(value: string | undefined): string {
  const trimmed = (value ?? '').trim();
  const quote = trimmed[0];
  if ((quote === '"' || quote === "'") && trimmed.endsWith(quote)) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

export function razorpayCredentials() {
  return {
    keyId: readCredential(process.env.RAZORPAY_KEY_ID),
    keySecret: readCredential(process.env.RAZORPAY_KEY_SECRET),
  };
}
