// POST /api/auth/social  { provider: 'google'|'apple'|'facebook', token }
// Verifies the provider token, upserts the user, sets session.
//
// Unified endpoint for all three social providers \u2014 keeps the client API simple.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { setSessionCookie } from '@/lib/auth';
import {
  verifyGoogleIdToken,
  verifyAppleIdToken,
  verifyFacebookAccessToken,
} from '@/lib/oauth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function redirectFor(role: string): string {
  if (['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR', 'QC_TEAM'].includes(role)) return '/admin';
  if (role === 'SELLER') return '/seller';
  return '/account';
}

export async function POST(request: Request) {
  let body: any = {};
  try { body = await request.json(); } catch {}
  const provider = (body.provider || '').toString().toLowerCase();
  const token = (body.token || '').toString();
  const fallbackName = (body.name || '').toString().trim() || null;
  const fallbackEmail = (body.email || '').toString().trim().toLowerCase() || null;

  if (!['google', 'apple', 'facebook'].includes(provider)) {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 400 });
  }
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  // 1. Verify with the provider
  const verified =
    provider === 'google'  ? await verifyGoogleIdToken(token) :
    provider === 'apple'   ? await verifyAppleIdToken(token) :
                             await verifyFacebookAccessToken(token);

  if (!verified.ok) {
    console.warn(`[social/${provider}] verification failed: ${verified.error}`);
    return NextResponse.json({ error: 'Sign-in failed. Please try again.' }, { status: 401 });
  }

  // 2. Identify the user — by email when we have one (preferred), else by a
  //    deterministic placeholder linked to the provider id.
  const email = verified.email || fallbackEmail;
  const name = verified.name || fallbackName;
  const picture = verified.picture || undefined;

  if (!email && !verified.providerId) {
    return NextResponse.json({ error: 'Sign-in did not return an email.' }, { status: 400 });
  }

  // Apple/Facebook sometimes withhold email on later logins; use a synthetic
  // unique placeholder so we can still attach a session to the same user.
  const lookupEmail = email || `${verified.providerId}@${provider}.neejee.com`;

  let user = await prisma.user.findUnique({ where: { email: lookupEmail } });
  let isNewUser = false;

  if (!user) {
    isNewUser = true;
    user = await prisma.user.create({
      data: {
        email: lookupEmail,
        name: name || null,
        image: picture || null,
        emailVerified: verified.emailVerified ? new Date() : null,
        passwordHash: null,           // social accounts have no password
        emailOptIn: true,
        marketingConsent: false,
      },
    });
  } else {
    // Backfill missing profile info
    const patch: any = {};
    if (!user.name && name) patch.name = name;
    if (!user.image && picture) patch.image = picture;
    if (!user.emailVerified && verified.emailVerified) patch.emailVerified = new Date();
    if (Object.keys(patch).length > 0) {
      user = await prisma.user.update({ where: { id: user.id }, data: patch });
    }
  }

  await setSessionCookie({
    id: user.id,
    email: user.email,
    name: user.name || undefined,
    role: user.role as any,
  });

  return NextResponse.json({
    ok: true,
    isNewUser,
    provider,
    redirect: redirectFor(user.role),
    user: { id: user.id, email: user.email, name: user.name },
  });
}
