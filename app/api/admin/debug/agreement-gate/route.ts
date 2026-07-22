import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSellerAgreementUploadGate } from '@/lib/agreement-upload-guard';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !['ADMIN', 'SUPER_ADMIN'].includes(String(session.role || ''))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sellerId = String(req.nextUrl.searchParams.get('sellerId') || '').trim();
  if (!sellerId) {
    return NextResponse.json({ error: 'sellerId is required' }, { status: 400 });
  }

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
}