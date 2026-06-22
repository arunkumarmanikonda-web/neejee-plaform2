// Finance section layout — adds a top sub-nav across all /admin/finance pages.
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { canReadFinance } from '@/lib/finance/roles';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TABS = [
  { href: '/admin/finance',                 label: 'Dashboard' },
  { href: '/admin/finance/pnl',             label: 'P&L Report' },
  { href: '/admin/finance/bills',           label: 'Bills (AP)' },
  { href: '/admin/finance/expenses',        label: 'Expenses' },
  { href: '/admin/finance/recurring',       label: 'Recurring' },
  { href: '/admin/finance/aging',           label: 'AP/AR Aging' },
  { href: '/admin/finance/anomalies',       label: 'Anomalies' },
  { href: '/admin/finance/categories',      label: 'Chart of Accounts' },
  { href: '/admin/finance/returns',         label: 'Returns' },
  { href: '/admin/finance/marketing',       label: 'Marketing' },
  { href: '/admin/finance/ai-summary',      label: 'AI Briefings' },
];

export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!canReadFinance(session)) redirect('/admin?error=no_finance_access');

  return (
    <div>
      <div className="border-b border-mitti/20 -mt-12 -mx-12 px-12 pt-12 pb-0 mb-8 bg-ivory">
        <h1 className="font-display text-4xl text-kohl">Finance</h1>
        <p className="font-italic italic text-mitti/70 text-sm mt-1">
          P&L, expenses, returns and marketing attribution
        </p>
        <nav className="flex gap-1 mt-6 -mb-px overflow-x-auto">
          {TABS.map(t => (
            <Link key={t.href} href={t.href}
              className="px-4 py-2 font-ui text-xs tracking-widest uppercase text-mitti hover:text-kohl border-b-2 border-transparent hover:border-kohl whitespace-nowrap">
              {t.label}
            </Link>
          ))}
        </nav>
      </div>
      <div>{children}</div>
    </div>
  );
}
