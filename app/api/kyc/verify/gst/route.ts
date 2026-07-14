import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isKycMockMode, normalizeText, normalizeUpper } from '@/lib/seller-onboarding/kyc-provider';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BodySchema = z.object({
  gstin: z.string().min(15),
  businessName: z.string().optional().nullable(),
  pan: z.string().optional().nullable(),
});

const GSTIN_REGEX = /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/;
const PAN_REGEX = /^[A-Z]{5}\d{4}[A-Z]$/;
const VALID_STATE_CODES = new Set([
  '01','02','03','04','05','06','07','08','09','10','11','12','13','14','15','16','17','18','19','20',
  '21','22','23','24','25','26','27','28','29','30','31','32','33','34','35','36','37','38','97'
]);

function validateGstin(gstin: string) {
  if (!GSTIN_REGEX.test(gstin)) {
    return { ok: false, reason: 'GSTIN format is invalid' };
  }

  const stateCode = gstin.slice(0, 2);
  if (!VALID_STATE_CODES.has(stateCode)) {
    return { ok: false, reason: 'GSTIN state code is invalid' };
  }

  const embeddedPan = gstin.slice(2, 12);
  if (!PAN_REGEX.test(embeddedPan)) {
    return { ok: false, reason: 'GSTIN contains an invalid PAN segment' };
  }

  return {
    ok: true,
    stateCode,
    embeddedPan,
  };
}

export async function POST(request: Request) {
  try {
    const body = BodySchema.parse(await request.json());
    const gstin = normalizeUpper(body.gstin);
    const businessName = normalizeText(body.businessName);
    const manualPan = normalizeUpper(body.pan);

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

    const validation = validateGstin(gstin);
    if (!validation.ok) {
      return NextResponse.json(
        {
          valid: false,
          error: validation.reason,
          gstin,
          source: 'local_format',
        },
        { status: 400 },
      );
    }

    const panMatches = manualPan ? validation.embeddedPan === manualPan : null;

    return NextResponse.json({
      valid: true,
      active: null,
      gstin,
      gstNumber: gstin,
      legalName: businessName || null,
      tradeName: businessName || null,
      pan: validation.embeddedPan,
      panMatches,
      stateCode: validation.stateCode,
      source: 'local_format',
    });
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
