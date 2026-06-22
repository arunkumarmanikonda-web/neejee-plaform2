// Phone number helpers — normalise to E.164 with +91 (India) as default.

/**
 * Normalise an arbitrary user-typed phone string to E.164.
 * Default country: India (+91).
 * Returns null if the result is not a plausible mobile number.
 */
export function normalizePhone(input: string, defaultCountry: string = 'IN'): string | null {
  if (!input) return null;
  const cleaned = input.replace(/[^\d+]/g, '');
  if (!cleaned) return null;

  // Already in E.164 (+countrycode + national number)
  if (cleaned.startsWith('+')) {
    const digits = cleaned.slice(1);
    if (digits.length < 8 || digits.length > 15) return null;
    return cleaned;
  }

  // Bare-digit input — use defaultCountry to infer
  if (defaultCountry === 'IN') {
    if (cleaned.length === 12 && cleaned.startsWith('91')) return '+' + cleaned;
    if (cleaned.length === 11 && cleaned.startsWith('0')) return '+91' + cleaned.slice(1);
    if (cleaned.length === 10 && /^[6-9]/.test(cleaned)) return '+91' + cleaned;
  }

  // Generic: 10–15 digits with no leading zero — treat as already including country code
  if (cleaned.length >= 10 && cleaned.length <= 15) return '+' + cleaned;

  return null;
}

/** Loose check: does this string look more like a phone than an email/anything else? */
export function looksLikePhone(input: string): boolean {
  if (!input) return false;
  if (input.includes('@')) return false;
  const digits = input.replace(/[^\d]/g, '');
  return digits.length >= 8 && digits.length <= 15;
}

/** Format E.164 back to display: +91 98765 43210 */
export function formatPhoneDisplay(e164: string): string {
  if (!e164) return '';
  if (e164.startsWith('+91') && e164.length === 13) {
    return `+91 ${e164.slice(3, 8)} ${e164.slice(8)}`;
  }
  return e164;
}
