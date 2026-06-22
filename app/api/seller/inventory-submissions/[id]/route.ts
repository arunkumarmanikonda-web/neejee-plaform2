// PATCH/DELETE one inventory submission (seller can withdraw their own).
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireSellerContext } from '@/lib/seller-auth-helpers';
import { prismaErrorToHttp } from '@/lib/prisma-errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  const gate = await requireSellerContext(session);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    const row = await prisma.sellerInventorySubmission.findUnique({
      where: { id: params.id },
      include: { product: true },
    });
    if (!row || row.sellerId !== gate.ctx.seller.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ submission: row });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message }, { status: m.status });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  const gate = await requireSellerContext(session);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    const row = await prisma.sellerInventorySubmission.findUnique({ where: { id: params.id } });
    if (!row || row.sellerId !== gate.ctx.seller.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (row.status === 'PUBLISHED' || row.status === 'APPROVED') {
      return NextResponse.json({ error: `Cannot withdraw a ${row.status} submission` }, { status: 400 });
    }

    const updated = await prisma.sellerInventorySubmission.update({
      where: { id: params.id },
      data: { status: 'WITHDRAWN' },
    });
    return NextResponse.json({ submission: updated });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message }, { status: m.status });
  }
}
