import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { normalizePhone, verifyOtp } from '@/lib/otp';
import { requestSellerEmailOtp } from '@/lib/seller-onboarding/email-otp';
import { evaluateSellerAutoKyc } from '@/lib/seller-onboarding/validation';
import { syncSellerKycStatus } from '@/lib/seller-onboarding/status';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BodySchema = z.object({
  businessName: z.string().min(2),
  contactName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(8),
  phoneOtpCode: z.string().regex(/^\d{6}$/),
  craft: z.string().optional().nullable(),
  region: z.string().optional().nullable(),
  cluster: z.string().optional().nullable(),
  story: z.string().optional().nullable(),
  yearsOfPractice: z.coerce.number().int().min(0).max(80).optional().nullable(),
  logoImage: z.string().optional().nullable(),
  coverImage: z.string().optional().nullable(),
  portfolio: z.array(z.string()).optional().default([]),
  pan: z.string().min(10),
  gstin: z.string().optional().nullable(),
  cin: z.string().optional().nullable(),
  bankAccount: z.string().min(9),
  ifsc: z.string().min(11),
  bankName: z.string().min(2),
});

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = BodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid seller application payload', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const input = parsed.data;
    const email = input.email.trim().toLowerCase();
    const phone = normalizePhone(input.phone);

    if (!phone) {
      return NextResponse.json({ error: 'Invalid mobile number' }, { status: 400 });
    }

    const otpResult = await verifyOtp({
      phone,
      purpose: 'signup',
      code: input.phoneOtpCode,
    });

    if (!otpResult.ok) {
      return NextResponse.json(
        { error: 'Phone OTP verification failed', reason: otpResult.reason },
        { status: 400 }
      );
    }

    const autoValidation = evaluateSellerAutoKyc({
      pan: input.pan,
      gstin: input.gstin || null,
      cin: input.cin || null,
      ifsc: input.ifsc,
      bankAccount: input.bankAccount,
    });

    let user = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { phone }],
      },
      select: {
        id: true,
        email: true,
        phone: true,
        role: true,
      },
    });

    if (user && !['SELLER', 'SELLER_STAFF'].includes(String(user.role))) {
      return NextResponse.json(
        { error: 'Email or phone already belongs to a non-seller account' },
        { status: 409 }
      );
    }

    const now = new Date();

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          phone,
          name: input.contactName,
          role: 'SELLER',
          primaryAuthMethod: 'seller_application',
          phoneVerified: true,
          phoneVerifiedAt: now,
        },
        select: {
          id: true,
          email: true,
          phone: true,
          role: true,
        },
      });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          email,
          phone,
          name: input.contactName,
          role: 'SELLER',
          primaryAuthMethod: 'seller_application',
          phoneVerified: true,
          phoneVerifiedAt: now,
        },
        select: {
          id: true,
          email: true,
          phone: true,
          role: true,
        },
      });
    }

    let seller = await prisma.seller.findFirst({
      where: {
        OR: [{ userId: user.id }, { email }, { phone }],
      },
      select: { id: true },
    });

    const sellerData = {
      userId: user.id,
      businessName: input.businessName.trim(),
      contactName: input.contactName.trim(),
      email,
      phone,
      story: input.story || null,
      yearsOfPractice: input.yearsOfPractice ?? null,
      logoImage: input.logoImage || null,
      coverImage: input.coverImage || null,
      portfolio: Array.isArray(input.portfolio) ? input.portfolio.filter(Boolean) : [],
      pan: input.pan.trim().toUpperCase(),
      gstin: input.gstin ? input.gstin.trim().toUpperCase() : null,
      cin: input.cin ? input.cin.trim().toUpperCase() : null,
      bankAccount: input.bankAccount.trim(),
      ifsc: input.ifsc.trim().toUpperCase(),
      bankName: input.bankName.trim(),
      region: input.region || null,
      craft: input.craft || null,
      cluster: input.cluster || null,
      applicationSubmittedAt: now,
      autoKycPassed: autoValidation.ok,
      autoKycSummary: autoValidation as any,
      kycStatus: 'PENDING' as const,
      rejectionNote: autoValidation.ok ? null : autoValidation.errors.join('; '),
    };

    if (!seller) {
      const created = await prisma.seller.create({
        data: sellerData,
        select: { id: true },
      });
      seller = created;
    } else {
      await prisma.seller.update({
        where: { id: seller.id },
        data: sellerData,
      });
    }

    await requestSellerEmailOtp({
      sellerId: seller.id,
      email,
      recipientName: input.contactName,
    });

    await syncSellerKycStatus(seller.id);

    const fresh = await prisma.seller.findUnique({
      where: { id: seller.id },
      select: {
        id: true,
        kycStatus: true,
        autoKycPassed: true,
      },
    });

    return NextResponse.json({
      ok: true,
      sellerId: seller.id,
      kycStatus: fresh?.kycStatus || 'PENDING',
      autoValidation,
      nextStep: 'verify_email_otp',
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to submit seller application' },
      { status: 500 }
    );
  }
}