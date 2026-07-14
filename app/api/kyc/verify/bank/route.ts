import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  accountLast4,
  isKycMockMode,
  normalizeText,
  normalizeUpper,
  verifyBankWithRazorpayX,
} from '@/lib/seller-onboarding/kyc-provider';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BodySchema = z.object({
  bankAccount: z.string().min(6),
  ifsc: z.string().min(5),
  businessName: z.string().optional().nullable(),
});

export async function POST(request: Request) {
  try {
    const body = BodySchema.parse(await request.json());
    const bankAccount = String(body.bankAccount || '').replace(/\s+/g, '');
    const ifsc = normalizeUpper(body.ifsc);
    const businessName = normalizeText(body.businessName);

    if (isKycMockMode()) {
      return NextResponse.json({
        valid: true,
        provider: 'mock',
        ifsc,
        accountLast4: accountLast4(bankAccount),
        registeredName: businessName || 'MOCK ACCOUNT HOLDER',
        bankName: 'MOCK BANK',
        nameMatchScore: 100,
      });
    }

    const provider = (process.env.BANK_KYC_PROVIDER || 'razorpayx').trim().toLowerCase();

    if (provider !== 'razorpayx') {
      return NextResponse.json(
        {
          error: 'Unsupported bank KYC provider',
          provider,
        },
        { status: 400 },
      );
    }

    const result = await verifyBankWithRazorpayX({
      bankAccount,
      ifsc,
      businessName,
    });

    if (!result.configured) {
      return NextResponse.json(
        {
          error: result.error,
          missing: result.missing || [],
        },
        { status: result.status },
      );
    }

    if (!result.ok || !result.data) {
      return NextResponse.json(
        {
          error: result.error || 'Bank verification failed',
          details: result.details || null,
        },
        { status: result.status || 502 },
      );
    }

    return NextResponse.json({
      valid: true,
      provider: result.data.provider,
      ifsc: result.data.ifsc,
      accountLast4: result.data.accountLast4,
      registeredName: result.data.registeredName,
      bankName: result.data.bankName,
      nameMatchScore: result.data.nameMatchScore,
      raw: result.data.raw,
    });
  } catch (e: any) {
    if (e?.issues) {
      return NextResponse.json(
        { error: 'Invalid bank verification payload', issues: e.issues },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: e?.message || 'Bank verification failed' },
      { status: 500 },
    );
  }
}