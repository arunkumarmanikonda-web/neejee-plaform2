import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireSellerContext } from '@/lib/seller-auth-helpers';
import { prismaErrorToHttp } from '@/lib/prisma-errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
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

    const observations = await prisma.sellerAgreementObservation.findMany({
      where: { agreementId: agreement.id },
      orderBy: [{ createdAt: 'desc' }],
    });

    let signatory = null;
    if (agreement.companySignatoryId) {
      signatory = await prisma.legalSignatory.findUnique({
        where: { id: agreement.companySignatoryId },
      });
    }

    const canComment = !['LOCKED', 'SENT_FOR_SIGNATURE', 'SELLER_SIGNED', 'COMPANY_SIGNED', 'CLOSED', 'VOID']
      .includes(String(agreement.status));

    const canSign = ['LOCKED', 'SENT_FOR_SIGNATURE'].includes(String(agreement.status));

    return NextResponse.json({
      agreement,
      signatory,
      observations,
      permissions: {
        canComment,
        canSign,
        canLock: false,
        canFinalize: false,
      },
    });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message, code: m.code }, { status: m.status });
  }
}