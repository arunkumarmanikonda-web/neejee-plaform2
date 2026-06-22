// v23.40.1 — Full & Final settlement for one employee.
// GET  /api/admin/payroll/employees/:id/fnf            — list settlements for this employee
// POST /api/admin/payroll/employees/:id/fnf            — preview-only (?preview=1) OR create draft
//                                                         body: { lastWorkingDay, noticeShortfallDays, leaveBalanceDays, ... }

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireFinancePerm } from '@/lib/finance/roles';
import { recordAudit } from '@/lib/finance/audit-log';
import { computeFnF } from '@/lib/payroll/fnf';
import { randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.read');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const settlements = await prisma.fnFSettlement.findMany({
    where: { employeeId: params.id },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ settlements });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.write');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    const url = new URL(req.url);
    const previewOnly = url.searchParams.get('preview') === '1';
    const body = await req.json();

    if (!body.lastWorkingDay) {
      return NextResponse.json({ error: 'lastWorkingDay is required' }, { status: 400 });
    }

    const comp = await computeFnF({
      employeeId: params.id,
      resignationDate: body.resignationDate ? new Date(body.resignationDate) : null,
      lastWorkingDay: new Date(body.lastWorkingDay),
      noticePeriodDays: body.noticePeriodDays,
      noticeShortfallDays: body.noticeShortfallDays,
      leaveBalanceDays: body.leaveBalanceDays,
      exitReason: body.exitReason,
      bonusDuePaise: body.bonusDuePaise,
      incentiveDuePaise: body.incentiveDuePaise,
      reimbursementDuePaise: body.reimbursementDuePaise,
      loanRecoveryPaise: body.loanRecoveryPaise,
      advanceRecoveryPaise: body.advanceRecoveryPaise,
      otherRecoveryPaise: body.otherRecoveryPaise,
      tdsPaise: body.tdsPaise,
      notes: body.notes,
    });

    if (previewOnly) {
      return NextResponse.json({ preview: comp });
    }

    // Persist as DRAFT
    const created = await prisma.fnFSettlement.create({
      data: {
        id: 'fnf_' + randomBytes(10).toString('hex'),
        employeeId: params.id,
        resignationDate: body.resignationDate ? new Date(body.resignationDate) : null,
        lastWorkingDay: new Date(body.lastWorkingDay),
        noticePeriodDays: body.noticePeriodDays ?? 30,
        noticeShortfallDays: comp.noticeShortfallDays,
        exitReason: body.exitReason || null,
        pendingSalaryPaise: comp.pendingSalaryPaise,
        pendingDaysWorked: comp.pendingDaysWorked,
        leaveBalanceDays: comp.leaveBalanceDays,
        leaveEncashmentPaise: comp.leaveEncashmentPaise,
        bonusDuePaise: comp.bonusDuePaise,
        incentiveDuePaise: comp.incentiveDuePaise,
        reimbursementDuePaise: comp.reimbursementDuePaise,
        gratuityPaise: comp.gratuityPaise,
        gratuityEligible: comp.gratuityEligible,
        noticeRecoveryPaise: comp.noticeRecoveryPaise,
        loanRecoveryPaise: comp.loanRecoveryPaise,
        advanceRecoveryPaise: comp.advanceRecoveryPaise,
        otherRecoveryPaise: comp.otherRecoveryPaise,
        tdsPaise: comp.tdsPaise,
        pfFinalPaise: comp.pfFinalPaise,
        esiFinalPaise: comp.esiFinalPaise,
        totalEarningsPaise: comp.totalEarningsPaise,
        totalDeductionsPaise: comp.totalDeductionsPaise,
        netPayablePaise: comp.netPayablePaise,
        status: 'DRAFT',
        attachments: Array.isArray(body.attachments) ? body.attachments.filter(Boolean) : [],
        notes: body.notes || null,
        createdByUserId: session!.id,
      },
    });

    // Mark employee as ON_NOTICE / EXITED depending on context
    await prisma.employee.update({
      where: { id: params.id },
      data: {
        status: 'ON_NOTICE',
        resignationDate: body.resignationDate ? new Date(body.resignationDate) : undefined,
        lastWorkingDay: new Date(body.lastWorkingDay),
        exitReason: body.exitReason || undefined,
      },
    });

    await recordAudit({
      action: 'CREATE',
      entityType: 'FnFSettlement',
      entityId: created.id,
      after: created,
      session,
      req,
    });

    return NextResponse.json({ settlement: created }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to compute F&F' }, { status: 500 });
  }
}
