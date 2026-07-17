import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { prismaErrorToHttp } from '@/lib/prisma-errors';
import { canAdminEditAgreement, canAdminReadAgreement } from '@/lib/agreement-workflow';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_STATUSES = new Set(['OPEN', 'RESOLVED', 'REJECTED', 'WITHDRAWN']);

export async function GET(
  _request: Request,
  { params }: { params: { agreementId: string; observationId: string } },
) {
  const session = await getSession();
  if (!canAdminReadAgreement(session?.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const observation = await prisma.sellerAgreementObservation.findFirst({
      where: {
        id: params.observationId,
        agreementId: params.agreementId,
      },
    });

    if (!observation) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ observation });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message, code: m.code }, { status: m.status });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { agreementId: string; observationId: string } },
) {
  const session = await getSession();
  if (!canAdminEditAgreement(session?.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => null);
    const status = String(body?.status || '').trim().toUpperCase();
    const adminResponse = String(body?.adminResponse || '').trim();

    const data: Record<string, any> = {
      adminResponse: adminResponse || null,
    };

    if (status) {
      if (!ALLOWED_STATUSES.has(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      data.status = status as any;
    }

    const observation = await prisma.sellerAgreementObservation.update({
      where: { id: params.observationId },
      data,
    });

    return NextResponse.json({ observation });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message, code: m.code }, { status: m.status });
  }
}