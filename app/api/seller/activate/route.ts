import { NextResponse } from 'next/server';
import { z } from 'zod';
import { activateSellerPortal } from '@/lib/seller-onboarding/portal-activation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BodySchema = z.object({
  sellerId: z.string().min(1),
  token: z.string().min(32),
  password: z.string().min(10).max(128),
});

function activationError(reason: string) {
  switch (reason) {
    case 'seller_not_found':
      return 'Seller account was not found.';
    case 'seller_not_approved':
      return 'This seller account is not currently approved.';
    case 'activation_expired':
      return 'This activation link has expired. Please contact NEEJEE for a new activation email.';
    case 'activation_invalid':
      return 'This activation link is invalid.';
    case 'activation_not_found':
      return 'This activation link has already been used or replaced.';
    default:
      return 'Seller Studio activation failed.';
  }
}

export async function POST(request: Request) {
  try {
    const body = BodySchema.safeParse(await request.json().catch(() => null));
    if (!body.success) {
      return NextResponse.json(
        { error: 'A valid activation link and a password of at least 10 characters are required.' },
        { status: 400 },
      );
    }

    const result = await activateSellerPortal(body.data);
    if (!result.ok) {
      return NextResponse.json(
        { error: activationError(result.reason), reason: result.reason },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true, email: result.email });
  } catch (error: any) {
    return NextResponse.json(
      { error: String(error?.message || 'Seller Studio activation failed') },
      { status: 500 },
    );
  }
}
