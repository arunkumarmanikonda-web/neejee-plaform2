import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { prismaErrorToHttp } from '@/lib/prisma-errors';
import {
  canAdminEditAgreement,
  canAdminReadAgreement,
  ensureSellerAgreementSeeded,
  normalizeAgreementDocument,
} from '@/lib/agreement-workflow';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_STATUSES = new Set([
  'DRAFT',
  'INTERNAL_REVIEW',
  'SELLER_REVIEW',
  'READY_TO_LOCK',
  'LOCKED',
  'SENT_FOR_SIGNATURE',
  'SELLER_SIGNED',
  'COMPANY_SIGNED',
  'CLOSED',
  'VOID',
]);

async function getBundle(sellerId: string) {
  const agreement = await prisma.sellerAgreement.findFirst({
    where: { sellerId },
    orderBy: { createdAt: 'desc' },
  });

  const signatories = await prisma.legalSignatory.findMany({
    where: { isActive: true },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });

  const observations = agreement
    ? await prisma.sellerAgreementObservation.findMany({
        where: { agreementId: agreement.id },
        orderBy: [{ createdAt: 'desc' }],
      })
    : [];

  return { agreement, signatories, observations };
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!canAdminReadAgreement(session?.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await ensureSellerAgreementSeeded({ sellerId: params.id, request });
    const bundle = await getBundle(params.id);
    return NextResponse.json(bundle);
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json(
      { error: m.message || String(err?.message || err), code: m.code },
      { status: m.status || 500 },
    );
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!canAdminEditAgreement(session?.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => null);
    const action = String(body?.action || '').trim();

    let agreement = await ensureSellerAgreementSeeded({ sellerId: params.id, request });

    if (action === 'seed') {
      const bundle = await getBundle(params.id);
      return NextResponse.json(bundle);
    }

    if (action === 'save-draft') {
      if (['LOCKED', 'COMPANY_SIGNED', 'CLOSED', 'VOID'].includes(String(agreement.status))) {
        return NextResponse.json(
          { error: 'Agreement is not editable in its current status' },
          { status: 409 },
        );
      }

      const documentJson = normalizeAgreementDocument(body?.document || agreement.currentDocumentJson);
      const nextVersionNo = Number(agreement.currentVersionNo || 0) + 1;
      const changeSummary =
        String(body?.changeSummary || '').trim() || 'Agreement updated by admin';

      agreement = await prisma.sellerAgreement.update({
        where: { id: agreement.id },
        data: {
          currentVersionNo: nextVersionNo,
          currentDocumentJson: documentJson as any,
          status: String(body?.status || agreement.status) as any,
        },
      });

      await prisma.sellerAgreementVersion.create({
        data: {
          agreementId: agreement.id,
          versionNo: nextVersionNo,
          documentJson: documentJson as any,
          changeSummary,
          createdByUserId: session?.id || null,
        },
      });

      const bundle = await getBundle(params.id);
      return NextResponse.json(bundle);
    }

    if (action === 'set-status') {
      const status = String(body?.status || '').trim().toUpperCase();
      if (!ALLOWED_STATUSES.has(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }

      agreement = await prisma.sellerAgreement.update({
        where: { id: agreement.id },
        data: { status: status as any },
      });

      const bundle = await getBundle(params.id);
      return NextResponse.json(bundle);
    }

    if (action === 'lock') {
      agreement = await prisma.sellerAgreement.update({
        where: { id: agreement.id },
        data: {
          status: 'LOCKED' as any,
          lockedAt: new Date(),
          lockedByUserId: session?.id || null,
        },
      });

      const bundle = await getBundle(params.id);
      return NextResponse.json(bundle);
    }

    if (action === 'reopen') {
      agreement = await prisma.sellerAgreement.update({
        where: { id: agreement.id },
        data: {
          status: 'SELLER_REVIEW' as any,
          reopenedAt: new Date(),
          reopenedByUserId: session?.id || null,
          lockedAt: null,
          lockedByUserId: null,
        },
      });

      const bundle = await getBundle(params.id);
      return NextResponse.json(bundle);
    }

    if (action === 'set-signatory') {
      const signatoryId = String(body?.signatoryId || '').trim() || null;

      if (signatoryId) {
        const signatory = await prisma.legalSignatory.findUnique({
          where: { id: signatoryId },
        });

        if (!signatory) {
          return NextResponse.json({ error: 'Signatory not found' }, { status: 404 });
        }
      }

      agreement = await prisma.sellerAgreement.update({
        where: { id: agreement.id },
        data: {
          companySignatoryId: signatoryId,
        },
      });

      const bundle = await getBundle(params.id);
      return NextResponse.json(bundle);
    }

    if (action === 'send-for-signature') {
      agreement = await prisma.sellerAgreement.update({
        where: { id: agreement.id },
        data: {
          status: 'SENT_FOR_SIGNATURE' as any,
        },
      });

      const bundle = await getBundle(params.id);
      return NextResponse.json(bundle);
    }

    if (action === 'company-sign') {
      const signatoryId = String(body?.signatoryId || agreement.companySignatoryId || '').trim() || null;

      if (!signatoryId) {
        return NextResponse.json(
          { error: 'Select a company signatory before company-sign action' },
          { status: 400 },
        );
      }

      agreement = await prisma.sellerAgreement.update({
        where: { id: agreement.id },
        data: {
          companySignatoryId: signatoryId,
          companySignedAt: new Date(),
          status: 'COMPANY_SIGNED' as any,
        },
      });

      const bundle = await getBundle(params.id);
      return NextResponse.json(bundle);
    }

    if (action === 'close') {
      agreement = await prisma.sellerAgreement.update({
        where: { id: agreement.id },
        data: {
          status: 'CLOSED' as any,
        },
      });

      const bundle = await getBundle(params.id);
      return NextResponse.json(bundle);
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json(
      { error: m.message || String(err?.message || err), code: m.code },
      { status: m.status || 500 },
    );
  }
}