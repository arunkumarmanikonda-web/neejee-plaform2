import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { prismaErrorToHttp } from '@/lib/prisma-errors';
import {
  canAdminEditAgreement,
  canAdminReadAgreement,
} from '@/lib/agreement-workflow';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function cleanString(v: unknown) {
  const s = String(v ?? '').trim();
  return s || null;
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!canAdminReadAgreement(session?.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const signatory = await prisma.legalSignatory.findUnique({
      where: { id: params.id },
    });

    if (!signatory) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ signatory });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message, code: m.code }, { status: m.status });
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!canAdminEditAgreement(session?.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => null);
    const payload: Record<string, any> = {};

    if ('name' in (body || {})) payload.name = cleanString(body?.name);
    if ('title' in (body || {})) payload.title = cleanString(body?.title);
    if ('email' in (body || {})) payload.email = cleanString(body?.email);
    if ('phone' in (body || {})) payload.phone = cleanString(body?.phone);
    if ('signatureUrl' in (body || {})) payload.signatureUrl = cleanString(body?.signatureUrl);
    if ('isActive' in (body || {})) payload.isActive = !!body?.isActive;
    if ('effectiveFrom' in (body || {})) {
      payload.effectiveFrom = cleanString(body?.effectiveFrom)
        ? new Date(String(body.effectiveFrom))
        : null;
    }
    if ('effectiveTo' in (body || {})) {
      payload.effectiveTo = cleanString(body?.effectiveTo)
        ? new Date(String(body.effectiveTo))
        : null;
    }

    const wantsDefault = !!body?.isDefault;

    const updated = await prisma.$transaction(async (tx) => {
      if (wantsDefault) {
        await tx.legalSignatory.updateMany({
          data: { isDefault: false },
        });
      }

      return tx.legalSignatory.update({
        where: { id: params.id },
        data: {
          ...payload,
          ...(body && 'isDefault' in body ? { isDefault: wantsDefault } : {}),
        },
      });
    });

    return NextResponse.json({ signatory: updated });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message, code: m.code }, { status: m.status });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!canAdminEditAgreement(session?.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const activeAgreementCount = await prisma.sellerAgreement.count({
      where: { companySignatoryId: params.id },
    });

    if (activeAgreementCount > 0) {
      return NextResponse.json(
        {
          error: 'This signatory is attached to existing agreements. Deactivate instead of deleting.',
        },
        { status: 409 },
      );
    }

    await prisma.legalSignatory.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message, code: m.code }, { status: m.status });
  }
}