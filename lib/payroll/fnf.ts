// v23.40.1 — Full & Final settlement engine.
// Pulls all due / recoverable amounts and produces a settlement preview.
// Statutory deductions respect PayrollConfig toggles.

import { prisma } from '@/lib/prisma';

export interface FnFInput {
  employeeId: string;
  resignationDate?: Date | null;
  lastWorkingDay: Date;
  noticePeriodDays?: number;
  noticeShortfallDays?: number;     // 0 if served full notice; >0 means recovery
  leaveBalanceDays?: number;        // unused paid leave balance to encash
  exitReason?: string | null;
  // Manual overrides (paise)
  bonusDuePaise?: number;
  incentiveDuePaise?: number;
  reimbursementDuePaise?: number;
  loanRecoveryPaise?: number;
  advanceRecoveryPaise?: number;
  otherRecoveryPaise?: number;
  tdsPaise?: number;
  notes?: string;
}

export interface FnFComputation {
  // Pending salary (pro-rata of partial month at LWD)
  pendingSalaryPaise: number;
  pendingDaysWorked: number;
  // Leave encashment
  leaveBalanceDays: number;
  leaveEncashmentPaise: number;
  // Earnings carried over
  bonusDuePaise: number;
  incentiveDuePaise: number;
  reimbursementDuePaise: number;
  // Gratuity
  gratuityPaise: number;
  gratuityEligible: boolean;
  gratuityTenureYears: number;
  // Recoveries
  noticeShortfallDays: number;
  noticeRecoveryPaise: number;
  loanRecoveryPaise: number;
  advanceRecoveryPaise: number;
  otherRecoveryPaise: number;
  // Statutory
  tdsPaise: number;
  pfFinalPaise: number;
  esiFinalPaise: number;
  // Totals
  totalEarningsPaise: number;
  totalDeductionsPaise: number;
  netPayablePaise: number;
  // Source data for transparency
  sourceMonthlyCtcPaise: number;
  sourceBasicPaise: number;
  workingDaysPerMonth: number;
}

const DEFAULT_WORKING_DAYS = 26;

function diffYears(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return ms / (1000 * 60 * 60 * 24 * 365.25);
}

function daysInMonthOf(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

/**
 * Compute the F&F preview. This function does NOT persist anything.
 * Caller (route) decides whether to save as DRAFT.
 */
export async function computeFnF(input: FnFInput): Promise<FnFComputation> {
  const employee = await prisma.employee.findUnique({
    where: { id: input.employeeId },
    include: {
      salaryAssignments: {
        where: { OR: [{ effectiveTo: null }, { effectiveTo: { gte: input.lastWorkingDay } }] },
        orderBy: { effectiveFrom: 'desc' },
        take: 1,
        include: { structure: true },
      },
      adjustments: {
        where: { appliedToPayslipId: null },
      },
    },
  });
  if (!employee) throw new Error('Employee not found');

  const config = await prisma.payrollConfig.findFirst();
  const workingDays = config?.workingDaysPerMonth || DEFAULT_WORKING_DAYS;

  // Current structure
  const current = employee.salaryAssignments[0];
  const monthlyCtc = current?.ctcOverridePaise ?? current?.structure.monthlyCtcPaise ?? 0;
  const basic = current?.structure.basicPaise ?? 0;

  // ── Pending salary (pro-rata for the LWD's partial month) ────────────────
  const lwd = input.lastWorkingDay;
  const monthStart = new Date(lwd.getFullYear(), lwd.getMonth(), 1);
  const pendingDaysWorked = Math.max(0, Math.min(workingDays, lwd.getDate()));
  // Daily wage = monthly CTC / working days  (per Indian standard for F&F)
  const dailyWage = workingDays > 0 ? Math.round(monthlyCtc / workingDays) : 0;
  const pendingSalaryPaise = Math.round(dailyWage * pendingDaysWorked);

  // ── Leave encashment (based on Basic, encashed at daily Basic rate) ──────
  const leaveBalance = Math.max(0, input.leaveBalanceDays ?? 0);
  const dailyBasic = workingDays > 0 ? Math.round(basic / workingDays) : 0;
  const leaveEncashmentPaise = Math.round(dailyBasic * leaveBalance);

  // ── Gratuity (Payment of Gratuity Act): tenure >= 4 years 240 days ───────
  //    Formula: (Last drawn basic × 15 × completed years of service) / 26
  const tenureYears = diffYears(employee.joiningDate, lwd);
  const completedYears = Math.floor(tenureYears + 0.001);
  // 4y 240d rule ≈ 4.658y — treat 5+ years as eligible for simplicity
  const gratuityEligible = tenureYears >= 4.658;
  const gratuityPaise = gratuityEligible
    ? Math.round((basic * 15 * completedYears) / 26)
    : 0;

  // ── Notice period recovery ───────────────────────────────────────────────
  const noticeShortfallDays = Math.max(0, input.noticeShortfallDays ?? 0);
  const noticeRecoveryPaise = Math.round(dailyWage * noticeShortfallDays);

  // ── Earnings carried over ───────────────────────────────────────────────
  // If caller didn't pass overrides, accumulate pending adjustments
  let autoBonus = 0;
  let autoIncentive = 0;
  let autoReimb = 0;
  let autoOtherDed = 0;
  let autoAdvance = 0;
  let autoLoan = 0;
  for (const adj of employee.adjustments) {
    switch (adj.kind) {
      case 'BONUS':          autoBonus += adj.amountPaise; break;
      case 'INCENTIVE':      autoIncentive += adj.amountPaise; break;
      case 'REIMBURSEMENT':  autoReimb += adj.amountPaise; break;
      case 'ADVANCE':        autoAdvance += adj.amountPaise; break;
      case 'LOAN_EMI':       autoLoan += adj.amountPaise; break;
      case 'OTHER_DEDUCTION':
      case 'FINE':           autoOtherDed += adj.amountPaise; break;
      case 'OTHER_EARNING':  autoBonus += adj.amountPaise; break;
    }
  }
  const bonusDuePaise         = input.bonusDuePaise         ?? autoBonus;
  const incentiveDuePaise     = input.incentiveDuePaise     ?? autoIncentive;
  const reimbursementDuePaise = input.reimbursementDuePaise ?? autoReimb;
  const loanRecoveryPaise     = input.loanRecoveryPaise     ?? autoLoan;
  const advanceRecoveryPaise  = input.advanceRecoveryPaise  ?? autoAdvance;
  const otherRecoveryPaise    = input.otherRecoveryPaise    ?? autoOtherDed;

  // ── Statutory deductions on final amount ────────────────────────────────
  // PF / ESI on the pending-salary basic portion only.
  const pfFinalPaise = (config?.pfEnabled)
    ? Math.round(Math.min(basic, config.pfWageCeilingPaise) * (config.pfEmployeeRate / 100) * (pendingDaysWorked / workingDays))
    : 0;
  const esiFinalPaise = (config?.esiEnabled && pendingSalaryPaise > 0 && pendingSalaryPaise <= config.esiGrossCeilingPaise)
    ? Math.round(pendingSalaryPaise * ((config.esiEmployeeRate || 0) / 100))
    : 0;
  const tdsPaise = Math.max(0, input.tdsPaise ?? 0);

  // ── Totals ───────────────────────────────────────────────────────────────
  const totalEarningsPaise =
    pendingSalaryPaise +
    leaveEncashmentPaise +
    bonusDuePaise +
    incentiveDuePaise +
    reimbursementDuePaise +
    gratuityPaise;

  const totalDeductionsPaise =
    noticeRecoveryPaise +
    loanRecoveryPaise +
    advanceRecoveryPaise +
    otherRecoveryPaise +
    tdsPaise +
    pfFinalPaise +
    esiFinalPaise;

  const netPayablePaise = totalEarningsPaise - totalDeductionsPaise;

  return {
    pendingSalaryPaise,
    pendingDaysWorked,
    leaveBalanceDays: leaveBalance,
    leaveEncashmentPaise,
    bonusDuePaise,
    incentiveDuePaise,
    reimbursementDuePaise,
    gratuityPaise,
    gratuityEligible,
    gratuityTenureYears: Math.round(tenureYears * 100) / 100,
    noticeShortfallDays,
    noticeRecoveryPaise,
    loanRecoveryPaise,
    advanceRecoveryPaise,
    otherRecoveryPaise,
    tdsPaise,
    pfFinalPaise,
    esiFinalPaise,
    totalEarningsPaise,
    totalDeductionsPaise,
    netPayablePaise,
    sourceMonthlyCtcPaise: monthlyCtc,
    sourceBasicPaise: basic,
    workingDaysPerMonth: workingDays,
  };
}
