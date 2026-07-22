import { NextRequest, NextResponse } from 'next/server';
import { getSellerAgreementUploadGate } from '@/lib/agreement-upload-guard';
import { prismaErrorToHttp } from '@/lib/prisma-errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEBUG_KEY = 'neejee-gate-check-2026';

export async function GET(req: NextRequest) {
  const debugKey = String(req.nextUrl.searchParams.get('debugKey') || '').trim();
  if (debugKey !== DEBUG_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sellerId = String(req.nextUrl.searchParams.get('sellerId') || '').trim();
  if (!sellerId) {
    return NextResponse.json({ error: 'sellerId is required' }, { status: 400 });
  }

  try {
    const gate = await getSellerAgreementUploadGate(sellerId);

    return NextResponse.json({
      ok: true,
      sellerId,
      gate,
      simulatedStatuses: {
        productCreate: gate.blocked ? 423 : 200,
        inventorySubmission: gate.blocked ? 423 : 201,
        sellerUpload: gate.blocked ? 423 : 200
      }
    });
  } catch (e: any) {
    console.error('[debug agreement-gate GET]', e);
    const mapped = prismaErrorToHttp(e);

    return NextResponse.json(
      {
        ok: false,
        sellerId,
        error: mapped?.message || e?.message || 'Unknown error',
        code: mapped?.code || 'DEBUG_AGREEMENT_GATE_FAILED',
        debugType: e?.constructor?.name || typeof e
      },
      { status: mapped?.status || 500 }
    );
  }
}