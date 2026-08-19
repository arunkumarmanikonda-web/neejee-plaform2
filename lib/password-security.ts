import { createHash } from 'crypto';

const HIBP_RANGE_ENDPOINT = 'https://api.pwnedpasswords.com/range';
const PASSWORD_CHECK_TIMEOUT_MS = 5000;

export type PasswordSecurityErrorCode =
  | 'WEAK_PASSWORD'
  | 'BREACHED_PASSWORD'
  | 'PASSWORD_CHECK_UNAVAILABLE';

export class PasswordSecurityError extends Error {
  constructor(
    public readonly code: PasswordSecurityErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'PasswordSecurityError';
  }
}

function assertPasswordStrength(password: string) {
  if (password.length < 12) {
    throw new PasswordSecurityError(
      'WEAK_PASSWORD',
      'Password must contain at least 12 characters.',
    );
  }

  if (password.length > 128) {
    throw new PasswordSecurityError(
      'WEAK_PASSWORD',
      'Password must contain no more than 128 characters.',
    );
  }

  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);

  if (!hasLower || !hasUpper || !hasNumber || !hasSymbol) {
    throw new PasswordSecurityError(
      'WEAK_PASSWORD',
      'Password must include upper-case, lower-case, numeric and symbol characters.',
    );
  }
}

async function isCompromisedPassword(password: string): Promise<boolean> {
  const digest = createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
  const prefix = digest.slice(0, 5);
  const suffix = digest.slice(5);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PASSWORD_CHECK_TIMEOUT_MS);

  try {
    const response = await fetch(`${HIBP_RANGE_ENDPOINT}/${prefix}`, {
      method: 'GET',
      headers: {
        'Add-Padding': 'true',
        'User-Agent': 'Neejee/1.0 password-security',
      },
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HIBP password range request failed with ${response.status}`);
    }

    const body = await response.text();

    for (const line of body.split(/\r?\n/)) {
      const [candidateSuffix, count] = line.trim().split(':');
      if (candidateSuffix === suffix && Number(count || 0) > 0) {
        return true;
      }
    }

    return false;
  } catch (error) {
    if (error instanceof PasswordSecurityError) throw error;
    throw new PasswordSecurityError(
      'PASSWORD_CHECK_UNAVAILABLE',
      'We could not safely validate this password right now. Please try again.',
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function assertNewPasswordIsSafe(password: string): Promise<void> {
  assertPasswordStrength(password);

  if (await isCompromisedPassword(password)) {
    throw new PasswordSecurityError(
      'BREACHED_PASSWORD',
      'This password has appeared in known data breaches. Please choose a different password.',
    );
  }
}
