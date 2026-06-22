// Recurring expense runner — called by cron, idempotent.
// Picks up RecurringExpense rows where active=true AND nextRunDate <= now,
// creates a Bill from each, then advances nextRunDate to the next cycle.

import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';

export type RecurringRunResult = {
  templatesChecked: number;
  billsCreated: number;
  errors: Array<{ templateId: string; error: string }>;
  created: Array<{ templateId: string; billId: string; amount: number; dueOn: Date }>;
};

/** Compute the next run date given a frequency and a reference date. */
export function computeNextRunDate(
  freq: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY',
  from: Date,
  dayOfMonth?: number | null,
): Date {
  const next = new Date(from);
  if (freq === 'WEEKLY') {
    next.setDate(next.getDate() + 7);
    return next;
  }
  if (freq === 'MONTHLY') {
    next.setMonth(next.getMonth() + 1);
  } else if (freq === 'QUARTERLY') {
    next.setMonth(next.getMonth() + 3);
  } else if (freq === 'YEARLY') {
    next.setFullYear(next.getFullYear() + 1);
  }
  if (dayOfMonth && dayOfMonth >= 1 && dayOfMonth <= 28) {
    next.setDate(dayOfMonth);
  }
  return next;
}

/** Run pending recurring expenses, creating bills. */
export async function runRecurringExpenses(): Promise<RecurringRunResult> {
  const result: RecurringRunResult = {
    templatesChecked: 0,
    billsCreated: 0,
    errors: [],
    created: [],
  };

  const due = await prisma.recurringExpense.findMany({
    where: { active: true, nextRunDate: { lte: new Date() } },
  });
  result.templatesChecked = due.length;

  for (const tpl of due) {
    try {
      const now = new Date();
      const dueOn = new Date(now.getTime() + (tpl.dueOffsetDays || 15) * 86_400_000);

      const bill = await prisma.bill.create({
        data: {
          id: 'bill_' + randomBytes(10).toString('hex'),
          billNumber: null,
          description: tpl.name + ' — ' + now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
          vendorId: tpl.vendorId,
          vendorNameSnapshot: tpl.vendorNameSnapshot,
          categoryId: tpl.categoryId,
          amountPaise: tpl.amountPaise,
          gstPaise: tpl.gstPaise,
          totalPaise: tpl.totalPaise,
          paidPaise: 0,
          issuedOn: now,
          dueOn,
          status: 'OPEN',
          notes: 'Auto-created from recurring template "' + tpl.name + '"',
          createdByUserId: 'system',
        },
      });

      // Advance the template
      const nextRun = computeNextRunDate(tpl.frequency as any, now, tpl.dayOfMonth);
      await prisma.recurringExpense.update({
        where: { id: tpl.id },
        data: { lastRunDate: now, nextRunDate: nextRun },
      });

      result.billsCreated += 1;
      result.created.push({ templateId: tpl.id, billId: bill.id, amount: tpl.totalPaise, dueOn });
    } catch (err: any) {
      result.errors.push({ templateId: tpl.id, error: err?.message || String(err) });
    }
  }

  return result;
}
