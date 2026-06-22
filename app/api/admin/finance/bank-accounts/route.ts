// v23.39 — Bank accounts CRUD
// GET  /api/admin/finance/bank-accounts          — list all (with txn counts)
// POST /api/admin/finance/bank-accounts          — create a new bank account

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireFinancePerm } from '@/lib/finance/roles';
import { recordAudit } from '@/lib/finance/audit-log';
import { randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.read');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const accounts = await prisma.bankAccount.findMany({
    orderBy: [{ active: 'desc' }, { bankName: 'asc' }, { nickname: 'asc' }],
  });

  // Add txn counts in a single grouped query
  const counts = await prisma.bankTransaction.groupBy({
    by: ['bankAccountId', 'status'],
    _count: { _all: true },
  });

  const enriched = accounts.map(a => {
    const stats = { unmatched: 0, autoMatched: 0, manualMatched: 0, ignored: 0, draft: 0 };
    for (const c of counts) {
      if (c.bankAccountId !== a.id) continue;
      if (c.status === 'UNMATCHED')        stats.unmatched = c._count._all;
      else if (c.status === 'AUTO_MATCHED')   stats.autoMatched = c._count._all;
      else if (c.status === 'MANUAL_MATCHED') stats.manualMatched = c._count._all;
      else if (c.status === 'IGNORED')         stats.ignored = c._count._all;
      else if (c.status === 'DRAFT')           stats.draft = c._count._all;
    }
    return { ...a, stats };
  });

  return NextResponse.json({ accounts: enriched });
}

export async function POST(req: Request) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.admin');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    const body = await req.json();
    const { nickname, bankName, accountNumber, ifsc, accountType, openingBalanceRupees, openingBalanceDate, rzpxAccountId } = body;

    if (!nickname || !bankName) {
      return NextResponse.json({ error: 'nickname and bankName are required' }, { status: 400 });
    }
    const opening = openingBalanceRupees ? Math.round(parseFloat(openingBalanceRupees) * 100) : 0;

    const created = await prisma.bankAccount.create({
      data: {
        id: 'bank_' + randomBytes(10).toString('hex'),
        nickname: String(nickname).trim(),
        bankName: String(bankName).toUpperCase(),
        accountNumber: accountNumber || null,
        ifsc: ifsc || null,
        accountType: accountType || null,
        openingBalancePaise: opening,
        openingBalanceDate: openingBalanceDate ? new Date(openingBalanceDate) : null,
        rzpxAccountId: rzpxAccountId || null,
        createdByUserId: session!.id,
      },
    });

    await recordAudit({
      action: 'CREATE',
      entityType: 'BankAccount',
      entityId: created.id,
      after: created,
      session,
      req,
    });

    return NextResponse.json({ account: created }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to create' }, { status: 500 });
  }
}
