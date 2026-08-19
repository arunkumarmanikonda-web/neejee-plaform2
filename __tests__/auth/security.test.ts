import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'crypto';
import { SignJWT } from 'jose';
import {
  hasValidPrivilegedAssurance,
  signSession,
  verifySession,
  type SessionUser,
} from '../../lib/auth';
import {
  assertNewPasswordIsSafe,
  PasswordSecurityError,
} from '../../lib/password-security';

const adminAal2: SessionUser = {
  id: 'admin-test',
  email: 'admin@example.com',
  name: 'Admin Test',
  role: 'ADMIN',
  aal: 'aal2',
  amr: ['password', 'otp'],
  mfaVerifiedAt: new Date().toISOString(),
};

test('signed AAL2 privileged session verifies', async () => {
  const token = await signSession(adminAal2);
  const verified = await verifySession(token);

  assert.ok(verified);
  assert.equal(verified.role, 'ADMIN');
  assert.equal(verified.aal, 'aal2');
  assert.deepEqual(verified.amr, ['password', 'otp']);
});

test('forged session signed with another secret is rejected', async () => {
  const forgedSecret = new TextEncoder().encode('definitely-not-the-neejee-auth-secret-123456');
  const token = await new SignJWT(adminAal2 as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('neejee')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(forgedSecret);

  assert.equal(await verifySession(token), null);
});

test('privileged assurance rejects password-only and stale MFA', () => {
  assert.equal(
    hasValidPrivilegedAssurance({
      ...adminAal2,
      aal: 'aal1',
      amr: ['password'],
      mfaVerifiedAt: undefined,
    }),
    false,
  );

  assert.equal(
    hasValidPrivilegedAssurance({
      ...adminAal2,
      mfaVerifiedAt: new Date(Date.now() - 13 * 60 * 60 * 1000).toISOString(),
    }),
    false,
  );
});

test('weak passwords are rejected before the breach lookup', async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = (async () => {
    called = true;
    throw new Error('should not be called');
  }) as typeof fetch;

  try {
    await assert.rejects(
      () => assertNewPasswordIsSafe('short'),
      (error: unknown) =>
        error instanceof PasswordSecurityError && error.code === 'WEAK_PASSWORD',
    );
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('known compromised password is rejected using only the hash suffix response', async () => {
  const password = 'StrongButBreached!42';
  const digest = createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
  const suffix = digest.slice(5);
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (_input, init) => {
    assert.equal(new Headers(init?.headers).get('Add-Padding'), 'true');
    assert.match(new Headers(init?.headers).get('User-Agent') || '', /^Neejee\//);
    return new Response(`${suffix}:17\n00000000000000000000000000000000000:0\n`, { status: 200 });
  }) as typeof fetch;

  try {
    await assert.rejects(
      () => assertNewPasswordIsSafe(password),
      (error: unknown) =>
        error instanceof PasswordSecurityError && error.code === 'BREACHED_PASSWORD',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('breach lookup failure fails closed for new passwords', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response('unavailable', { status: 503 })) as typeof fetch;

  try {
    await assert.rejects(
      () => assertNewPasswordIsSafe('UniqueEnough!Password42'),
      (error: unknown) =>
        error instanceof PasswordSecurityError && error.code === 'PASSWORD_CHECK_UNAVAILABLE',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
