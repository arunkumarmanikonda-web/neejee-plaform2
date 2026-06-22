// v23.40 — Payroll compute engine
// Given an employee + month/year + their assignment + adjustments + attendance + config,
// computes a full payslip row.

import { prisma } from '@/lib/prisma';

export interface PayslipComputation {
  // Inputs
  employeeId: string;
  month: number;       // 1-12
  year: number;
  daysInMonth: number;
  daysWorked: number;
  leavesPaid: number;
  leavesUnpaid: number;
  // Earnings (paise)
  basicPaise: number;
  hraPaise: number;
  conveyancePaise: number;
  medicalPaise: number;
  specialAllowancePaise: number;
  ltaPaise: number;
  bonusPaise: number;
  incentivePaise: number;
  reimbursementPaise: number;
  otherEarningsPaise: number;
  grossPaise: number;
  // Statutory deductions
  pfEmployeePaise: number;
  pfEmployerPaise: number;
  esiEmployeePaise: number;
  esiEmployerPaise: number;
  tdsPaise: number;
  professionalTaxPaise: number;
  // Other deductions
  advanceRecoveryPaise: number;
  loanRepaymentPaise: number;
  finesPaise: number;
  otherDeductionsPaise: number;
  totalDeductionsPaise: number;
  // Net
  netPaise: number;
}

function daysInMonthOf(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

function prorate(amount: number, daysWorked: number, workingDays: number): number {
  if (workingDays <= 0) return amount;
  return Math.round((amount * daysWorked) / workingDays);
}

/**
 * Compute a payslip for one employee for the given month/year.
 * Returns null if no active salary assignment is found.
 */
export async function computePayslipForEmployee(
  employeeId: string,
  month: number,
  year: number,
): Promise<PayslipComputation | null> {
  // 1. Resolve active salary assignment as of last day of the payroll month
  const periodEnd = new Date(year, month, 0); // last day of month
  const assignment = await prisma.employeeSalaryAssignment.findFirst({
    where: {
      employeeId,
      effectiveFrom: { lte: periodEnd },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: periodEnd } }],
    },
    include: { structure: true },
    orderBy: { effectiveFrom: 'desc' },
  });
  if (!assignment) return null;

  const struct = assignment.structure;

  // 2. Resolve attendance (default to full month worked if no attendance row)
  const calendarDays = daysInMonthOf(month, year);
  const config = await prisma.payrollConfig.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton', updatedAt: new Date() },
  });
  const workingDays = config.workingDaysPerMonth;

  const attendance = await prisma.attendance.findUnique({
    where: { employeeId_month_year: { employeeId, month, year } },
  });
  const daysWorked = attendance?.daysWorked ?? workingDays;
  const leavesPaid = attendance?.leavesPaid ?? 0;
  const leavesUnpaid = attendance?.leavesUnpaid ?? 0;

  // 3. Compute earnings — prorate baseline structure by daysWorked/workingDays
  const basic = prorate(struct.basicPaise, daysWorked, workingDays);
  const hra = prorate(struct.hraPaise, daysWorked, workingDays);
  const conveyance = prorate(struct.conveyancePaise, daysWorked, workingDays);
  const medical = prorate(struct.medicalPaise, daysWorked, workingDays);
  const special = prorate(struct.specialAllowancePaise, daysWorked, workingDays);
  const lta = prorate(struct.ltaMonthlyPaise, daysWorked, workingDays);
  const baselineBonus = prorate(struct.performanceBonusPaise, daysWorked, workingDays);

  // 4. Adjustments (one-time earnings + deductions) for this period
  const adjustments = await prisma.employeeAdjustment.findMany({
    where: { employeeId, forMonth: month, forYear: year, appliedToPayslipId: null },
  });
  let incentive = 0;
  let reimbursement = 0;
  let otherEarnings = 0;
  let advance = 0;
  let loanEmi = 0;
  let fine = 0;
  let otherDeduction = 0;

  for (const a of adjustments) {
    switch (a.kind) {
      case 'INCENTIVE':       incentive += a.amountPaise; break;
      case 'BONUS':           incentive += a.amountPaise; break;
      case 'REIMBURSEMENT':   reimbursement += a.amountPaise; break;
      case 'OTHER_EARNING':   otherEarnings += a.amountPaise; break;
      case 'ADVANCE':         advance += a.amountPaise; break;
      case 'LOAN_EMI':        loanEmi += a.amountPaise; break;
      case 'FINE':            fine += a.amountPaise; break;
      case 'OTHER_DEDUCTION': otherDeduction += a.amountPaise; break;
    }
  }

  // 5. Gross
  const gross = basic + hra + conveyance + medical + special + lta + baselineBonus
              + incentive + reimbursement + otherEarnings;

  // 6. Statutory deductions (only if enabled in PayrollConfig)
  let pfEmployee = 0, pfEmployer = 0;
  let esiEmployee = 0, esiEmployer = 0;
  let tds = 0;
  let pt = 0;

  if (config.pfEnabled) {
    const pfBase = Math.min(basic, config.pfWageCeilingPaise);
    pfEmployee = Math.round((pfBase * config.pfEmployeeRate) / 100);
    pfEmployer = Math.round((pfBase * config.pfEmployerRate) / 100);
  }
  if (config.esiEnabled && gross <= config.esiGrossCeilingPaise) {
    esiEmployee = Math.round((gross * config.esiEmployeeRate) / 100);
    esiEmployer = Math.round((gross * config.esiEmployerRate) / 100);
  }
  if (config.tdsEnabled && config.tdsDefaultRate > 0) {
    // Simple flat rate; real TDS computation should consider annual projections + regime
    tds = Math.round((gross * config.tdsDefaultRate) / 100);
  }
  if (config.ptEnabled) {
    try {
      const slabs: { minPaise: number; maxPaise: number; taxPaise: number }[] = JSON.parse(config.ptSlabsJson || '[]');
      for (const slab of slabs) {
        if (gross >= slab.minPaise && gross <= slab.maxPaise) {
          pt = slab.taxPaise;
          break;
        }
      }
    } catch { /* invalid JSON — skip */ }
  }

  // 7. Total deductions + net
  const totalDeductions = pfEmployee + esiEmployee + tds + pt
                        + advance + loanEmi + fine + otherDeduction;
  const net = gross - totalDeductions;

  return {
    employeeId, month, year,
    daysInMonth: calendarDays, daysWorked, leavesPaid, leavesUnpaid,
    basicPaise: basic,
    hraPaise: hra,
    conveyancePaise: conveyance,
    medicalPaise: medical,
    specialAllowancePaise: special,
    ltaPaise: lta,
    bonusPaise: baselineBonus,
    incentivePaise: incentive,
    reimbursementPaise: reimbursement,
    otherEarningsPaise: otherEarnings,
    grossPaise: gross,
    pfEmployeePaise: pfEmployee,
    pfEmployerPaise: pfEmployer,
    esiEmployeePaise: esiEmployee,
    esiEmployerPaise: esiEmployer,
    tdsPaise: tds,
    professionalTaxPaise: pt,
    advanceRecoveryPaise: advance,
    loanRepaymentPaise: loanEmi,
    finesPaise: fine,
    otherDeductionsPaise: otherDeduction,
    totalDeductionsPaise: totalDeductions,
    netPaise: net,
  };
}

/**
 * Run payroll for all ACTIVE employees in the given month/year.
 * Creates / updates Payslip rows for each employee.
 * Returns summary stats.
 */
export async function computePayrollRun(payrollRunId: string): Promise<{
  computed: number;
  skipped: number;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
}> {
  const run = await prisma.payrollRun.findUnique({ where: { id: payrollRunId } });
  if (!run) throw new Error('Payroll run not found');
  if (run.status !== 'DRAFT' && run.status !== 'COMPUTED') {
    throw new Error(`Cannot compute a run in ${run.status} state`);
  }

  const activeEmployees = await prisma.employee.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true },
  });

  let computed = 0, skipped = 0;
  let totalGross = 0, totalDeductions = 0, totalNet = 0;

  for (const emp of activeEmployees) {
    const calc = await computePayslipForEmployee(emp.id, run.month, run.year);
    if (!calc) { skipped++; continue; }

    await prisma.payslip.upsert({
      where: { payrollRunId_employeeId: { payrollRunId: run.id, employeeId: emp.id } },
      create: {
        payrollRunId: run.id,
        employeeId: emp.id,
        daysInMonth: calc.daysInMonth,
        daysWorked: calc.daysWorked,
        leavesPaid: calc.leavesPaid,
        leavesUnpaid: calc.leavesUnpaid,
        basicPaise: calc.basicPaise,
        hraPaise: calc.hraPaise,
        conveyancePaise: calc.conveyancePaise,
        medicalPaise: calc.medicalPaise,
        specialAllowancePaise: calc.specialAllowancePaise,
        ltaPaise: calc.ltaPaise,
        bonusPaise: calc.bonusPaise,
        incentivePaise: calc.incentivePaise,
        reimbursementPaise: calc.reimbursementPaise,
        otherEarningsPaise: calc.otherEarningsPaise,
        grossPaise: calc.grossPaise,
        pfEmployeePaise: calc.pfEmployeePaise,
        pfEmployerPaise: calc.pfEmployerPaise,
        esiEmployeePaise: calc.esiEmployeePaise,
        esiEmployerPaise: calc.esiEmployerPaise,
        tdsPaise: calc.tdsPaise,
        professionalTaxPaise: calc.professionalTaxPaise,
        advanceRecoveryPaise: calc.advanceRecoveryPaise,
        loanRepaymentPaise: calc.loanRepaymentPaise,
        finesPaise: calc.finesPaise,
        otherDeductionsPaise: calc.otherDeductionsPaise,
        totalDeductionsPaise: calc.totalDeductionsPaise,
        netPaise: calc.netPaise,
      },
      update: {
        daysInMonth: calc.daysInMonth,
        daysWorked: calc.daysWorked,
        leavesPaid: calc.leavesPaid,
        leavesUnpaid: calc.leavesUnpaid,
        basicPaise: calc.basicPaise,
        hraPaise: calc.hraPaise,
        conveyancePaise: calc.conveyancePaise,
        medicalPaise: calc.medicalPaise,
        specialAllowancePaise: calc.specialAllowancePaise,
        ltaPaise: calc.ltaPaise,
        bonusPaise: calc.bonusPaise,
        incentivePaise: calc.incentivePaise,
        reimbursementPaise: calc.reimbursementPaise,
        otherEarningsPaise: calc.otherEarningsPaise,
        grossPaise: calc.grossPaise,
        pfEmployeePaise: calc.pfEmployeePaise,
        pfEmployerPaise: calc.pfEmployerPaise,
        esiEmployeePaise: calc.esiEmployeePaise,
        esiEmployerPaise: calc.esiEmployerPaise,
        tdsPaise: calc.tdsPaise,
        professionalTaxPaise: calc.professionalTaxPaise,
        advanceRecoveryPaise: calc.advanceRecoveryPaise,
        loanRepaymentPaise: calc.loanRepaymentPaise,
        finesPaise: calc.finesPaise,
        otherDeductionsPaise: calc.otherDeductionsPaise,
        totalDeductionsPaise: calc.totalDeductionsPaise,
        netPaise: calc.netPaise,
      },
    });

    computed++;
    totalGross += calc.grossPaise;
    totalDeductions += calc.totalDeductionsPaise;
    totalNet += calc.netPaise;
  }

  // Update run totals
  await prisma.payrollRun.update({
    where: { id: payrollRunId },
    data: {
      status: 'COMPUTED',
      computedAt: new Date(),
      employeeCount: computed,
      totalGrossPaise: totalGross,
      totalDeductionsPaise: totalDeductions,
      totalNetPaise: totalNet,
    },
  });

  return { computed, skipped, totalGross, totalDeductions, totalNet };
}
