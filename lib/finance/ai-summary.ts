// v23.40.8 — Full-stack AI weekly briefing.
//
// Pulls signals from every layer of the finance model:
//   - P&L (revenue, COGS, opex, EBITDA, net profit) — from computePnl()
//   - Revenue ledger (POS / B2B / commission / channel mix, realized vs accrued)
//   - Sales invoices (AR outstanding, overdue)
//   - Bills + Expenses (AP outstanding, overdue, top vendors by spend with categories)
//   - Bank cash position (sum of bank account closing balances)
//   - GST (output vs claimable input, net payable)
//   - Marketplace (commissions billed, seller GMV)
//   - Anomalies (statistical spend alerts)
//
// Composes a structured 5-section briefing for founders.

import { prisma } from '@/lib/prisma';
import { periodLastWeek } from './period';
import { computePnl, type PnlReport } from './pnl';
import { openaiChat } from '@/lib/ai';
import { formatINR, formatINRShort } from '@/lib/money';
import { detectAnomalies, persistAnomalies } from './anomaly';
import { computeApAging } from './bills';

export type AiSummaryResult = {
  reportId: string;
  periodLabel: string;
  narrative: string;
  recipients: string[];
  source: 'openai' | 'template';
};

function pctChange(curr: number, prev: number): { pct: number; arrow: '↑' | '↓' | '→' } {
  if (prev === 0) return { pct: 0, arrow: '→' };
  const pct = ((curr - prev) / Math.abs(prev)) * 100;
  return {
    pct: Math.round(pct * 10) / 10,
    arrow: pct > 0.5 ? '↑' : pct < -0.5 ? '↓' : '→',
  };
}

interface RevenueLayerSnapshot {
  realizedRevenuePaise:  number;
  accruedRevenuePaise:   number;
  posRevenuePaise:       number;
  websiteRevenuePaise:   number;
  bulkRevenuePaise:      number;
  commissionIncomePaise: number;
  marketplaceGmvPaise:   number;
  gstOutputPaise:        number;
  invoiceCount:          number;
}

interface ApArSnapshot {
  apTotalPaise:          number;
  apOverduePaise:        number;
  arOutstandingPaise:    number;
  arOverduePaise:        number;
  arInvoiceCount:        number;
  arOverdueCount:        number;
  topAr:                 Array<{ name: string; outstanding: number }>; // v23.40.11
}

interface VendorSnapshot {
  topVendorsBySpend:     Array<{ name: string; group: string | null; paise: number }>;
  vendorCount:           number;
  uncategorisedVendors:  number;
}

interface CashSnapshot {
  bankClosingPaise:      number;
  bankAccountCount:      number;
}

async function collectRevenueLayer(from: Date, to: Date): Promise<RevenueLayerSnapshot> {
  const entries = await prisma.revenueEntry.findMany({
    where: { txnDate: { gte: from, lte: to } },
    select: { type: true, channel: true, saleType: true, amountPaise: true, status: true, cgstPaise: true, sgstPaise: true, igstPaise: true },
  });

  let realizedRevenue = 0, accruedRevenue = 0;
  let posRev = 0, webRev = 0, bulkRev = 0, commIncome = 0, marketplaceGmv = 0;
  let gstOutput = 0;

  for (const e of entries) {
    if (['PRODUCT_REVENUE', 'SHIPPING_REVENUE', 'COMMISSION_INCOME'].includes(e.type)) {
      if (e.status === 'REALIZED') realizedRevenue += e.amountPaise;
      else if (e.status === 'ACCRUED') accruedRevenue += e.amountPaise;
    }
    if (e.type === 'PRODUCT_REVENUE') {
      if (e.channel === 'POS')      posRev  += e.amountPaise;
      if (e.channel === 'WEBSITE')  webRev  += e.amountPaise;
      if (e.channel === 'BULK')     bulkRev += e.amountPaise;
      if (e.saleType === 'MARKETPLACE') marketplaceGmv += e.amountPaise;
    }
    if (e.type === 'COMMISSION_INCOME') commIncome += e.amountPaise;
    gstOutput += e.cgstPaise + e.sgstPaise + e.igstPaise;
  }

  const invoiceCount = await prisma.salesInvoice.count({
    where: { issuedOn: { gte: from, lte: to } },
  });

  return {
    realizedRevenuePaise:  realizedRevenue,
    accruedRevenuePaise:   accruedRevenue,
    posRevenuePaise:       posRev,
    websiteRevenuePaise:   webRev,
    bulkRevenuePaise:      bulkRev,
    commissionIncomePaise: commIncome,
    marketplaceGmvPaise:   marketplaceGmv,
    gstOutputPaise:        gstOutput,
    invoiceCount,
  };
}

async function collectApAr(): Promise<ApArSnapshot> {
  // AP from existing helper
  let apTotal = 0, apOverdue = 0;
  try {
    const ap = await computeApAging();
    apTotal = ap.totalOutstandingPaise;
    apOverdue = ap.buckets.filter((b: any) => b.bucket !== 'CURRENT').reduce((s: number, b: any) => s + b.outstandingPaise, 0);
  } catch { /* ignore */ }

  // AR from sales invoices
  const arInvoices = await prisma.salesInvoice.findMany({
    where: { paymentStatus: { notIn: ['PAID', 'CANCELLED'] } },
    select: { totalPaise: true, paidPaise: true, dueOn: true, customerId: true, customerName: true },
  });
  const now = new Date();
  let arOut = 0, arOverdue = 0, overdueCount = 0;
  const arByCustomer = new Map<string, { name: string; outstanding: number }>();
  for (const inv of arInvoices) {
    const outstanding = inv.totalPaise - inv.paidPaise;
    arOut += outstanding;
    if (inv.dueOn && new Date(inv.dueOn) < now) { arOverdue += outstanding; overdueCount++; }
    // v23.40.11 — group AR by customer for the briefing
    const key = inv.customerId || `name:${inv.customerName}`;
    const cur = arByCustomer.get(key) || { name: inv.customerName, outstanding: 0 };
    cur.outstanding += outstanding;
    arByCustomer.set(key, cur);
  }
  const topAr = Array.from(arByCustomer.values()).sort((a, b) => b.outstanding - a.outstanding).slice(0, 5);

  return {
    apTotalPaise:       apTotal,
    apOverduePaise:     apOverdue,
    arOutstandingPaise: arOut,
    arOverduePaise:     arOverdue,
    arInvoiceCount:     arInvoices.length,
    arOverdueCount:     overdueCount,
    topAr,  // v23.40.11
  };
}

async function collectVendorSnapshot(from: Date, to: Date): Promise<VendorSnapshot> {
  // Spend per vendor in window — from bills + expenses
  const bills = await prisma.bill.findMany({
    where: { issuedOn: { gte: from, lte: to } },
    select: { vendorId: true, vendorNameSnapshot: true, totalPaise: true },
  });
  const expenses = await prisma.expense.findMany({
    where: { incurredOn: { gte: from, lte: to } },
    select: { vendorId: true, vendorNameSnapshot: true, totalPaise: true },
  });

  const map = new Map<string, { name: string; paise: number; vendorId?: string | null }>();
  function add(name: string | null | undefined, vendorId: string | null, paise: number) {
    const key = vendorId || (name || '— Unassigned').trim().toLowerCase();
    if (!map.has(key)) map.set(key, { name: name || '— Unassigned', paise: 0, vendorId });
    const r = map.get(key)!;
    r.paise += paise;
  }
  for (const b of bills)    add(b.vendorNameSnapshot, b.vendorId, b.totalPaise);
  for (const e of expenses) add(e.vendorNameSnapshot, e.vendorId, e.totalPaise);

  // Fetch group for vendorIds
  const ids = Array.from(map.values()).map(r => r.vendorId).filter(Boolean) as string[];
  const groups = ids.length
    ? await prisma.vendor.findMany({ where: { id: { in: ids } }, select: { id: true, serviceCategoryGroup: true } })
    : [];
  const groupMap = new Map(groups.map(g => [g.id, g.serviceCategoryGroup]));

  const top = Array.from(map.values())
    .sort((a, b) => b.paise - a.paise)
    .slice(0, 5)
    .map(r => ({
      name: r.name,
      group: r.vendorId ? (groupMap.get(r.vendorId) || null) : null,
      paise: r.paise,
    }));

  const [vendorCount, uncategorised] = await Promise.all([
    prisma.vendor.count(),
    prisma.vendor.count({ where: { serviceCategoryGroup: null } }),
  ]);
  return { topVendorsBySpend: top, vendorCount, uncategorisedVendors: uncategorised };
}

async function collectCashSnapshot(): Promise<CashSnapshot> {
  try {
    const accts = await prisma.bankAccount.findMany({
      select: { id: true, openingBalancePaise: true },
    });
    if (!accts.length) return { bankClosingPaise: 0, bankAccountCount: 0 };
    const txns = await prisma.bankTransaction.groupBy({
      by: ['bankAccountId'],
      _sum: { debitPaise: true, creditPaise: true },
    });
    const sumMap = new Map(txns.map(t => [t.bankAccountId, { dr: t._sum.debitPaise || 0, cr: t._sum.creditPaise || 0 }]));
    let closing = 0;
    for (const a of accts) {
      const s = sumMap.get(a.id) || { dr: 0, cr: 0 };
      closing += (a.openingBalancePaise || 0) + s.cr - s.dr;
    }
    return { bankClosingPaise: closing, bankAccountCount: accts.length };
  } catch {
    return { bankClosingPaise: 0, bankAccountCount: 0 };
  }
}

function buildTemplate(
  thisWk: PnlReport,
  lastWk: PnlReport,
  rev: RevenueLayerSnapshot,
  apar: ApArSnapshot,
  vend: VendorSnapshot,
  cash: CashSnapshot,
): string {
  const revPct = pctChange(thisWk.revenue.total, lastWk.revenue.total);
  const npPct  = pctChange(thisWk.netProfit, lastWk.netProfit);
  const orderCount = thisWk.diagnostics.orderCount;
  const aov = orderCount > 0 ? Math.round(thisWk.revenue.total / orderCount) : 0;
  const grossMargin = thisWk.netRevenue > 0 ? Math.round((thisWk.grossProfit / thisWk.netRevenue) * 1000) / 10 : 0;

  const topOpex = Object.entries(thisWk.opex.totalsByGroup)
    .filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([g, v]) => `${g.replace('OPEX_', '')} ${formatINRShort(v)}`).join(', ');

  const topVendors = vend.topVendorsBySpend.map(v =>
    `${v.name} ${formatINRShort(v.paise)}${v.group ? ` (${v.group.replace('OPEX_', '').replace('_', ' ')})` : ''}`
  ).join(', ');

  const lines: string[] = [];
  lines.push(`**📊 This week (${thisWk.period.label})**`);
  lines.push(`Revenue ${formatINR(thisWk.revenue.total)} ${revPct.arrow} ${Math.abs(revPct.pct)}% WoW · ${orderCount} orders · AOV ${formatINR(aov)}.`);
  lines.push(`Net profit ${formatINR(thisWk.netProfit)} ${npPct.arrow} ${Math.abs(npPct.pct)}% · gross margin ${grossMargin}%.`);
  lines.push('');
  lines.push(`**💰 Revenue mix (booked this week)**`);
  lines.push(`Website ${formatINR(rev.websiteRevenuePaise)} · POS ${formatINR(rev.posRevenuePaise)} · Bulk ${formatINR(rev.bulkRevenuePaise)} · Commission ${formatINR(rev.commissionIncomePaise)}.`);
  lines.push(`Marketplace GMV ${formatINR(rev.marketplaceGmvPaise)} · ${rev.invoiceCount} sales invoice(s) issued.`);
  lines.push(`Realized ${formatINR(rev.realizedRevenuePaise)} · Accrued (unpaid) ${formatINR(rev.accruedRevenuePaise)}.`);
  lines.push('');
  lines.push(`**🧾 Costs & vendors**`);
  lines.push(`Opex ${formatINR(thisWk.opex.grandTotal)} — top: ${topOpex || 'none recorded'}.`);
  if (topVendors) lines.push(`Top vendor spend: ${topVendors}.`);
  if (vend.uncategorisedVendors > 0) lines.push(`⚠ ${vend.uncategorisedVendors} of ${vend.vendorCount} vendors uncategorised — tag them for better reporting.`);
  lines.push('');
  lines.push(`**💵 Cash, AR & AP**`);
  lines.push(`Bank balance ${formatINR(cash.bankClosingPaise)} across ${cash.bankAccountCount} account(s).`);
  lines.push(`AR outstanding ${formatINR(apar.arOutstandingPaise)} (${apar.arInvoiceCount} invoice(s), ${apar.arOverdueCount} overdue worth ${formatINR(apar.arOverduePaise)}).`);
  // v23.40.11 — top 5 customers by AR
  if (apar.topAr?.length) {
    const tops = apar.topAr.slice(0, 3).map(c => `${c.name} ${formatINR(c.outstanding)}`).join(' • ');
    lines.push(`Top AR: ${tops}.`);
  }
  lines.push(`AP outstanding ${formatINR(apar.apTotalPaise)} · overdue ${formatINR(apar.apOverduePaise)}.`);
  lines.push(`GST output collected: ${formatINR(rev.gstOutputPaise)}.`);
  lines.push('');
  if (thisWk.diagnostics.notes.length) {
    lines.push(`**🚨 Heads up**`);
    for (const n of thisWk.diagnostics.notes) lines.push(`• ${n}`);
  } else {
    lines.push(`**✅ No data-quality issues detected.**`);
  }
  return lines.join('\n');
}

async function buildOpenAINarrative(
  thisWk: PnlReport, lastWk: PnlReport,
  rev: RevenueLayerSnapshot, apar: ApArSnapshot, vend: VendorSnapshot, cash: CashSnapshot,
): Promise<string | null> {
  const compactPnl = (r: PnlReport) => ({
    period: r.period.label,
    orders: r.diagnostics.orderCount,
    revenue_rs: r.revenue.total / 100,
    netRevenue_rs: r.netRevenue / 100,
    cogs_rs: r.cogs.total / 100,
    grossProfit_rs: r.grossProfit / 100,
    opex_rs: r.opex.grandTotal / 100,
    opexBreakdown_rs: Object.fromEntries(
      Object.entries(r.opex.totalsByGroup).map(([k, v]) => [k, v / 100])
    ),
    ebitda_rs: r.ebitda / 100,
    netProfit_rs: r.netProfit / 100,
  });

  const ctx = {
    thisWeek: compactPnl(thisWk),
    lastWeek: compactPnl(lastWk),
    revenueMix_rs: {
      website:       rev.websiteRevenuePaise   / 100,
      pos:           rev.posRevenuePaise       / 100,
      bulk:          rev.bulkRevenuePaise      / 100,
      commission:    rev.commissionIncomePaise / 100,
      marketplaceGmv:rev.marketplaceGmvPaise   / 100,
      realized:      rev.realizedRevenuePaise  / 100,
      accrued:       rev.accruedRevenuePaise   / 100,
      gstOutput:     rev.gstOutputPaise        / 100,
      invoiceCount:  rev.invoiceCount,
    },
    cash_rs: {
      bankClosing:   cash.bankClosingPaise / 100,
      accountCount:  cash.bankAccountCount,
    },
    receivables_rs: {
      outstanding:   apar.arOutstandingPaise / 100,
      overdue:       apar.arOverduePaise     / 100,
      invoiceCount:  apar.arInvoiceCount,
      overdueCount:  apar.arOverdueCount,
    },
    payables_rs: {
      outstanding:   apar.apTotalPaise   / 100,
      overdue:       apar.apOverduePaise / 100,
    },
    topVendors_rs: vend.topVendorsBySpend.map(v => ({ name: v.name, group: v.group, paise_rs: v.paise / 100 })),
    vendorHygiene: { total: vend.vendorCount, uncategorised: vend.uncategorisedVendors },
    diagnosticsNotes: thisWk.diagnostics.notes,
  };

  const sys = `You are NEEJEE's CFO assistant. Write a comprehensive weekly briefing (max 300 words, exactly 5 sections with these emoji headers: 📊 Headline · 💰 Revenue mix · 🧾 Costs & vendors · 💵 Cash, AR & AP · 🚨 Watch-outs / suggestions). Tone: calm, observant, founder-friendly. Use ₹ figures with Indian formatting (e.g. ₹1.2L, ₹24,500). Cover all aspects: D2C orders, POS, B2B / bulk, marketplace commission income, GST collected, top vendor spend (mention service category if available), cash position across bank accounts, AR (receivables — what customers owe us) AND AP (payables — what we owe vendors). Compare to last week with arrows ↑↓→. End the Watch-outs section with one specific actionable suggestion. Do NOT invent numbers; only use what's provided. Begin directly with **📊 Headline** — no preamble.`;

  const userMsg = `Here is the full finance snapshot for the week. Compose the briefing.\n\n${JSON.stringify(ctx, null, 2)}`;

  const r = await openaiChat({
    system: sys,
    messages: [{ role: 'user', content: userMsg }],
    model: 'gpt-4o-mini',
    temperature: 0.5,
  });
  if (!r.ok || !r.text) return null;
  return r.text.trim();
}

/** Generate, persist, and email the weekly summary. Used by cron & on-demand. */
export async function generateWeeklySummary(opts: { sendEmail?: boolean } = {}): Promise<AiSummaryResult> {
  const periodNow = periodLastWeek();
  const periodPrev = (() => {
    const from = new Date(periodNow.from.getTime() - 7 * 86400_000);
    const to = new Date(periodNow.from);
    return { from, to, label: 'Two weeks ago' };
  })();

  const [thisWk, lastWk, rev, apar, vend, cash] = await Promise.all([
    computePnl(periodNow,  'cash'),
    computePnl(periodPrev, 'cash'),
    collectRevenueLayer(periodNow.from, periodNow.to),
    collectApAr(),
    collectVendorSnapshot(periodNow.from, periodNow.to),
    collectCashSnapshot(),
  ]);

  // Inject signals into diagnostics so both narrators see them
  let anomalies: any[] = [];
  try {
    anomalies = await detectAnomalies();
    persistAnomalies().catch(() => {});
  } catch { /* */ }
  if (anomalies.length > 0) {
    const high = anomalies.filter(a => a.severity === 'HIGH');
    if (high.length > 0) {
      thisWk.diagnostics.notes.push(
        `${high.length} spend anomaly alert(s): ` +
        high.slice(0, 3).map(a => `${a.categoryLabel} (₹${(a.actualPaise / 100).toLocaleString('en-IN')}, z=${a.zScore})`).join(', '),
      );
    }
    const budget = anomalies.filter(a => a.budgetAlert === 'OVER_BUDGET' || a.budgetAlert === 'NEAR_BUDGET');
    if (budget.length > 0) {
      thisWk.diagnostics.notes.push(
        `Budget alerts: ` +
        budget.map(a => `${a.categoryLabel} at ${a.budgetPctUsed}% of ₹${((a.budgetPaise || 0) / 100).toLocaleString('en-IN')}`).join(', '),
      );
    }
  }
  if (apar.apOverduePaise > 0) {
    thisWk.diagnostics.notes.push(
      `AP overdue: ₹${(apar.apOverduePaise / 100).toLocaleString('en-IN')} past due to vendors.`
    );
  }
  if (apar.arOverdueCount > 0) {
    thisWk.diagnostics.notes.push(
      `AR overdue: ${apar.arOverdueCount} invoice(s) worth ₹${(apar.arOverduePaise / 100).toLocaleString('en-IN')} past due from customers.`
    );
  }
  if (vend.uncategorisedVendors > 0) {
    thisWk.diagnostics.notes.push(
      `${vend.uncategorisedVendors} of ${vend.vendorCount} vendors are uncategorised — tag them under Vendor Ledgers for cleaner reporting.`
    );
  }

  let narrative: string | null = null;
  let source: 'openai' | 'template' = 'template';
  try {
    narrative = await buildOpenAINarrative(thisWk, lastWk, rev, apar, vend, cash);
    if (narrative) source = 'openai';
  } catch { /* fall through */ }

  if (!narrative) narrative = buildTemplate(thisWk, lastWk, rev, apar, vend, cash);

  const cache = await prisma.financeAiSummary.upsert({
    where: {
      periodStart_periodEnd: { periodStart: periodNow.from, periodEnd: periodNow.to },
    },
    update: {
      narrative,
      headlineMetrics: {
        revenue: thisWk.revenue.total,
        netRevenue: thisWk.netRevenue,
        grossProfit: thisWk.grossProfit,
        ebitda: thisWk.ebitda,
        netProfit: thisWk.netProfit,
        orderCount: thisWk.diagnostics.orderCount,
        opexTotal: thisWk.opex.grandTotal,
        // v23.40.8 — extended metrics
        websiteRevenue:    rev.websiteRevenuePaise,
        posRevenue:        rev.posRevenuePaise,
        bulkRevenue:       rev.bulkRevenuePaise,
        commissionIncome:  rev.commissionIncomePaise,
        marketplaceGmv:    rev.marketplaceGmvPaise,
        realizedRevenue:   rev.realizedRevenuePaise,
        accruedRevenue:    rev.accruedRevenuePaise,
        gstOutput:         rev.gstOutputPaise,
        arOutstanding:     apar.arOutstandingPaise,
        arOverdue:         apar.arOverduePaise,
        apOutstanding:     apar.apTotalPaise,
        apOverdue:         apar.apOverduePaise,
        bankClosing:       cash.bankClosingPaise,
        source,
      } as any,
      generatedAt: new Date(),
    },
    create: {
      periodStart: periodNow.from,
      periodEnd:   periodNow.to,
      narrative,
      headlineMetrics: {
        revenue: thisWk.revenue.total,
        netRevenue: thisWk.netRevenue,
        grossProfit: thisWk.grossProfit,
        ebitda: thisWk.ebitda,
        netProfit: thisWk.netProfit,
        orderCount: thisWk.diagnostics.orderCount,
        opexTotal: thisWk.opex.grandTotal,
        websiteRevenue:    rev.websiteRevenuePaise,
        posRevenue:        rev.posRevenuePaise,
        bulkRevenue:       rev.bulkRevenuePaise,
        commissionIncome:  rev.commissionIncomePaise,
        marketplaceGmv:    rev.marketplaceGmvPaise,
        realizedRevenue:   rev.realizedRevenuePaise,
        accruedRevenue:    rev.accruedRevenuePaise,
        gstOutput:         rev.gstOutputPaise,
        arOutstanding:     apar.arOutstandingPaise,
        arOverdue:         apar.arOverduePaise,
        apOutstanding:     apar.apTotalPaise,
        apOverdue:         apar.apOverduePaise,
        bankClosing:       cash.bankClosingPaise,
        source,
      } as any,
    },
  });

  // Recipients
  const users = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'SUPER_ADMIN', 'FINANCE'] } },
    select: { id: true, email: true },
  });

  if (opts.sendEmail !== false) {
    try {
      const { notify } = await import('@/lib/notifications');
      for (const u of users) {
        notify({
          event: 'FINANCE_WEEKLY_SUMMARY',
          userId: u.id,
          data: {
            periodLabel: periodNow.label,
            narrative,
            revenue: formatINR(thisWk.revenue.total),
            grossProfit: formatINR(thisWk.grossProfit),
            netProfit: formatINR(thisWk.netProfit),
            orderCount: String(thisWk.diagnostics.orderCount),
          },
          context: { type: 'FINANCE_REPORT', id: cache.id },
        }).catch(() => {});
      }
    } catch { /* best-effort */ }
  }

  return {
    reportId: cache.id,
    periodLabel: periodNow.label,
    narrative,
    recipients: users.map(u => u.email),
    source,
  };
}
