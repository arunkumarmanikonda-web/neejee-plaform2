// Finance overview dashboard — KPI cards + quick links.
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canReadFinance, canAdminFinance } from '@/lib/finance/roles';
import { computePnl } from '@/lib/finance/pnl';
import { periodThisMonth, periodLastMonth } from '@/lib/finance/period';
import { formatINR, formatINRShort } from '@/lib/money';
import { Receipt, FileText, BarChart3, AlertCircle, Sparkles, TrendingUp, TrendingDown, Wallet, Repeat, Activity } from 'lucide-react';
import { computeApAging } from '@/lib/finance/bills';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function safeCount(model: () => Promise<number>): Promise<number> {
  try { return await model(); } catch { return 0; }
}

export default async function FinanceDashboard() {
  const session = await getSession();
  if (!canReadFinance(session)) redirect('/admin?error=no_finance_access');

  // KPIs (graceful failure if migration missing)
  let categoryCount = 0;
  let pendingExpenses = 0;
  let overdueBillCount = 0;
  let overdueBillPaise = 0;
  let thisMonthPnl: any = null;
  let lastMonthPnl: any = null;
  let setupNeeded = false;

  try {
    categoryCount = await prisma.expenseCategory.count();
    if (categoryCount === 0) setupNeeded = true;

    pendingExpenses = await safeCount(() =>
      prisma.expense.count({ where: { status: 'PENDING' } })
    );
    try {
      const ap = await computeApAging();
      overdueBillPaise = ap.buckets.filter(b => b.bucket !== 'CURRENT').reduce((s, b) => s + b.outstandingPaise, 0);
      overdueBillCount = ap.buckets.filter(b => b.bucket !== 'CURRENT').reduce((s, b) => s + b.count, 0);
    } catch { /* migration not yet run */ }
    thisMonthPnl = await computePnl(periodThisMonth(), 'cash');
    lastMonthPnl = await computePnl(periodLastMonth(), 'cash');
  } catch {
    setupNeeded = true;
  }

  const pctChange = (curr: number, prev: number) => {
    if (!prev) return 0;
    return Math.round(((curr - prev) / Math.abs(prev)) * 100);
  };

  const revenuePct = thisMonthPnl && lastMonthPnl
    ? pctChange(thisMonthPnl.revenue.total, lastMonthPnl.revenue.total) : 0;
  const profitPct = thisMonthPnl && lastMonthPnl
    ? pctChange(thisMonthPnl.netProfit, lastMonthPnl.netProfit) : 0;

  return (
    <div className="space-y-8">
      {setupNeeded && (
        <div className="bg-banarasi/10 border border-banarasi/40 p-6 rounded">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-banarasi mt-0.5" />
            <div className="flex-1">
              <h3 className="font-display text-lg text-kohl">First-time setup</h3>
              <p className="text-mitti text-sm mt-1">
                Seed the default chart of accounts (35 categories: COGS, marketing, payment fees, payroll, taxes…) to start tracking expenses.
              </p>
              {canAdminFinance(session) && (
                <form action="/api/admin/finance/seed-categories" method="POST" className="mt-3">
                  <button type="submit" className="bg-kohl text-ivory px-5 py-2 font-ui text-xs tracking-widest">
                    SEED CHART OF ACCOUNTS
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      {thisMonthPnl && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KpiCard
            label="REVENUE (THIS MONTH)"
            value={formatINR(thisMonthPnl.revenue.total)}
            sub={`${thisMonthPnl.diagnostics.orderCount} orders`}
            trend={revenuePct}
          />
          <KpiCard
            label="GROSS PROFIT"
            value={formatINR(thisMonthPnl.grossProfit)}
            sub={thisMonthPnl.netRevenue > 0
              ? `${Math.round(thisMonthPnl.grossProfit / thisMonthPnl.netRevenue * 100)}% margin`
              : '—'}
          />
          <KpiCard
            label="OPERATING EXPENSES"
            value={formatINR(thisMonthPnl.opex.grandTotal)}
            sub="this month"
          />
          <KpiCard
            label="NET PROFIT"
            value={formatINR(thisMonthPnl.netProfit)}
            sub={`vs ${formatINRShort(lastMonthPnl?.netProfit || 0)} last month`}
            trend={profitPct}
          />
        </div>
      )}

      {/* Action queue */}
      {pendingExpenses > 0 && (
        <div className="bg-ivory border border-mitti/30 p-6 rounded">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-lg text-kohl">
                {pendingExpenses} expense{pendingExpenses === 1 ? '' : 's'} awaiting your approval
              </h3>
              <p className="text-mitti text-sm mt-1">Maker-checker queue — review pending entries.</p>
            </div>
            <Link href="/admin/finance/expenses?status=PENDING"
              className="bg-kohl text-ivory px-5 py-2 font-ui text-xs tracking-widest">
              REVIEW NOW →
            </Link>
          </div>
        </div>
      )}

      {overdueBillCount > 0 && (
        <div className="bg-madder/10 border border-madder/40 p-6 rounded">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-lg text-kohl flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-madder" />
                {overdueBillCount} overdue bill{overdueBillCount === 1 ? '' : 's'} — {formatINR(overdueBillPaise)} outstanding
              </h3>
              <p className="text-mitti text-sm mt-1">Pay these to avoid late fees and protect vendor relationships.</p>
            </div>
            <Link href="/admin/finance/bills?status=OVERDUE"
              className="bg-madder text-white px-5 py-2 font-ui text-xs tracking-widest">
              PAY NOW →
            </Link>
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <QuickLink href="/admin/finance/pnl" icon={BarChart3} title="P&L Report" desc="Cash & accrual, with drill-down" />
        <QuickLink href="/admin/finance/bills" icon={Wallet} title="Bills (AP)" desc="What we owe & when due" />
        <QuickLink href="/admin/finance/recurring" icon={Repeat} title="Recurring" desc="Templates for rent, SaaS, salaries" />
        <QuickLink href="/admin/finance/aging" icon={FileText} title="AP/AR Aging" desc="For your CA" />
        <QuickLink href="/admin/finance/anomalies" icon={Activity} title="Anomalies" desc="Unusual spend & budget alerts" />
        <QuickLink href="/admin/finance/ai-summary" icon={Sparkles} title="AI Briefings" desc="Weekly P&L narrative" />
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, trend }: { label: string; value: string; sub: string; trend?: number }) {
  return (
    <div className="bg-ivory border border-mitti/20 p-5 rounded">
      <p className="label text-banarasi text-[10px] tracking-widest">{label}</p>
      <p className="font-display text-3xl text-kohl mt-2">{value}</p>
      <div className="flex items-center gap-2 mt-1">
        <p className="text-mitti text-xs">{sub}</p>
        {trend != null && trend !== 0 && (
          <span className={`flex items-center gap-1 text-xs ${trend > 0 ? 'text-emerald-700' : 'text-madder'}`}>
            {trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
    </div>
  );
}

function QuickLink({ href, icon: Icon, title, desc }: { href: string; icon: any; title: string; desc: string }) {
  return (
    <Link href={href}
      className="block bg-ivory border border-mitti/20 p-5 rounded hover:border-kohl transition-colors">
      <Icon className="w-6 h-6 text-banarasi" />
      <h4 className="font-display text-lg text-kohl mt-3">{title}</h4>
      <p className="text-mitti text-xs mt-1">{desc}</p>
    </Link>
  );
}
