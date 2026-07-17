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

export async function GET() {
  const session = await getSession();
  if (!canAdminReadAgreement(session?.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const signatories = await prisma.legalSignatory.findMany({
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json({ signatories });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message, code: m.code }, { status: m.status });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!canAdminEditAgreement(session?.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => null);
    const name = cleanString(body?.name);
    const title = cleanString(body?.title);
    const email = cleanString(body?.email);
    const phone = cleanString(body?.phone);
    const signatureUrl = cleanString(body?.signatureUrl);
    const isDefault = !!body?.isDefault;
    const isActive = body?.isActive === false ? false : true;
    const effectiveFrom = cleanString(body?.effectiveFrom);
    const effectiveTo = cleanString(body?.effectiveTo);

    if (!name || !title) {
      return NextResponse.json(
        { error: 'name and title are required' },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.legalSignatory.updateMany({
          data: { isDefault: false },
        });
      }

      return tx.legalSignatory.create({
        data: {
          name,
          title,
          email,
          phone,
          signatureUrl,
          isDefault,
          isActive,
          effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : null,
          effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
          createdByUserId: session?.id || null,
        },
      });
    });

    return NextResponse.json({ signatory: result }, { status: 201 });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message, code: m.code }, { status: m.status });
  }
}