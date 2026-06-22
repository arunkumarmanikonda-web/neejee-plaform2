// v23.39 — Bank statement CSV import
// POST /api/admin/finance/bank-accounts/{id}/import-csv
// Body: { csvText: string, sourceFileUrl?: string }
// Imports the CSV into BankTransaction rows. Dedups via rowHash.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireFinancePerm } from '@/lib/finance/roles';
import { parseBankCsv } from '@/lib/finance/bank-parsers';
import { autoMatchAll } from '@/lib/finance/bank-matcher';
import { recordAudit } from '@/lib/finance/audit-log';
import { randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.write');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const account = await prisma.bankAccount.findUnique({ where: { id: params.id } });
  if (!account) return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });

  try {
    const { csvText, sourceFileUrl } = await req.json();
    if (!csvText || typeof csvText !== 'string') {
      return NextResponse.json({ error: 'csvText required' }, { status: 400 });
    }

    const { format, rows } = parseBankCsv(csvText);
    if (rows.length === 0) {
      return NextResponse.json({ error: 'CSV parsed but no valid transactions found' }, { status: 400 });
    }

    // Insert with dedup via rowHash
    let inserted = 0, skipped = 0;
    for (const r of rows) {
      // Check existing
      const exists = await prisma.bankTransaction.findFirst({
        where: { bankAccountId: account.id, sourceRowHash: r.rowHash },
        select: { id: true },
      });
      if (exists) { skipped++; continue; }
      await prisma.bankTransaction.create({
        data: {
          id: 'btxn_' + randomBytes(10).toString('hex'),
          bankAccountId: account.id,
          txnDate: r.txnDate,
          description: r.description,
          reference: r.reference,
          debitPaise: r.debitPaise,
          creditPaise: r.creditPaise,
          balancePaise: r.balancePaise,
          source: 'CSV_' + format,
          sourceFileUrl: sourceFileUrl || null,
          sourceRowHash: r.rowHash,
          status: 'UNMATCHED',
        },
      });
      inserted++;
    }

    await prisma.bankAccount.update({
      where: { id: account.id },
      data: { lastSyncedAt: new Date(), lastSyncedSource: 'CSV_' + format },
    });

    // Auto-match (high confidence only by default)
    const matchResult = await autoMatchAll(account.id);

    await recordAudit({
      action: 'UPDATE',
      entityType: 'BankAccount',
      entityId: account.id,
      before: { lastSyncedAt: account.lastSyncedAt },
      after: { lastSyncedAt: new Date(), inserted, skipped, ...matchResult },
      session,
      req,
    });

    return NextResponse.json({
      ok: true,
      format,
      parsedRows: rows.length,
      inserted,
      skipped,
      matched: matchResult,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Import failed' }, { status: 500 });
  }
}
