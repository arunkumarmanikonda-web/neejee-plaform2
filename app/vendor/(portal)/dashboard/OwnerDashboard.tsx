'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Loader2, ArrowRight, CheckCircle2, Circle, KeyRound, Package, IndianRupee, AlertCircle, Sparkles,
} from 'lucide-react';
import { formatINR } from '@/lib/money';

type Me = {
  vendor: { id: string; legalName: string; displayName: string | null; status: string; hasPassword: boolean; createdAt: string };
  stats: { pendingAction: number; inProgress: number; completed: number; pendingValuePaise: number; lifetimeValuePaise: number };
  outstanding: { totalPaise: number; poCount: number };
  pendingChangeRequests: number;
  profile: { completionPercent: number; checklist: Array<{ key: string; label: string; done: boolean; href: string }> };
};

export default function VendorDashboard() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [recentPos, setRecentPos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/vendor/me', { cache: 'no-store' }).then(r => r.ok ? r.json() : null),
      fetch('/api/vendor/purchase-orders', { cache: 'no-store' }).then(r => r.ok ? r.json() : null),
    ]).then(([meRes, list]) => {
      if (!meRes?.vendor) { router.push('/vendor/login'); return; }
      setMe(meRes);
      setRecentPos((list?.purchaseOrders || []).slice(0, 5));
      setLoading(false);
    });
  }, [router]);

  if (loading || !me) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-5 h-5 animate-spin text-madder" /></div>;
  }

  const completion = me.profile.completionPercent;
  const checklistDone = me.profile.checklist.filter(c => c.done).length;
  const checklistTotal = me.profile.checklist.length;
  const isNewVendor = checklistDone < checklistTotal;

  return (
    <div className="max-w-5xl mx-auto p-6 lg:p-8 space-y-6">
      {/* Hero / welcome card */}
      {isNewVendor && (
        <section className="relative overflow-hidden bg-gradient-to-br from-kohl to-mitti text-ivory p-6 lg:p-8">
          <div className="absolute top-4 right-6 text-madder">
            <Sparkles className="w-6 h-6 opacity-60" />
          </div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-haldi mb-2">Welcome to NEEJEE</p>
          <h1 className="font-display text-3xl lg:text-4xl text-ivory mb-3">
            Namaste, {me.vendor.displayName || me.vendor.legalName}.
          </h1>
          <p className="text-sm text-beige/90 max-w-xl leading-relaxed mb-5">
            We're glad to have you on the NEEJEE roster. This portal is where you'll receive purchase orders,
            confirm dispatch, upload invoices, and manage your business profile with us.
          </p>
          <p className="text-xs italic text-haldi/90 mb-5">
            — Nidhi Chauhan, Founder
          </p>
          <div className="flex flex-wrap gap-2">
            {!me.vendor.hasPassword && (
              <Link href="/vendor/account/set-password" className="inline-flex items-center gap-2 bg-ivory text-kohl px-4 py-2 text-xs uppercase tracking-widest hover:bg-haldi">
                <KeyRound className="w-3 h-3" /> Set a password
              </Link>
            )}
            {completion < 100 && (
              <Link href="/vendor/profile" className="inline-flex items-center gap-2 bg-madder text-ivory px-4 py-2 text-xs uppercase tracking-widest hover:bg-madder/90">
                Complete profile <ArrowRight className="w-3 h-3" />
              </Link>
            )}
          </div>
        </section>
      )}

      {/* Profile completion bar */}
      <section className="bg-ivory border border-mitti/15 p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-display text-lg text-kohl">Profile completion</h2>
            <p className="text-xs text-mitti">{checklistDone} of {checklistTotal} steps complete · {completion}%</p>
          </div>
          {me.pendingChangeRequests > 0 && (
            <Link href="/vendor/change-requests" className="text-[10px] uppercase tracking-widest bg-haldi/20 text-mitti px-2 py-1 hover:text-madder">
              {me.pendingChangeRequests} change{me.pendingChangeRequests > 1 ? 's' : ''} under review
            </Link>
          )}
        </div>
        <div className="w-full h-2 bg-beige rounded-full overflow-hidden mb-4">
          <div className="h-full bg-madder transition-all" style={{ width: `${completion}%` }} />
        </div>
        <ul className="space-y-2">
          {me.profile.checklist.map(c => (
            <li key={c.key}>
              <Link href={c.href} className="flex items-center gap-2 text-sm hover:text-madder">
                {c.done
                  ? <CheckCircle2 className="w-4 h-4 text-green-700 shrink-0" />
                  : <Circle className="w-4 h-4 text-mitti shrink-0" />}
                <span className={c.done ? 'text-mitti line-through' : 'text-kohl'}>{c.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Outstanding balance — only if there's anything outstanding */}
      {me.outstanding && me.outstanding.totalPaise > 0 && (
        <section className="bg-madder/5 border border-madder/30 p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-madder mb-1">Outstanding to you</p>
            <p className="font-display text-3xl text-kohl">{formatINR(me.outstanding.totalPaise)}</p>
            <p className="text-xs text-mitti mt-1">
              Across {me.outstanding.poCount} purchase order{me.outstanding.poCount > 1 ? 's' : ''} ·
              NEEJEE typically settles within {me.vendor && (me as any).vendor?.paymentTermsDays
                ? `${(me as any).vendor.paymentTermsDays} days`
                : '30 days'} of receipt.
            </p>
          </div>
          <Link href="/vendor/payouts" className="text-xs uppercase tracking-widest text-madder hover:underline">
            View payouts →
          </Link>
        </section>
      )}

      {/* Stats grid */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={<AlertCircle className="w-5 h-5 text-madder" />}
          label="Awaiting your action"
          value={me.stats.pendingAction.toString()}
          sub={me.stats.pendingValuePaise > 0 ? formatINR(me.stats.pendingValuePaise) : '—'}
        />
        <StatCard
          icon={<Package className="w-5 h-5 text-mitti" />}
          label="In progress"
          value={me.stats.inProgress.toString()}
          sub="Confirmed / dispatched"
        />
        <StatCard
          icon={<CheckCircle2 className="w-5 h-5 text-green-700" />}
          label="Completed POs"
          value={me.stats.completed.toString()}
          sub="Received & closed"
        />
        <StatCard
          icon={<IndianRupee className="w-5 h-5 text-haldi" />}
          label="Lifetime value"
          value={formatINR(me.stats.lifetimeValuePaise)}
          sub="Sum of all POs"
        />
      </section>

      {/* Recent POs */}
      <section className="bg-ivory border border-mitti/15">
        <div className="flex items-center justify-between px-5 py-4 border-b border-mitti/15">
          <h2 className="font-display text-lg text-kohl">Recent purchase orders</h2>
          <Link href="/vendor/purchase-orders" className="text-[10px] uppercase tracking-widest text-madder hover:underline">
            View all →
          </Link>
        </div>
        {recentPos.length === 0 ? (
          <EmptyState
            icon={<Package className="w-10 h-10 text-mitti/40" />}
            title="No purchase orders yet"
            description="When the NEEJEE team raises a PO with you, it'll appear here. You'll get an email + sidebar notification too."
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-beige text-[10px] uppercase tracking-widest text-mitti">
              <tr>
                <th className="text-left p-3">PO #</th>
                <th className="text-left p-3">Status</th>
                <th className="text-right p-3">Total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {recentPos.map((p: any) => (
                <tr key={p.id} className="border-t border-mitti/10 hover:bg-beige/40">
                  <td className="p-3 font-mono">{p.poNumber}</td>
                  <td className="p-3 text-xs">{p.status}</td>
                  <td className="p-3 text-right font-mono">{formatINR(p.totalPaise)}</td>
                  <td className="p-3 text-right">
                    <Link href={`/vendor/purchase-orders/${p.id}`} className="text-xs uppercase tracking-widest text-madder hover:underline">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-ivory border border-mitti/15 p-4">
      <div className="flex items-center gap-2 mb-2">{icon}<span className="text-[10px] uppercase tracking-widest text-mitti">{label}</span></div>
      <p className="font-display text-2xl text-kohl leading-tight">{value}</p>
      {sub && <p className="text-[11px] text-mitti mt-1">{sub}</p>}
    </div>
  );
}

function EmptyState({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="p-10 flex flex-col items-center justify-center text-center">
      <div className="mb-4">{icon}</div>
      <p className="font-display text-lg text-kohl mb-1">{title}</p>
      <p className="text-xs text-mitti max-w-sm">{description}</p>
    </div>
  );
}
