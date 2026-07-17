import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireSellerContext } from '@/lib/seller-auth-helpers';
import { prismaErrorToHttp } from '@/lib/prisma-errors';
import { getParagraphTextFromDocument } from '@/lib/agreement-workflow';

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

    return NextResponse.json({ observations });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message, code: m.code }, { status: m.status });
  }
}

export async function POST(
  request: Request,
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

    if (['LOCKED', 'SENT_FOR_SIGNATURE', 'SELLER_SIGNED', 'COMPANY_SIGNED', 'CLOSED', 'VOID']
      .includes(String(agreement.status))) {
      return NextResponse.json(
        { error: 'Agreement is locked for seller comments' },
        { status: 409 },
      );
    }

    const body = await request.json().catch(() => null);
    const clauseId = String(body?.clauseId || '').trim();
    const paragraphKey = String(body?.paragraphKey || '').trim();
    const sellerComment = String(body?.sellerComment || '').trim();

    if (!clauseId || !paragraphKey || !sellerComment) {
      return NextResponse.json(
        { error: 'clauseId, paragraphKey and sellerComment are required' },
        { status: 400 },
      );
    }

    const paragraphText = getParagraphTextFromDocument(
      agreement.currentDocumentJson,
      clauseId,
      paragraphKey,
    );

    const observation = await prisma.sellerAgreementObservation.create({
      data: {
        agreementId: agreement.id,
        versionNo: Number(agreement.currentVersionNo || 1),
        clauseId,
        paragraphKey,
        paragraphText: paragraphText || null,
        sellerComment,
        sellerUserId: session?.id || null,
        status: 'OPEN' as any,
      },
    });

    return NextResponse.json({ observation }, { status: 201 });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message, code: m.code }, { status: m.status });
  }
}