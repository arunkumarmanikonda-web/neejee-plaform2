'use client';
import { useEffect, useState } from 'react';
import { Sparkles, Users, TrendingUp, Gift, Settings, Save, AlertCircle, X, Search } from 'lucide-react';
import { formatINR } from '@/lib/money';

export const dynamic = 'force-dynamic';

const TIER_NAMES: Record<string, { label: string; description: string; color: string }> = {
  FOUND: { label: 'Found', description: "You've started a trunk with us.", color: 'bg-mitti/20 text-mitti' },
  KNOWN: { label: 'Known', description: 'We know you now.', color: 'bg-banarasi/30 text-kohl' },
  PERSONAL: { label: 'Personal', description: "You're someone we know by name.", color: 'bg-madder/20 text-madder' },
  FAMILY: { label: 'Family', description: 'Of the household.', color: 'bg-kohl text-ivory' },
};

interface LoyaltyData {
  tiers: any[];
  kpis: any;
  referrals: any[];
  recentActivity: any[];
  settings: any;
}

export default function AdminLoyalty() {
  const [data, setData] = useState<LoyaltyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [tierFilter, setTierFilter] = useState<string | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [awardingMember, setAwardingMember] = useState<any>(null);

  const load = () => {
    setLoading(true);
    fetch('/api/admin/loyalty', { credentials: 'include', cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (!d.error) setData(d); })
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  // Load members whenever tier filter or search changes
  useEffect(() => {
    if (tierFilter === null) { setMembers([]); return; }
    setMembersLoading(true);
    const qs = new URLSearchParams();
    if (tierFilter && tierFilter !== 'ALL') qs.set('tier', tierFilter);
    if (search) qs.set('q', search);
    fetch(`/api/admin/loyalty/members?${qs.toString()}`, { credentials: 'include', cache: 'no-store' })
      .then(r => r.json())
      .then(d => setMembers(d.members || []))
      .finally(() => setMembersLoading(false));
  }, [tierFilter, search]);

  if (loading) return <p className="p-12 text-center font-italic italic text-mitti">Counting trunks...</p>;
  if (!data) return <p className="p-12 bg-haldi/20 text-haldi">Could not load loyalty data.</p>;
  const needsMigration = (data as any).needsMigration;

  const referralMap = Object.fromEntries(data.referrals.map((r: any) => [r.status, r._count._all]));

  return (
    <div className="space-y-8 p-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="label text-madder">FOUND. PERSONAL.</p>
          <h1 className="font-display text-4xl text-kohl">Loyalty Program</h1>
          <p className="font-italic italic text-mitti mt-1">Found · Known · Personal · Family.</p>
        </div>
        <button
          onClick={() => setShowSettings(s => !s)}
          className="btn-outline flex items-center gap-2"
        >
          <Settings className="w-4 h-4" /> {showSettings ? 'HIDE SETTINGS' : 'SETTINGS'}
        </button>
      </div>

      {needsMigration && (
        <div className="bg-haldi/20 border border-haldi/40 p-4">
          <p className="font-display text-kohl">Loyalty database migration not yet applied.</p>
          <p className="font-italic italic text-mitti text-sm mt-1">
            Run the SQL in <code>prisma/migrations/sprint8a_loyalty/migration.sql</code> at the Supabase SQL Editor to populate live data.
          </p>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <button onClick={() => setTierFilter('ALL')} className="text-left">
          <Kpi label="ACTIVE MEMBERS" value={data.kpis.activeMembers.toLocaleString('en-IN')} icon={<Users className="w-4 h-4" />} accent clickable />
        </button>
        <Kpi label="POINTS ISSUED" value={data.kpis.pointsIssued.toLocaleString('en-IN')} icon={<Sparkles className="w-4 h-4" />} />
        <Kpi label="POINTS REDEEMED" value={data.kpis.pointsRedeemed.toLocaleString('en-IN')} icon={<TrendingUp className="w-4 h-4" />} hint={`${data.kpis.redemptionRate}% rate`} />
        <Kpi label="OUTSTANDING" value={data.kpis.pointsOutstanding.toLocaleString('en-IN')} icon={<AlertCircle className="w-4 h-4" />} hint="Liability" />
      </div>

      {/* Tier breakdown — click any tile to filter the members table */}
      <section>
        <div className="flex items-end justify-between mb-3">
          <p className="label text-madder">TIER BREAKDOWN · CLICK TO FILTER MEMBERS</p>
          {tierFilter && (
            <button onClick={() => { setTierFilter(null); setSearch(''); }} className="text-xs tracking-widest text-mitti hover:text-kohl">CLEAR ✕</button>
          )}
        </div>
        <div className="grid md:grid-cols-4 gap-3">
          {['FOUND', 'KNOWN', 'PERSONAL', 'FAMILY'].map(tier => {
            const row = data.tiers.find(t => t.loyaltyTier === tier);
            const count = row?._count?._all || 0;
            const lifetimeSpend = row?._sum?.lifetimeSpend || 0;
            const points = row?._sum?.loyaltyPoints || 0;
            const isActive = tierFilter === tier;
            return (
              <button
                key={tier}
                onClick={() => setTierFilter(isActive ? null : tier)}
                className={`bg-beige p-5 text-left transition-all hover:bg-beige/80 ${isActive ? 'ring-2 ring-madder' : ''}`}
              >
                <span className={`text-xs px-2 py-1 tracking-widest ${TIER_NAMES[tier].color}`}>{TIER_NAMES[tier].label.toUpperCase()}</span>
                <p className="font-display text-3xl text-kohl mt-3">{count}</p>
                <p className="font-italic italic text-mitti text-xs mt-1">{TIER_NAMES[tier].description}</p>
                <div className="mt-3 pt-3 border-t border-mitti/20 text-xs text-mitti space-y-1">
                  <p>Total spend: {formatINR(lifetimeSpend)}</p>
                  <p>Points held: {points.toLocaleString('en-IN')}</p>
                </div>
                <p className="text-[10px] tracking-widest text-madder mt-3">{isActive ? '◆ VIEWING' : 'VIEW MEMBERS →'}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Members table (visible when a tier is selected) */}
      {tierFilter !== null && (
        <section>
          <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
            <p className="label text-madder">
              {tierFilter === 'ALL' ? 'ALL MEMBERS' : `${TIER_NAMES[tierFilter]?.label?.toUpperCase()} TIER MEMBERS`}
              <span className="ml-2 text-mitti">({members.length})</span>
            </p>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-mitti" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, email, phone, code"
                className="pl-10 pr-3 py-2 bg-beige border border-mitti/20 text-sm w-72"
              />
            </div>
          </div>
          <div className="bg-beige overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-kohl text-ivory">
                <tr className="text-left text-xs label">
                  <th className="p-3">NAME</th>
                  <th className="p-3">EMAIL</th>
                  <th className="p-3">TIER</th>
                  <th className="p-3 text-right">POINTS</th>
                  <th className="p-3 text-right">LIFETIME</th>
                  <th className="p-3">REFERRAL</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {membersLoading ? (
                  <tr><td colSpan={7} className="p-12 text-center font-italic italic text-mitti">Loading...</td></tr>
                ) : members.length === 0 ? (
                  <tr><td colSpan={7} className="p-12 text-center font-italic italic text-mitti">No members in this segment yet.</td></tr>
                ) : members.map((m) => (
                  <tr key={m.id} className="border-b border-mitti/10 hover:bg-ivory/50">
                    <td className="p-3 font-ui text-kohl">{m.name || <span className="italic text-mitti">no name</span>}</td>
                    <td className="p-3 text-xs text-mitti">{m.email}</td>
                    <td className="p-3">
                      <span className={`text-[10px] px-2 py-0.5 tracking-widest ${TIER_NAMES[m.loyaltyTier]?.color}`}>{TIER_NAMES[m.loyaltyTier]?.label?.toUpperCase()}</span>
                    </td>
                    <td className="p-3 text-right font-ui">{m.loyaltyPoints.toLocaleString('en-IN')}</td>
                    <td className="p-3 text-right text-xs text-mitti">{formatINR(m.lifetimeSpend)}</td>
                    <td className="p-3 text-[10px] font-mono text-mitti">{m.referralCode || '—'}</td>
                    <td className="p-3 text-right">
                      <button onClick={() => setAwardingMember(m)} className="text-xs tracking-widest text-madder hover:text-kohl flex items-center gap-1">
                        <Gift className="w-3 h-3" /> AWARD
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Referrals */}
      <section>
        <p className="label text-madder mb-3">REFERRALS</p>
        <div className="grid grid-cols-4 gap-3">
          <Kpi label="TOTAL" value={(Object.values(referralMap) as number[]).reduce((s, v) => s + v, 0).toString()} icon={<Gift className="w-4 h-4" />} />
          <Kpi label="PENDING" value={(referralMap.PENDING || 0).toString()} />
          <Kpi label="REWARDED" value={(referralMap.REWARDED || 0).toString()} accent />
          <Kpi label="EXPIRED" value={(referralMap.EXPIRED || 0).toString()} />
        </div>
      </section>

      {/* Recent activity */}
      <section>
        <p className="label text-madder mb-3">RECENT POINT ACTIVITY</p>
        <div className="bg-beige overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-kohl text-ivory">
              <tr className="text-left text-xs label">
                <th className="p-3">CUSTOMER</th>
                <th className="p-3">TIER</th>
                <th className="p-3">TYPE</th>
                <th className="p-3 text-right">POINTS</th>
                <th className="p-3">REASON</th>
                <th className="p-3">WHEN</th>
              </tr>
            </thead>
            <tbody>
              {data.recentActivity.length === 0 ? (
                <tr><td colSpan={6} className="p-12 text-center font-italic italic text-mitti">No activity yet.</td></tr>
              ) : data.recentActivity.map((a: any) => (
                <tr key={a.id} className="border-b border-mitti/10">
                  <td className="p-3 font-ui text-kohl">{a.userName}</td>
                  <td className="p-3">
                    <span className={`text-[10px] px-2 py-0.5 tracking-widest ${TIER_NAMES[a.tier]?.color || ''}`}>{TIER_NAMES[a.tier]?.label?.toUpperCase()}</span>
                  </td>
                  <td className="p-3 text-xs">{a.type}</td>
                  <td className="p-3 text-right font-ui text-kohl">+{a.points.toLocaleString('en-IN')}</td>
                  <td className="p-3 text-xs text-mitti">{a.reason || '—'}</td>
                  <td className="p-3 text-xs text-mitti">{new Date(a.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {showSettings && <SettingsPanel initial={data.settings} onSaved={load} />}

      {awardingMember && (
        <AwardModal
          member={awardingMember}
          onClose={() => setAwardingMember(null)}
          onSaved={() => { setAwardingMember(null); load(); /* refresh members list */ setTierFilter(tierFilter); }}
        />
      )}
    </div>
  );
}

function AwardModal({ member, onClose, onSaved }: { member: any; onClose: () => void; onSaved: () => void }) {
  const [points, setPoints] = useState(100);
  const [reason, setReason] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);

  const save = async () => {
    if (!reason.trim()) { setErr('Reason is required (audit trail)'); return; }
    if (points === 0) { setErr('Points cannot be zero'); return; }
    setSaving(true); setErr('');
    try {
      const res = await fetch('/api/admin/loyalty/adjust', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: member.id, points, reason, sendEmail }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setDone(true);
      setTimeout(() => { onSaved(); }, 1200);
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-kohl/50 z-50 flex items-center justify-center p-4">
      <div className="bg-ivory max-w-md w-full p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-madder" />
            <h2 className="font-display text-2xl text-kohl">Award Points</h2>
          </div>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>

        {done ? (
          <div className="py-8 text-center">
            <div className="w-16 h-16 bg-neem/20 text-neem rounded-full mx-auto flex items-center justify-center mb-4">✓</div>
            <p className="font-display text-xl text-kohl">Points awarded.</p>
            <p className="font-italic italic text-mitti text-sm mt-2">{points > 0 ? '+' : ''}{points} points to {member.name || member.email}.</p>
          </div>
        ) : (
          <>
            <div className="bg-beige p-4 mb-4">
              <p className="text-xs tracking-widest text-mitti">RECIPIENT</p>
              <p className="font-display text-lg text-kohl">{member.name || 'No name'}</p>
              <p className="text-xs text-mitti">{member.email}</p>
              <p className="text-xs text-mitti mt-1">Currently: <strong>{member.loyaltyPoints.toLocaleString('en-IN')} points</strong> · {member.loyaltyTier}</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="label text-mitti">POINTS TO AWARD (negative to deduct)</label>
                <input
                  type="number"
                  value={points}
                  onChange={(e) => setPoints(parseInt(e.target.value) || 0)}
                  className="w-full mt-1 p-3 bg-beige border border-mitti/20"
                />
                <p className="text-[10px] text-mitti mt-1">e.g. 100 to credit, -50 to debit. Manual adjustments don’t expire.</p>
              </div>
              <div>
                <label className="label text-mitti">REASON (audit trail — required)</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  placeholder="e.g. Goodwill gesture for delayed shipping on order NEE-12345"
                  className="w-full mt-1 p-3 bg-beige border border-mitti/20 text-sm"
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />
                <span>Send a warm email to {member.email?.split('@')[0]}</span>
              </label>
              {err && <p className="text-madder text-sm">{err}</p>}
              <div className="flex gap-2 pt-2">
                <button onClick={onClose} className="btn-outline flex-1">CANCEL</button>
                <button onClick={save} disabled={saving} className="btn-primary flex-1">
                  {saving ? 'AWARDING...' : 'AWARD POINTS'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, icon, hint, accent, clickable }: { label: string; value: string; icon?: any; hint?: string; accent?: boolean; clickable?: boolean }) {
  return (
    <div className={`p-5 transition-all ${accent ? 'bg-kohl text-ivory' : 'bg-beige text-kohl'} ${clickable ? 'hover:opacity-90 cursor-pointer' : ''}`}>
      <div className="flex items-center justify-between">
        <p className={`label ${accent ? 'text-banarasi' : 'text-mitti'}`}>{label}</p>
        {icon && <span className={accent ? 'text-banarasi' : 'text-madder'}>{icon}</span>}
      </div>
      <p className="font-display text-3xl mt-2">{value}</p>
      {hint && <p className={`text-xs mt-1 ${accent ? 'text-ivory/60' : 'text-mitti'}`}>{hint}</p>}
    </div>
  );
}

function SettingsPanel({ initial, onSaved }: { initial: any; onSaved: () => void }) {
  const [form, setForm] = useState({
    paisePerPoint: initial.paisePerPoint,
    redemptionValue: initial.redemptionValue,
    minRedemption: initial.minRedemption,
    maxRedemptionPct: initial.maxRedemptionPct,
    multiplierFound: initial.multiplierFound,
    multiplierKnown: initial.multiplierKnown,
    multiplierPersonal: initial.multiplierPersonal,
    multiplierFamily: initial.multiplierFamily,
    thresholdKnown: initial.thresholdKnown,
    thresholdPersonal: initial.thresholdPersonal,
    thresholdFamily: initial.thresholdFamily,
    referralRewardPoints: initial.referralRewardPoints,
    refereeDiscountPct: initial.refereeDiscountPct,
    refereeMinOrder: initial.refereeMinOrder,
    pointsExpireMonths: initial.pointsExpireMonths,
    familyNeverExpire: initial.familyNeverExpire,
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const save = async () => {
    setSaving(true); setMsg('');
    try {
      const res = await fetch('/api/admin/loyalty', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setMsg('Saved.');
      onSaved();
    } catch (e: any) { setMsg(e.message); }
    finally { setSaving(false); }
  };

  return (
    <section className="bg-beige p-6 space-y-6">
      <div>
        <p className="font-display text-2xl text-kohl">Settings</p>
        <p className="font-italic italic text-mitti text-sm mt-1">Tune the program. Changes apply to future orders only.</p>
      </div>

      <div>
        <p className="label text-madder mb-3">EARN RATES</p>
        <div className="grid md:grid-cols-2 gap-3">
          <NumberField label="Paise per point (10000 = ₹100 per point)" value={form.paisePerPoint} onChange={v => setForm({ ...form, paisePerPoint: v })} />
          <NumberField label="Points expire (months, 0 = never)" value={form.pointsExpireMonths} onChange={v => setForm({ ...form, pointsExpireMonths: v })} />
        </div>
      </div>

      <div>
        <p className="label text-madder mb-3">TIER MULTIPLIERS</p>
        <div className="grid md:grid-cols-4 gap-3">
          <NumberField label="Found ×" value={form.multiplierFound} onChange={v => setForm({ ...form, multiplierFound: v })} step={0.1} />
          <NumberField label="Known ×" value={form.multiplierKnown} onChange={v => setForm({ ...form, multiplierKnown: v })} step={0.1} />
          <NumberField label="Personal ×" value={form.multiplierPersonal} onChange={v => setForm({ ...form, multiplierPersonal: v })} step={0.1} />
          <NumberField label="Family ×" value={form.multiplierFamily} onChange={v => setForm({ ...form, multiplierFamily: v })} step={0.1} />
        </div>
      </div>

      <div>
        <p className="label text-madder mb-3">TIER THRESHOLDS (lifetime spend in paise)</p>
        <div className="grid md:grid-cols-3 gap-3">
          <NumberField label="Known (₹25,000 = 2500000)" value={form.thresholdKnown} onChange={v => setForm({ ...form, thresholdKnown: v })} />
          <NumberField label="Personal (₹75,000 = 7500000)" value={form.thresholdPersonal} onChange={v => setForm({ ...form, thresholdPersonal: v })} />
          <NumberField label="Family (₹2,00,000 = 20000000)" value={form.thresholdFamily} onChange={v => setForm({ ...form, thresholdFamily: v })} />
        </div>
      </div>

      <div>
        <p className="label text-madder mb-3">REDEMPTION</p>
        <div className="grid md:grid-cols-3 gap-3">
          <NumberField label="Value per point (paise, 100 = ₹1)" value={form.redemptionValue} onChange={v => setForm({ ...form, redemptionValue: v })} />
          <NumberField label="Min redemption (points)" value={form.minRedemption} onChange={v => setForm({ ...form, minRedemption: v })} />
          <NumberField label="Max % of order" value={form.maxRedemptionPct} onChange={v => setForm({ ...form, maxRedemptionPct: v })} />
        </div>
      </div>

      <div>
        <p className="label text-madder mb-3">REFERRAL</p>
        <div className="grid md:grid-cols-3 gap-3">
          <NumberField label="Reward (points to referrer)" value={form.referralRewardPoints} onChange={v => setForm({ ...form, referralRewardPoints: v })} />
          <NumberField label="Referee discount %" value={form.refereeDiscountPct} onChange={v => setForm({ ...form, refereeDiscountPct: v })} />
          <NumberField label="Min order for reward (paise)" value={form.refereeMinOrder} onChange={v => setForm({ ...form, refereeMinOrder: v })} />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.familyNeverExpire}
          onChange={e => setForm({ ...form, familyNeverExpire: e.target.checked })}
        />
        <span>Family-tier points never expire</span>
      </label>

      {msg && <p className={`text-sm ${msg === 'Saved.' ? 'text-neem' : 'text-madder'}`}>{msg}</p>}

      <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2">
        <Save className="w-4 h-4" /> {saving ? 'SAVING...' : 'SAVE SETTINGS'}
      </button>
    </section>
  );
}

function NumberField({ label, value, onChange, step }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <div>
      <label className="label text-mitti">{label}</label>
      <input
        type="number"
        step={step || 1}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className="w-full mt-1 p-2 bg-ivory border border-mitti/20 font-ui text-sm"
      />
    </div>
  );
}
