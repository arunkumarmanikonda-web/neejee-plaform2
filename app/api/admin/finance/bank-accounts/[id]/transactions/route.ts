// v23.39 — Bank account transactions listing
// GET /api/admin/finance/bank-accounts/{id}/transactions?status=&limit=

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireFinancePerm } from '@/lib/finance/roles';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.read');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const url = new URL(req.url);
  const status = url.searchParams.get('status') || undefined;
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '200'), 1000);

  const where: any = { bankAccountId: params.id };
  if (status) where.status = status as any;

  const txns = await prisma.bankTransaction.findMany({
    where,
    orderBy: { txnDate: 'desc' },
    take: limit,
  });

  return NextResponse.json({ transactions: txns });
}
