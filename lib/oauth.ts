// Social OAuth verifiers — Google, Apple, Facebook.
//
// All three return a unified shape: { ok, email?, name?, picture?, providerId?, error? }
// when the token is valid. We don't store provider tokens beyond verification.
//
// Token sources (client-side):
//   Google   — Google Identity Services button returns an ID token (JWT)
//   Apple    — Sign in with Apple returns an ID token (JWT)
//   Facebook — Facebook JS SDK returns an access token (opaque string)

import { jwtVerify, createRemoteJWKSet, decodeJwt } from 'jose';

export interface OAuthVerifyResult {
  ok: boolean;
  email?: string;
  emailVerified?: boolean;
  name?: string;
  picture?: string;
  providerId?: string;     // The provider's stable user id (sub)
  provider?: 'google' | 'apple' | 'facebook';
  error?: string;
}

// ───────── GOOGLE ─────────
// Google ID tokens are signed JWTs issued by https://accounts.google.com.
// We verify the signature using Google's JWKS, then check the audience.

const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

export async function verifyGoogleIdToken(idToken: string): Promise<OAuthVerifyResult> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return { ok: false, error: 'GOOGLE_CLIENT_ID not configured' };
  if (!idToken) return { ok: false, error: 'No id_token provided' };

  try {
    const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: clientId,
    });
    if (!payload.sub) return { ok: false, error: 'Token has no subject' };
    return {
      ok: true,
      provider: 'google',
      providerId: payload.sub as string,
      email: (payload.email as string | undefined)?.toLowerCase(),
      emailVerified: (payload.email_verified as boolean | undefined) ?? false,
      name: payload.name as string | undefined,
      picture: payload.picture as string | undefined,
    };
  } catch (e: any) {
    return { ok: false, error: `Google token invalid: ${e.message}` };
  }
}

// ───────── APPLE ─────────
// Apple ID tokens are signed JWTs issued by https://appleid.apple.com.
// Audience is your Service ID (a.k.a. APPLE_CLIENT_ID).
// Apple's `email` claim only appears on the first sign-in; future sign-ins
// only carry `sub`. We rely on `sub` as the stable identifier.

const APPLE_JWKS = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));

export async function verifyAppleIdToken(idToken: string): Promise<OAuthVerifyResult> {
  const clientId = process.env.APPLE_CLIENT_ID;
  if (!clientId) return { ok: false, error: 'APPLE_CLIENT_ID not configured' };
  if (!idToken) return { ok: false, error: 'No id_token provided' };

  try {
    const { payload } = await jwtVerify(idToken, APPLE_JWKS, {
      issuer: 'https://appleid.apple.com',
      audience: clientId,
    });
    if (!payload.sub) return { ok: false, error: 'Token has no subject' };
    return {
      ok: true,
      provider: 'apple',
      providerId: payload.sub as string,
      email: (payload.email as string | undefined)?.toLowerCase(),
      emailVerified: (payload.email_verified as any) === 'true' || payload.email_verified === true,
    };
  } catch (e: any) {
    // Last-ditch: decode without verification just to surface a useful error if Apple
    // changed something. We still return failure.
    try { decodeJwt(idToken); } catch {}
    return { ok: false, error: `Apple token invalid: ${e.message}` };
  }
}

// ───────── FACEBOOK ─────────
// Facebook gives the client an opaque access_token. We hit the Graph API to
// validate it and pull the user's basic profile in one shot.

export async function verifyFacebookAccessToken(accessToken: string): Promise<OAuthVerifyResult> {
  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (!appId) return { ok: false, error: 'FACEBOOK_APP_ID not configured' };
  if (!accessToken) return { ok: false, error: 'No access_token provided' };

  try {
    // 1. Inspect the token using app credentials (debug_token) to confirm the
    //    token was minted for OUR app and is still valid.
    if (appSecret) {
      const debugUrl = `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${encodeURIComponent(appId + '|' + appSecret)}`;
      const debugRes = await fetch(debugUrl);
      const debugData: any = await debugRes.json().catch(() => ({}));
      if (!debugRes.ok || debugData.data?.is_valid === false || debugData.data?.app_id !== appId) {
        return { ok: false, error: 'Facebook token not valid for this app' };
      }
    }

    // 2. Pull profile fields
    const meUrl = `https://graph.facebook.com/me?fields=id,name,email,picture.width(200).height(200)&access_token=${encodeURIComponent(accessToken)}`;
    const meRes = await fetch(meUrl);
    const me: any = await meRes.json().catch(() => ({}));
    if (!meRes.ok || !me.id) {
      return { ok: false, error: me.error?.message || `Facebook /me returned ${meRes.status}` };
    }
    return {
      ok: true,
      provider: 'facebook',
      providerId: me.id as string,
      email: (me.email as string | undefined)?.toLowerCase(),
      emailVerified: !!me.email,    // Facebook emails are typically verified
      name: me.name as string | undefined,
      picture: me.picture?.data?.url as string | undefined,
    };
  } catch (e: any) {
    return { ok: false, error: `Facebook verify failed: ${e.message}` };
  }
}

/** Are any social providers configured? */
export function socialAuthAvailable(): { google: boolean; apple: boolean; facebook: boolean } {
  return {
    google: !!process.env.GOOGLE_CLIENT_ID,
    apple: !!process.env.APPLE_CLIENT_ID,
    facebook: !!process.env.FACEBOOK_APP_ID,
  };
}
