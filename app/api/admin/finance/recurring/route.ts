// Recurring expense templates.
// GET  /api/admin/finance/recurring
// POST /api/admin/finance/recurring
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireFinancePerm } from '@/lib/finance/roles';
import { computeNextRunDate } from '@/lib/finance/recurring';
import { prismaErrorToHttp } from '@/lib/prisma-errors';
import { randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.read');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  try {
    const rows = await prisma.recurringExpense.findMany({
      orderBy: { nextRunDate: 'asc' },
    });
    // Hydrate category labels
    const catIds = Array.from(new Set(rows.map(r => r.categoryId)));
    const cats = await prisma.expenseCategory.findMany({
      where: { id: { in: catIds } },
      select: { id: true, code: true, label: true },
    });
    const catMap = new Map(cats.map(c => [c.id, c]));
    return NextResponse.json({
      templates: rows.map(r => ({ ...r, category: catMap.get(r.categoryId) || null })),
    });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message }, { status: m.status });
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.admin');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  try {
    const body = await req.json();
    const {
      name, categoryId, vendorId, vendorNameSnapshot,
      amountPaise, gstPaise = 0,
      frequency, dayOfMonth, dueOffsetDays = 15,
      firstRunDate,
    } = body;

    if (!name || !categoryId || amountPaise == null || !frequency || !firstRunDate) {
      return NextResponse.json({
        error: 'name, categoryId, amountPaise, frequency, firstRunDate required',
      }, { status: 400 });
    }
    const amt = parseInt(amountPaise);
    const gst = parseInt(gstPaise) || 0;

    const row = await prisma.recurringExpense.create({
      data: {
        id: 'rec_' + randomBytes(10).toString('hex'),
        name: String(name).trim(),
        categoryId,
        vendorId: vendorId || null,
        vendorNameSnapshot: vendorNameSnapshot || null,
        amountPaise: amt,
        gstPaise: gst,
        totalPaise: amt + gst,
        frequency: frequency as any,
        dayOfMonth: dayOfMonth ? parseInt(dayOfMonth) : null,
        dueOffsetDays: parseInt(dueOffsetDays) || 15,
        active: true,
        nextRunDate: new Date(firstRunDate),
        createdByUserId: session!.id,
      },
    });
    return NextResponse.json({ template: row }, { status: 201 });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message }, { status: m.status });
  }
}
