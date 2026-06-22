// P&L (Profit & Loss) computation engine.
//
// Supports BOTH accounting methods via a single `basis` flag:
//   - 'cash'    → only PAID orders count, paid via Order.updatedAt when paymentStatus=PAID
//   - 'accrual' → all non-cancelled orders count, by Order.createdAt (economic event happened)
//
// All amounts in paise (Int). Caller converts to rupees for display.

import { prisma } from '@/lib/prisma';
import type { Period } from './period';

export type PnlBasis = 'cash' | 'accrual';

export type PnlLine = {
  code: string;
  label: string;
  amountPaise: number;
  children?: PnlLine[];
};

export type PnlReport = {
  basis: PnlBasis;
  period: { from: string; to: string; label: string };
  generatedAt: string;
  revenue: {
    productSales: number;
    shippingCharged: number;
    otherRevenue: number;
    total: number;
  };
  deductions: {
    couponDiscounts: number;
    refunds: number;
    returnsValue: number;
    total: number;
  };
  netRevenue: number;
  cogs: {
    productCost: number;
    inboundShipping: number;
    packaging: number;
    qc: number;
    writeBackFromReturns: number;   // NEGATIVE
    total: number;
  };
  grossProfit: number;
  opex: {
    marketing: PnlLine[];
    communication: PnlLine[];
    shipping: PnlLine[];
    payment: PnlLine[];
    platform: PnlLine[];
    people: PnlLine[];
    office: PnlLine[];
    professional: PnlLine[];
    other: PnlLine[];
    writeOffs: PnlLine[];
    totalsByGroup: Record<string, number>;
    grandTotal: number;
  };
  ebitda: number;
  tax: {
    gstOutput: number;
    gstInputClaimable: number;
    gstNetPayable: number;
    incomeTaxProvision: number;
    total: number;
  };
  netProfit: number;
  diagnostics: {
    orderCount: number;
    paidOrderCount: number;
    returnCount: number;
    expenseCount: number;
    notes: string[];
  };
};

const GROUPS = {
  MARKETING:    'OPEX_MARKETING',
  COMMS:        'OPEX_COMMUNICATION',
  SHIPPING:     'OPEX_SHIPPING',
  PAYMENT:      'OPEX_PAYMENT',
  PLATFORM:     'OPEX_PLATFORM',
  PEOPLE:       'OPEX_PEOPLE',
  OFFICE:       'OPEX_OFFICE',
  PROFESSIONAL: 'OPEX_PROFESSIONAL',
  TAX_OTHER:    'OPEX_TAX_OTHER',
  OTHER:        'OPEX_OTHER',
  COGS:         'COGS_DIRECT',
  WRITE_OFF:    'WRITE_OFF',
} as const;

/** Computes a P&L report for the given period and basis. */
export async function computePnl(period: Period, basis: PnlBasis): Promise<PnlReport> {
  const notes: string[] = [];

  // ──────────────────────────────────────────────────────
  // 1. Revenue (from Orders)
  // ──────────────────────────────────────────────────────
  // ACCRUAL: order placed in period, regardless of payment status (except CANCELLED).
  // CASH: only orders that are PAID, dated by updatedAt (last status change) in period.
  const orderWhere: any = { status: { notIn: ['CANCELLED'] } };
  if (basis === 'cash') {
    orderWhere.paymentStatus = 'PAID';
    orderWhere.updatedAt = { gte: period.from, lt: period.to };
  } else {
    orderWhere.createdAt = { gte: period.from, lt: period.to };
  }

  const orders = await prisma.order.findMany({
    where: orderWhere,
    select: {
      id: true,
      orderNumber: true,
      subtotal: true,       // pre-discount items total
      shipping: true,
      discount: true,
      tax: true,             // GST collected
      total: true,
      paymentStatus: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      items: {
        select: {
          productId: true,
          variantId: true,
          quantity: true,
          price: true,
        },
      },
    },
  });

  let productSales = 0;
  let shippingCharged = 0;
  let couponDiscounts = 0;
  let gstOutput = 0;

  for (const o of orders) {
    productSales += o.subtotal || 0;
    shippingCharged += o.shipping || 0;
    couponDiscounts += o.discount || 0;
    gstOutput += o.tax || 0;
  }

  // ──────────────────────────────────────────────────────
  // 2. Returns (from ReturnEntry)
  // ──────────────────────────────────────────────────────
  // Date by refundedOn for cash, returnedOn for accrual.
  const returnDateField = basis === 'cash' ? 'refundedOn' : 'returnedOn';
  const returnWhere: any = { [returnDateField]: { gte: period.from, lt: period.to } };
  if (basis === 'cash') returnWhere.refundedOn = { ...returnWhere[returnDateField], not: null };

  const returns = await prisma.returnEntry.findMany({ where: returnWhere });

  let refunds = 0;
  let returnsValue = 0;
  let damageWriteOff = 0;
  let cogsRestockWriteBack = 0;

  for (const r of returns) {
    refunds += r.refundedAmountPaise || 0;
    damageWriteOff += r.damagedValuePaise || 0;
    cogsRestockWriteBack += r.restockedValuePaise || 0;
  }

  // ──────────────────────────────────────────────────────
  // 3. COGS — match sold quantities to PurchaseCost ledger
  // ──────────────────────────────────────────────────────
  // Pick latest PurchaseCost where receivedAt <= order date for (productId, variantId?)
  let productCost = 0;
  const missingCostProducts = new Set<string>();

  for (const o of orders) {
    const refDate = basis === 'cash' ? o.updatedAt : o.createdAt;
    for (const ln of o.items) {
      // Try variant-specific cost first
      let cost = ln.variantId
        ? await prisma.purchaseCost.findFirst({
            where: {
              productId: ln.productId,
              variantId: ln.variantId,
              receivedAt: { lte: refDate },
            },
            orderBy: { receivedAt: 'desc' },
            select: { unitCostPaise: true },
          })
        : null;

      // Fallback: any cost for this product
      if (!cost) {
        cost = await prisma.purchaseCost.findFirst({
          where: { productId: ln.productId, receivedAt: { lte: refDate } },
          orderBy: { receivedAt: 'desc' },
          select: { unitCostPaise: true },
        });
      }

      if (cost) {
        productCost += (cost.unitCostPaise || 0) * (ln.quantity || 0);
      } else {
        missingCostProducts.add(ln.productId);
      }
    }
  }
  if (missingCostProducts.size > 0) {
    notes.push(`${missingCostProducts.size} product(s) sold without a PurchaseCost record — COGS may be understated.`);
  }

  // ──────────────────────────────────────────────────────
  // 4. Expenses
  // ──────────────────────────────────────────────────────
  const expenseDateField = basis === 'cash' ? 'paidOn' : 'incurredOn';
  const expenseWhere: any = {
    status: 'APPROVED',
    [expenseDateField]: { gte: period.from, lt: period.to },
  };
  if (basis === 'cash') expenseWhere.paidOn = { ...expenseWhere[expenseDateField], not: null };

  const expenses = await prisma.expense.findMany({
    where: expenseWhere,
    include: { category: { select: { code: true, label: true, group: true, gstInputClaimable: true } } },
  });

  const buckets: Record<string, Record<string, { label: string; amount: number }>> = {};
  let cogsInbound = 0, cogsPackaging = 0, cogsQc = 0;
  let gstInputClaimable = 0;
  let writeOffsTotal = 0;

  for (const e of expenses) {
    const grp = e.category.group;
    const code = e.category.code;
    const amt = e.amountPaise || 0;

    if (e.category.gstInputClaimable) gstInputClaimable += e.gstPaise || 0;

    if (grp === GROUPS.COGS) {
      if (code === 'COGS_INBOUND_SHIPPING') cogsInbound += amt;
      else if (code === 'COGS_PACKAGING') cogsPackaging += amt;
      else if (code === 'COGS_QC') cogsQc += amt;
      else cogsQc += amt;
      continue;
    }
    if (grp === GROUPS.WRITE_OFF) writeOffsTotal += amt;

    if (!buckets[grp]) buckets[grp] = {};
    if (!buckets[grp][code]) buckets[grp][code] = { label: e.category.label, amount: 0 };
    buckets[grp][code].amount += amt;
  }

  const toLines = (grp: string): PnlLine[] => {
    const b = buckets[grp] || {};
    return Object.entries(b).map(([code, v]) => ({
      code, label: v.label, amountPaise: v.amount,
    })).sort((a, b) => b.amountPaise - a.amountPaise);
  };

  const opexMarketing    = toLines(GROUPS.MARKETING);
  const opexComms        = toLines(GROUPS.COMMS);
  const opexShipping     = toLines(GROUPS.SHIPPING);
  const opexPayment      = toLines(GROUPS.PAYMENT);
  const opexPlatform     = toLines(GROUPS.PLATFORM);
  const opexPeople       = toLines(GROUPS.PEOPLE);
  const opexOffice       = toLines(GROUPS.OFFICE);
  const opexProfessional = toLines(GROUPS.PROFESSIONAL);
  const opexOther        = [...toLines(GROUPS.OTHER), ...toLines(GROUPS.TAX_OTHER).filter(l => l.code !== 'TAX_INCOME')];
  const opexWriteOffs    = toLines(GROUPS.WRITE_OFF);

  const sumLines = (lines: PnlLine[]) => lines.reduce((s, l) => s + l.amountPaise, 0);

  const opexByGroup: Record<string, number> = {
    marketing:    sumLines(opexMarketing),
    communication:sumLines(opexComms),
    shipping:     sumLines(opexShipping),
    payment:      sumLines(opexPayment),
    platform:     sumLines(opexPlatform),
    people:       sumLines(opexPeople),
    office:       sumLines(opexOffice),
    professional: sumLines(opexProfessional),
    other:        sumLines(opexOther),
    writeOffs:    sumLines(opexWriteOffs),
  };
  const opexGrand = Object.values(opexByGroup).reduce((s, n) => s + n, 0);

  const incomeTaxProvision =
    (buckets[GROUPS.TAX_OTHER] && buckets[GROUPS.TAX_OTHER]['TAX_INCOME']?.amount) || 0;

  // ──────────────────────────────────────────────────────
  // 5. Assemble
  // ──────────────────────────────────────────────────────
  const revenueTotal = productSales + shippingCharged;
  const deductionsTotal = couponDiscounts + refunds;
  const netRev = revenueTotal - deductionsTotal;

  const cogsTotal = productCost + cogsInbound + cogsPackaging + cogsQc - cogsRestockWriteBack;
  const gross = netRev - cogsTotal;
  const ebitda = gross - opexGrand;

  const gstNet = Math.max(0, gstOutput - gstInputClaimable);
  const taxTotal = gstNet + incomeTaxProvision;
  const netProfit = ebitda - taxTotal;

  return {
    basis,
    period: {
      from: period.from.toISOString(),
      to: period.to.toISOString(),
      label: period.label,
    },
    generatedAt: new Date().toISOString(),
    revenue: {
      productSales,
      shippingCharged,
      otherRevenue: 0,
      total: revenueTotal,
    },
    deductions: {
      couponDiscounts,
      refunds,
      returnsValue,
      total: deductionsTotal,
    },
    netRevenue: netRev,
    cogs: {
      productCost,
      inboundShipping: cogsInbound,
      packaging: cogsPackaging,
      qc: cogsQc,
      writeBackFromReturns: -cogsRestockWriteBack,
      total: cogsTotal,
    },
    grossProfit: gross,
    opex: {
      marketing:    opexMarketing,
      communication:opexComms,
      shipping:     opexShipping,
      payment:      opexPayment,
      platform:     opexPlatform,
      people:       opexPeople,
      office:       opexOffice,
      professional: opexProfessional,
      other:        opexOther,
      writeOffs:    opexWriteOffs,
      totalsByGroup:opexByGroup,
      grandTotal:   opexGrand,
    },
    ebitda,
    tax: {
      gstOutput,
      gstInputClaimable,
      gstNetPayable: gstNet,
      incomeTaxProvision,
      total: taxTotal,
    },
    netProfit,
    diagnostics: {
      orderCount: orders.length,
      paidOrderCount: orders.filter(o => o.paymentStatus === 'PAID').length,
      returnCount: returns.length,
      expenseCount: expenses.length,
      notes,
    },
  };
}

/** Marketing attribution: revenue per channel via Coupon → ExpenseCategory map. */
export async function computeMarketingAttribution(period: Period, basis: PnlBasis): Promise<Array<{
  categoryId: string;
  categoryCode: string;
  categoryLabel: string;
  revenuePaise: number;
  spendPaise: number;
  budgetPaise: number;
  orderCount: number;
  cacPaise: number;
  romiPct: number;
}>> {
  // Look up all marketing-channel categories
  const cats = await prisma.expenseCategory.findMany({
    where: { isMarketingChannel: true, isActive: true },
    select: { id: true, code: true, label: true },
  });
  if (cats.length === 0) return [];

  // coupon → category
  const maps = await prisma.marketingChannelMap.findMany({
    select: { couponId: true, expenseCategoryId: true },
  });
  const couponToCategory = new Map(maps.map(m => [m.couponId, m.expenseCategoryId]));
  const allCouponIds = Array.from(couponToCategory.keys());

  // Orders in period that used an attributed coupon. CouponRedemption tracks coupon use.
  // Fallback: try the coupon_id column on Order if present (older schema); else use the
  // CouponRedemption join model. We try CouponRedemption first via a safe-typed query.
  let attributedOrders: Array<{ couponId: string; orderId: string; subtotal: number }> = [];

  if (allCouponIds.length > 0) {
    const dateField = basis === 'cash' ? 'updatedAt' : 'createdAt';
    const orderFilter: any = {
      status: { notIn: ['CANCELLED'] },
      [dateField]: { gte: period.from, lt: period.to },
    };
    if (basis === 'cash') orderFilter.paymentStatus = 'PAID';

    // Use raw redemption table — guaranteed compat with multiple schemas
    try {
      const redemptions: any[] = await (prisma as any).couponRedemption.findMany({
        where: {
          couponId: { in: allCouponIds },
          order: orderFilter,
        },
        select: { couponId: true, orderId: true, order: { select: { subtotal: true } } },
      });
      attributedOrders = redemptions.map(r => ({
        couponId: r.couponId,
        orderId: r.orderId,
        subtotal: r.order?.subtotal || 0,
      }));
    } catch {
      // CouponRedemption model not present — skip attribution
    }
  }

  // Aggregate revenue & orders per category
  const rev: Record<string, { revenue: number; orders: number }> = {};
  for (const ao of attributedOrders) {
    const catId = couponToCategory.get(ao.couponId);
    if (!catId) continue;
    if (!rev[catId]) rev[catId] = { revenue: 0, orders: 0 };
    rev[catId].revenue += ao.subtotal;
    rev[catId].orders += 1;
  }

  // Spend per category in same period
  const expenseDate = basis === 'cash' ? 'paidOn' : 'incurredOn';
  const expenseWhere: any = {
    status: 'APPROVED',
    [expenseDate]: { gte: period.from, lt: period.to },
  };
  if (basis === 'cash') expenseWhere.paidOn = { ...expenseWhere[expenseDate], not: null };

  const spendRows = await prisma.expense.groupBy({
    by: ['categoryId'],
    where: expenseWhere,
    _sum: { amountPaise: true },
  });
  const spend = new Map(spendRows.map(s => [s.categoryId, s._sum.amountPaise || 0]));

  // Budget per category (current month within period)
  const ist = new Date(period.from.getTime() + 5.5 * 3600 * 1000);
  const budgetRows = await prisma.marketingBudget.findMany({
    where: {
      periodYear: ist.getUTCFullYear(),
      periodMonth: ist.getUTCMonth() + 1,
    },
  });
  const budget = new Map(budgetRows.map(b => [b.expenseCategoryId, b.budgetPaise]));

  return cats.map(c => {
    const r = rev[c.id] || { revenue: 0, orders: 0 };
    const s = spend.get(c.id) || 0;
    const b = budget.get(c.id) || 0;
    const cac = r.orders > 0 ? Math.round(s / r.orders) : 0;
    const romi = s > 0 ? ((r.revenue - s) / s) * 100 : 0;
    return {
      categoryId: c.id,
      categoryCode: c.code,
      categoryLabel: c.label,
      revenuePaise: r.revenue,
      spendPaise: s,
      budgetPaise: b,
      orderCount: r.orders,
      cacPaise: cac,
      romiPct: Math.round(romi * 10) / 10,
    };
  }).sort((a, b) => b.revenuePaise - a.revenuePaise);
}
