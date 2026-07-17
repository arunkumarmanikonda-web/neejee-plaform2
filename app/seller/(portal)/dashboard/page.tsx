'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatINR, formatINRShort } from '@/lib/money';
import {
  Package, Sparkles, ArrowRight, CheckCircle2, Circle, ShoppingBag,
  Wallet, TrendingUp, Upload, KeyRound, AlertCircle,
} from 'lucide-react';

type Me = {
  seller: any;
  ctx: { isOwner: boolean; isStaff: boolean; accessLevel: string };
  stats: {
    completion: number;
    checklist: { key: string; label: string; done: boolean; href: string }[];
    productBuckets: { active: number; draft: number; pendingQc: number; archived: number };
    submissionBuckets: { pending: number; underReview: number; needsInfo: number; published: number };
    pendingChangeRequestsCount: number;
    lifetimeRevenuePaise: number;
    lifetimeOrderCount: number;
    lifetimePayoutPaise: number;
  };
};

export default function SellerDashboard() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/seller/me');
        const t = await r.text();
        let j: any = {}; try { j = JSON.parse(t); } catch {}
        if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
        setMe(j);
      } catch (e: any) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="text-mitti py-20 text-center font-italic italic">Loading your studio…</div>;
  if (err) return <div className="bg-madder/10 border border-madder p-6 text-madder">{err}</div>;
  if (!me) return null;

  const { seller, ctx, stats } = me;
  const greeting = ctx.isOwner ? seller.contactName || seller.businessName : 'Welcome back';

  return (
    <div className="space-y-8 max-w-7xl">
      {/* Hero */}
      <section className="bg-kohl text-ivory p-8 rounded-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-madder/10 rounded-full -translate-y-32 translate-x-32" />
        <div className="relative">
          <p className="label text-banarasi">YOUR STUDIO</p>
          <h1 className="font-display text-4xl mt-2">Namaste, {greeting}</h1>
          <p className="font-italic italic text-beige/80 mt-2 max-w-xl">
            {ctx.isStaff
              ? `You're signed in as ${ctx.accessLevel.replace('_', ' ').toLowerCase()} for ${seller.businessName}.`
              : `Welcome to your craft studio on NEEJEE. Here's how things look today.`}
          </p>

          {!seller.hasPassword && ctx.isOwner && (
            <Link href="/seller/account"
              className="mt-5 inline-flex items-center gap-2 bg-ivory text-kohl px-5 py-2 font-ui text-xs tracking-widest hover:bg-beige transition-colors">
              <KeyRound className="w-3 h-3" /> SET A PASSWORD
            </Link>
          )}
        </div>
      </section>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          icon={Package}
          label="ACTIVE PRODUCTS"
          value={String(stats.productBuckets.active)}
          sub={`${stats.productBuckets.draft} drafts`}
          href="/seller/inventory"
        />
        <StatCard
          icon={ShoppingBag}
          label="ORDERS (LIFETIME)"
          value={String(stats.lifetimeOrderCount)}
          sub={formatINRShort(stats.lifetimeRevenuePaise) + ' revenue'}
          href="/seller/orders"
        />
        <StatCard
          icon={Wallet}
          label="PAYOUTS RECEIVED"
          value={formatINRShort(stats.lifetimePayoutPaise)}
          sub="lifetime"
          href="/seller/payouts"
        />
        <StatCard
          icon={TrendingUp}
          label="QUALITY SCORE"
          value={seller.qualityScore ? seller.qualityScore.toFixed(1) : '—'}
          sub={seller.isNeejeeSelect ? 'NEEJEE Select' : 'Standard tier'}
        />
      </div>

      {/* Pending things needing your attention */}
      {(stats.submissionBuckets.needsInfo > 0 || stats.pendingChangeRequestsCount > 0) && (
        <section className="bg-banarasi/10 border border-banarasi/40 p-6 rounded">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-banarasi mt-0.5" />
            <div className="flex-1">
              <h3 className="font-display text-lg text-kohl">A few things need you</h3>
              <div className="mt-2 space-y-1 text-sm text-mitti">
                {stats.submissionBuckets.needsInfo > 0 && (
                  <p>
                    <Link href="/seller/inventory?status=NEEDS_INFO" className="text-banarasi hover:underline font-medium">
                      {stats.submissionBuckets.needsInfo} inventory submission{stats.submissionBuckets.needsInfo === 1 ? '' : 's'} need more information
                    </Link>
                  </p>
                )}
                {stats.pendingChangeRequestsCount > 0 && (
                  <p>
                    <Link href="/seller/change-requests" className="text-banarasi hover:underline font-medium">
                      {stats.pendingChangeRequestsCount} change request{stats.pendingChangeRequestsCount === 1 ? '' : 's'} under review
                    </Link>
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Profile checklist */}
      {stats.completion < 100 && ctx.isOwner && (
        <section className="bg-ivory border border-mitti/30 p-6 rounded">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-xl text-kohl">Complete your studio profile</h3>
            <span className="font-display text-3xl text-banarasi">{stats.completion}%</span>
          </div>
          <div className="bg-beige h-2 rounded-full overflow-hidden mb-5">
            <div className="bg-banarasi h-full transition-all" style={{ width: `${stats.completion}%` }} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {stats.checklist.map(item => (
              <Link key={item.key} href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors ${
                  item.done ? 'text-mitti/40' : 'text-mitti hover:bg-beige'
                }`}>
                {item.done
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  : <Circle className="w-4 h-4 flex-shrink-0" />}
                <span className={item.done ? 'line-through' : ''}>{item.label}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Inventory CTA */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Link href="/seller/inventory/submit"
          className="block bg-ivory border border-mitti/30 p-6 rounded hover:border-kohl transition-colors">
          <Upload className="w-6 h-6 text-banarasi" />
          <h4 className="font-display text-lg text-kohl mt-3">Submit a new product</h4>
          <p className="text-mitti text-xs mt-1">One at a time or Excel bulk upload</p>
        </Link>
        <Link href="/seller/inventory"
          className="block bg-ivory border border-mitti/30 p-6 rounded hover:border-kohl transition-colors">
          <Package className="w-6 h-6 text-banarasi" />
          <h4 className="font-display text-lg text-kohl mt-3">Manage inventory</h4>
          <p className="text-mitti text-xs mt-1">
            {stats.submissionBuckets.pending + stats.submissionBuckets.underReview} under review
          </p>
        </Link>
        <Link href="/seller/orders"
          className="block bg-ivory border border-mitti/30 p-6 rounded hover:border-kohl transition-colors">
          <ShoppingBag className="w-6 h-6 text-banarasi" />
          <h4 className="font-display text-lg text-kohl mt-3">Orders & sales</h4>
          <p className="text-mitti text-xs mt-1">Pack & dispatch when released</p>
        </Link>
        <Link href="/seller/agreements"
          className="block bg-ivory border border-mitti/30 p-6 rounded hover:border-kohl transition-colors">
          <Sparkles className="w-6 h-6 text-banarasi" />
          <h4 className="font-display text-lg text-kohl mt-3">Legal agreements</h4>
          <p className="text-mitti text-xs mt-1">Review drafts, add observations, sign with OTP</p>
        </Link>
      </section>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, href }: { icon: any; label: string; value: string; sub: string; href?: string }) {
  const inner = (
    <div className="bg-ivory border border-mitti/20 p-5 rounded h-full">
      <div className="flex items-center justify-between">
        <Icon className="w-5 h-5 text-banarasi" />
        {href && <ArrowRight className="w-4 h-4 text-mitti/40" />}
      </div>
      <p className="label text-banarasi text-[10px] tracking-widest mt-3">{label}</p>
      <p className="font-display text-3xl text-kohl mt-1">{value}</p>
      <p className="text-mitti text-xs mt-1">{sub}</p>
    </div>
  );
  return href ? <Link href={href} className="block">{inner}</Link> : inner;
}
