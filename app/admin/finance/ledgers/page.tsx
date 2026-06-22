// v23.40.21 — Ledgers Hub: single index for all financial ledgers.
// Provides one navigation hub linking to every ledger surface across the app.
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { canReadFinance } from '@/lib/finance/roles';
import { prisma } from '@/lib/prisma';
import { formatINRShort } from '@/lib/money';
import {
  BookOpen, FileText, TrendingUp, Users, Building2, Banknote, Wallet,
  ArrowRight, BarChart3, Receipt, Scale,
} from 'lucide-react';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); } catch { return fallback; }
}

export default async function LedgersHub() {
  const session = await getSession();
  if (!canReadFinance(session)) redirect('/admin?error=no_finance_access');

  // Aggregate counts / open balances for each ledger card
  const [
    bankAccountsCount,
    vendorCount,
    customerCount,
    journalLineCount,
    unpaidBillsAgg,
    openSalesInvoicesAgg,
  ] = await Promise.all([
    safe(() => prisma.bankAccount.count({ where: { active: true } }), 0),
    safe(() => prisma.vendor.count(), 0),
    safe(() => prisma.customer.count(), 0),
    safe(() => prisma.bankTransaction.count(), 0),
    safe(async () => {
      // Bill uses BillStatus enum: OPEN | OVERDUE | PARTIALLY_PAID indicate "open" balances
      const rows = await prisma.bill.findMany({
        where: { status: { in: ['OPEN', 'OVERDUE', 'PARTIALLY_PAID'] } },
        select: { totalPaise: true, paidPaise: true },
      });
      return {
        count: rows.length,
        outstanding: rows.reduce((s, r) => s + Math.max(0, (r.totalPaise || 0) - (r.paidPaise || 0)), 0),
      };
    }, { count: 0, outstanding: 0 }),
    safe(async () => {
      // SalesInvoice paymentStatus is a String column with values 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED' | 'VOID'
      const rows = await prisma.salesInvoice.findMany({
        where: { paymentStatus: { in: ['UNPAID', 'PARTIALLY_PAID'] } },
        select: { totalPaise: true, paidPaise: true },
      });
      return {
        count: rows.length,
        outstanding: rows.reduce((s, r) => s + Math.max(0, (r.totalPaise || 0) - (r.paidPaise || 0)), 0),
      };
    }, { count: 0, outstanding: 0 }),
  ]);

  const cards: Array<{
    title: string;
    href: string;
    icon: any;
    desc: string;
    chip?: string;
    chipKind?: 'good' | 'warn' | 'info';
  }> = [
    {
      title: 'General Ledger',
      href: '/admin/finance/ledger',
      icon: BookOpen,
      desc: 'Unified journal of every bill, expense, payment, and bank transaction with running balance.',
      chip: `${journalLineCount.toLocaleString('en-IN')} entries`,
      chipKind: 'info',
    },
    {
      title: 'Trial Balance',
      href: '/admin/finance/trial-balance',
      icon: Scale,
      desc: 'Debits / credits per account, counterparty, and bank account. Verifies books balance.',
      chipKind: 'info',
    },
    {
      title: 'Revenue Ledger',
      href: '/admin/finance/revenue-ledger',
      icon: TrendingUp,
      desc: 'Sales invoices, customer payments, refunds — credit side of P&L.',
      chip: `${openSalesInvoicesAgg.count} open · ${formatINRShort(openSalesInvoicesAgg.outstanding)}`,
      chipKind: 'warn',
    },
    {
      title: 'Customer Ledgers (AR)',
      href: '/admin/finance/customer-ledger',
      icon: Users,
      desc: 'Per-customer outstanding, payment history, statements. Use for B2B reconciliation.',
      chip: `${customerCount} customers`,
      chipKind: 'info',
    },
    {
      title: 'Vendor Ledgers (AP)',
      href: '/admin/finance/vendor-ledger',
      icon: Building2,
      desc: 'Per-vendor open bills, payments, advances. Use for supplier reconciliation.',
      chip: `${unpaidBillsAgg.count} open · ${formatINRShort(unpaidBillsAgg.outstanding)}`,
      chipKind: 'warn',
    },
    {
      title: 'Cash / Bank Ledger',
      href: '/admin/finance/cash-bank-ledger',
      icon: Banknote,
      desc: 'Running balance per bank account: every credit, debit, and reconciliation status.',
      chip: `${bankAccountsCount} accounts`,
      chipKind: 'good',
    },
    {
      title: 'AP / AR Aging',
      href: '/admin/finance/aging',
      icon: BarChart3,
      desc: 'Aged-bucket view: 0-30, 31-60, 61-90, 90+ days for both receivables and payables.',
      chipKind: 'info',
    },
    {
      title: 'Bank Reconciliation',
      href: '/admin/finance/bank-reconciliation',
      icon: Receipt,
      desc: 'Match bank statement rows against bills, expenses, and invoices.',
      chipKind: 'info',
    },
  ];

  const chipColor = (kind?: string) =>
    kind === 'good' ? 'bg-neem/15 text-neem'
      : kind === 'warn' ? 'bg-haldi/20 text-mitti'
      : 'bg-mitti/10 text-mitti';

  return (
    <>
      <div className="flex justify-between items-start flex-wrap gap-4">
        <div>
          <p className="label text-madder">FINANCE</p>
          <h1 className="font-display text-4xl text-kohl mt-2">Ledgers</h1>
          <p className="font-italic italic text-mitti mt-2 max-w-xl">
            One hub for every double-entry view in NEEJEE — from a single journal entry up to
            the trial balance that closes the books.
          </p>
        </div>
      </div>
      <div className="madder-divider mt-4"></div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 mt-8">
        {cards.map(card => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={card.href}
              className="group bg-beige border border-mitti/15 hover:border-madder/40 hover:shadow-sm p-5 transition-all flex flex-col"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="w-10 h-10 bg-ivory border border-mitti/20 flex items-center justify-center text-madder">
                  <Icon className="w-5 h-5" />
                </div>
                {card.chip && (
                  <span className={`text-[10px] tracking-wider uppercase px-2 py-1 ${chipColor(card.chipKind)}`}>
                    {card.chip}
                  </span>
                )}
              </div>
              <h2 className="font-display text-xl text-kohl mt-4">{card.title}</h2>
              <p className="font-ui text-xs text-mitti mt-2 leading-relaxed flex-1">{card.desc}</p>
              <p className="text-[11px] tracking-wider text-madder mt-4 inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                OPEN <ArrowRight className="w-3 h-3" />
              </p>
            </Link>
          );
        })}
      </div>

      <div className="mt-12 bg-beige border-l-4 border-madder p-5">
        <p className="label text-madder mb-2">QUICK REFERENCE</p>
        <ul className="font-ui text-sm text-kohl space-y-1.5">
          <li><strong>General Ledger</strong> — chronological record of all journal lines</li>
          <li><strong>Trial Balance</strong> — totals per account; debits must equal credits</li>
          <li><strong>Revenue Ledger</strong> — sales-side flow (customer invoices &amp; collections)</li>
          <li><strong>Customer / Vendor Ledgers</strong> — counterparty-wise sub-ledgers</li>
          <li><strong>Cash / Bank Ledger</strong> — running balance per actual bank account</li>
        </ul>
      </div>
    </>
  );
}
