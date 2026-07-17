import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireSellerContext } from '@/lib/seller-auth-helpers';
import { prismaErrorToHttp } from '@/lib/prisma-errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function hashCode(code: string) {
  return createHash('sha256').update(code).digest('hex');
}

export async function POST(
  request: Request,
  { params }: { params: { agreementId: string } },
) {
  const session = await getSession();
  const gate = await requireSellerContext(session);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  try {
    const agreement = await prisma.sellerAgreement.findFirst({
      where: {
        id: params.agreementId,
        sellerId: gate.ctx.seller.id,
      },
    });

    if (!agreement) {
      return NextResponse.json({ error: 'Agreement not found' }, { status: 404 });
    }

    if (!agreement.sellerOtpHash || !agreement.sellerOtpExpiresAt) {
      return NextResponse.json(
        { error: 'No active OTP for this agreement' },
        { status: 400 },
      );
    }

    if (new Date(agreement.sellerOtpExpiresAt).getTime() < Date.now()) {
      return NextResponse.json(
        { error: 'OTP expired. Please request a new code.' },
        { status: 401 },
      );
    }

    const body = await request.json().catch(() => null);
    const code = String(body?.code || '').trim();

    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'Invalid OTP format' }, { status: 400 });
    }

    if (hashCode(code) !== String(agreement.sellerOtpHash)) {
      return NextResponse.json({ error: 'Incorrect OTP' }, { status: 401 });
    }

    const updated = await prisma.sellerAgreement.update({
      where: { id: agreement.id },
      data: {
        sellerSignedAt: new Date(),
        sellerExecutionMode: 'OTP',
        sellerExecutionRef: `otp:${Date.now()}`,
        sellerOtpHash: null,
        sellerOtpExpiresAt: null,
        status: 'SELLER_SIGNED' as any,
      },
    });

    return NextResponse.json({
      ok: true,
      agreement: updated,
      message: 'Seller signature captured successfully',
    });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message, code: m.code }, { status: m.status });
  }
}