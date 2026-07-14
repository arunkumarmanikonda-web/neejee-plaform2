import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isKycMockMode, normalizeText, normalizeUpper } from '@/lib/seller-onboarding/kyc-provider';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BodySchema = z.object({
  gstin: z.string().min(15),
  businessName: z.string().optional().nullable(),
});

export async function POST(request: Request) {
  try {
    const body = BodySchema.parse(await request.json());
    const gstin = normalizeUpper(body.gstin);
    const businessName = normalizeText(body.businessName);

    if (isKycMockMode()) {
      return NextResponse.json({
        valid: true,
        active: true,
        gstin,
        gstNumber: gstin,
        legalName: businessName || 'MOCK LEGAL NAME',
        tradeName: businessName || 'MOCK TRADE NAME',
        pan: gstin.slice(2, 12),
        source: 'mock',
      });
    }

    return NextResponse.json(
      {
        error: 'GST verification provider not configured',
        provider: 'unconfigured',
      },
      { status: 503 },
    );
  } catch (e: any) {
    if (e?.issues) {
      return NextResponse.json(
        { error: 'Invalid GST verification payload', issues: e.issues },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: e?.message || 'GST verification failed' },
      { status: 500 },
    );
  }
}