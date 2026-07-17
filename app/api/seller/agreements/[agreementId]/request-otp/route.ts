import { createHash, randomInt } from 'node:crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireSellerContext } from '@/lib/seller-auth-helpers';
import { prismaErrorToHttp } from '@/lib/prisma-errors';
import { normalizePhone, sendOtpSms } from '@/lib/otp';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function hashCode(code: string) {
  return createHash('sha256').update(code).digest('hex');
}

export async function POST(
  _request: Request,
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

    if (!['LOCKED', 'SENT_FOR_SIGNATURE'].includes(String(agreement.status))) {
      return NextResponse.json(
        { error: 'Agreement is not ready for seller signing' },
        { status: 409 },
      );
    }

    const seller = await prisma.seller.findUnique({
      where: { id: gate.ctx.seller.id },
      select: {
        id: true,
        phone: true,
        contactName: true,
        businessName: true,
      },
    });

    const phone = normalizePhone(seller?.phone || null);
    if (!phone) {
      return NextResponse.json(
        { error: 'Seller phone is missing or invalid' },
        { status: 400 },
      );
    }

    const code = String(randomInt(100000, 1000000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.sellerAgreement.update({
      where: { id: agreement.id },
      data: {
        sellerOtpHash: hashCode(code),
        sellerOtpExpiresAt: expiresAt,
        sellerExecutionMode: 'OTP',
      },
    });

    await sendOtpSms({
      phone,
      code,
      purpose: 'login' as any,
      recipientName:
        String(seller?.contactName || seller?.businessName || '').trim() || undefined,
    });

    return NextResponse.json({
      ok: true,
      phone,
      expiresAt,
      message: 'OTP sent successfully',
    });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message, code: m.code }, { status: m.status });
  }
}