// Vercel CLI imports and pasted .env values can retain quotes or line endings.
export function readCredential(value: string | undefined): string {
  const trimmed = (value ?? '').trim();
  const quote = trimmed[0];
  if ((quote === '"' || quote === "'") && trimmed.endsWith(quote)) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

export function razorpayCredentials() {
  const serverId = readCredential(process.env.RAZORPAY_KEY_ID);
  const publicId = readCredential(process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID);
  // Older storefront installations also store the merchant's publishable ID here.
  // A public test ID must never enable test payments on the live storefront.
  const usablePublicId = /^rzp_(live|test)_[a-zA-Z0-9]+$/.test(publicId)
    && (process.env.VERCEL_ENV !== 'production' || publicId.startsWith('rzp_live_'));
  return {
    keyId: serverId || (usablePublicId ? publicId : ''),
    keySecret: readCredential(process.env.RAZORPAY_KEY_SECRET),
  };
}

export function liveCheckoutUnavailable(keyId = razorpayCredentials().keyId) {
  return process.env.VERCEL_ENV === 'production' && !/^rzp_live_[A-Za-z0-9]+$/.test(keyId);
}
