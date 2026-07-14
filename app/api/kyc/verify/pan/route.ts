import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isKycMockMode, normalizeText, normalizeUpper } from '@/lib/seller-onboarding/kyc-provider';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BodySchema = z.object({
  pan: z.string().min(10),
  businessName: z.string().optional().nullable(),
});

const PAN_REGEX = /^[A-Z]{5}\d{4}[A-Z]$/;

export async function POST(request: Request) {
  try {
    const body = BodySchema.parse(await request.json());
    const pan = normalizeUpper(body.pan);
    const businessName = normalizeText(body.businessName);

    if (isKycMockMode()) {
      return NextResponse.json({
        valid: true,
        pan,
        name: businessName || 'MOCK LEGAL NAME',
        source: 'mock',
      });
    }

    if (!PAN_REGEX.test(pan)) {
      return NextResponse.json(
        {
          valid: false,
          error: 'PAN format is invalid',
          pan,
          source: 'local_format',
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      valid: true,
      pan,
      name: businessName || null,
      source: 'local_format',
    });
  } catch (e: any) {
    if (e?.issues) {
      return NextResponse.json(
        { error: 'Invalid PAN verification payload', issues: e.issues },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: e?.message || 'PAN verification failed' },
      { status: 500 },
    );
  }
}
