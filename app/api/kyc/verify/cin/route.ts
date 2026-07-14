import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isKycMockMode, normalizeText, normalizeUpper } from '@/lib/seller-onboarding/kyc-provider';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BodySchema = z.object({
  cin: z.string().min(6),
  businessName: z.string().optional().nullable(),
});

export async function POST(request: Request) {
  try {
    const body = BodySchema.parse(await request.json());
    const cin = normalizeUpper(body.cin);
    const businessName = normalizeText(body.businessName);

    if (isKycMockMode()) {
      return NextResponse.json({
        valid: true,
        cin,
        companyName: businessName || 'MOCK COMPANY NAME',
        source: 'mock',
      });
    }

    return NextResponse.json(
      {
        error: 'CIN verification provider not configured',
        provider: 'unconfigured',
      },
      { status: 503 },
    );
  } catch (e: any) {
    if (e?.issues) {
      return NextResponse.json(
        { error: 'Invalid CIN verification payload', issues: e.issues },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: e?.message || 'CIN verification failed' },
      { status: 500 },
    );
  }
}