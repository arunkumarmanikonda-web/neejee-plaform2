import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSellerAgreementUploadGate } from '@/lib/agreement-upload-guard';
import { prismaErrorToHttp } from '@/lib/prisma-errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function requireAdmin() {
  const session = await getSession();
  if (!session || !['ADMIN', 'SUPER_ADMIN'].includes(String(session.role || ''))) {
    return null;
  }
  return session;
}

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
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
        sellerUpload: gate.blocked ? 423 : 200,
      },
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
        debugType: e?.constructor?.name || typeof e,
      },
      { status: mapped?.status || 500 }
    );
  }
}