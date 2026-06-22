// v23.37 — After OTP verification, sign in by phone for any role.
// This endpoint is called by OtpLogin component after a successful /verify.
// Caller passes { phone, role } and we look up the user by phone, scope-check
// against the role, and set the session cookie.
//
// IMPORTANT: This endpoint assumes the caller has already verified the OTP.
// /verify consumed the OTP code; without a recent verified OTP, this endpoint
// will still issue a session — so it MUST only be called immediately after
// a green /verify response. This is enforced by the OtpLogin component which
// holds the verified phone in component state.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { setSessionCookie } from '@/lib/auth';
import { normalizePhone } from '@/lib/phone';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ROLE_MAP: Record<string, string[]> = {
  customer: ['CUSTOMER'],
  seller:   ['SELLER', 'SELLER_STAFF'],
  vendor:   ['VENDOR', 'VENDOR_STAFF'],
  admin:    ['ADMIN', 'SUPER_ADMIN'],
};

export async function POST(req: NextRequest) {
  try {
    const { phone, role, purpose } = await req.json();
    if (!phone) return NextResponse.json({ error: 'phone required' }, { status: 400 });

    const portal = String(role || 'customer').toLowerCase();
    const allowedRoles = ROLE_MAP[portal];
    if (!allowedRoles) return NextResponse.json({ error: 'Invalid role' }, { status: 400 });

    // Verify there is a recent consumed OTP for this phone+purpose
    // (within the last 2 minutes — short window for security)
    const normalized = normalizePhone(phone) || phone;
    const recent = await prisma.otpCode.findFirst({
      where: {
        phone: normalized,
        purpose: purpose || `login_${portal}`,
        consumedAt: { gte: new Date(Date.now() - 2 * 60 * 1000), not: null },
      },
      orderBy: { consumedAt: 'desc' },
    });
    if (!recent) {
      return NextResponse.json({ error: 'OTP verification required first' }, { status: 401 });
    }

    // Find user by phone with matching role
    const user = await prisma.user.findFirst({
      where: { phone: normalized, role: { in: allowedRoles as any } },
    });
    if (!user) {
      return NextResponse.json({
        error: `No ${portal} account found for this number. Please contact support.`,
      }, { status: 404 });
    }

    // Scope checks per portal
    if (portal === 'vendor') {
      const vendor = await prisma.vendor.findUnique({ where: { userId: user.id } });
      if (!vendor || vendor.status === 'ARCHIVED' || vendor.status === 'SUSPENDED') {
        return NextResponse.json({ error: 'Vendor account is not active' }, { status: 403 });
      }
    }
    if (portal === 'seller') {
      const seller = await prisma.seller.findFirst({ where: { userId: user.id } });
      if (!seller) {
        return NextResponse.json({ error: 'Seller account not linked' }, { status: 403 });
      }
    }

    await setSessionCookie({
      id: user.id,
      email: user.email,
      name: user.name || undefined,
      role: user.role as any,
    });

    // Choose redirect
    const redirectMap: Record<string, string> = {
      customer: '/account',
      seller:   '/seller/dashboard',
      vendor:   '/vendor/dashboard',
      admin:    '/admin',
    };
    return NextResponse.json({ ok: true, redirect: redirectMap[portal] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Sign-in failed' }, { status: 500 });
  }
}
