'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { User, Package, Heart, MapPin, Sparkles, LogOut, Ticket, Gem } from 'lucide-react';
import { PhoneInput } from '@/components/ui/PhoneInput';

type SessionUser = {
  id: string;
  email: string;
  name?: string | null;
  phone?: string | null;
  role: string;
  marketingConsent?: boolean;
  smsOptIn?: boolean;
  whatsappOptIn?: boolean;
  emailOptIn?: boolean;
};

type OrderRow = {
  id: string;
  date: string;
  total: number;
  status: string;
  itemCount: number;
};

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR', 'QC_TEAM'];

function formatINR(paise: number) {
  const rupees = paise / 100;
  return '₹' + rupees.toLocaleString('en-IN');
}

export default function AccountPage() {
  const [tab, setTab] = useState('orders');
  const [user, setUser] = useState<SessionUser | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Load session + redirect admins away from /account
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/me', { cache: 'no-store', credentials: 'include' });
        if (!res.ok) {
          router.replace('/login?next=/account');
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        if (!data.user) {
          router.replace('/login?next=/account');
          return;
        }
        // Admins do not belong here — bounce them to /admin
        if (ADMIN_ROLES.includes(data.user.role)) {
          router.replace('/admin');
          return;
        }
        // /api/me returns flattened fields plus a `user` object; prefer flat for richer data
        setUser({
          id: data.id || data.user.id,
          email: data.email || data.user.email,
          name: data.name || data.user.name,
          phone: data.phone || data.user.phone,
          role: data.role || data.user.role,
          marketingConsent: data.marketingConsent ?? data.user.marketingConsent,
          smsOptIn: data.smsOptIn ?? data.user.smsOptIn,
          whatsappOptIn: data.whatsappOptIn ?? data.user.whatsappOptIn,
          emailOptIn: data.emailOptIn ?? data.user.emailOptIn,
        });

        // Load real orders for this user
        const ordRes = await fetch('/api/orders', { cache: 'no-store' });
        if (ordRes.ok) {
          const ordData = await ordRes.json();
          setOrders(ordData.orders || []);
        }
      } catch (e) {
        router.replace('/login?next=/account');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  if (loading || !user) {
    return (
      <>
        <Header />
        <section className="max-w-8xl mx-auto px-6 lg:px-12 py-20 text-center">
          <p className="font-italic italic text-mitti">Opening your trunk…</p>
        </section>
        <Footer />
      </>
    );
  }

  const firstName = (user.name || user.email.split('@')[0]).split(' ')[0];

  return (
    <>
      <Header />
      <section className="max-w-8xl mx-auto px-6 lg:px-12 py-12">
        <p className="label text-madder">YOUR TRUNK</p>
        <h1 className="font-display text-4xl text-kohl mt-2">Namaste, {firstName}.</h1>
        <p className="font-italic italic text-mitti mt-2">Signed in as {user.email}</p>
        <div className="madder-divider mt-4"></div>

        <div className="grid lg:grid-cols-[240px_1fr] gap-12 mt-12">
          <aside className="space-y-1 font-ui text-sm">
            {[
              { id: 'orders', label: 'My Orders', icon: Package },
              { id: 'loyalty', label: "Founder's Circle", icon: Gem },
              { id: 'wishlist', label: 'Wishlist', icon: Heart },
              { id: 'codes', label: 'My Codes', icon: Ticket },
              { id: 'addresses', label: 'Addresses', icon: MapPin },
              { id: 'ai', label: 'AI Previews', icon: Sparkles },
              { id: 'profile', label: 'Profile', icon: User },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} className={`w-full flex items-center gap-3 px-3 py-2 rounded text-left transition-colors ${tab === t.id ? 'bg-madder text-ivory' : 'hover:bg-beige text-kohl'}`}>
                <t.icon className="w-4 h-4" />
                <span>{t.label}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={async () => {
                await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
                router.replace('/');
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded text-monsoon hover:bg-beige mt-8"
            >
              <LogOut className="w-4 h-4" /><span>Sign out</span>
            </button>
          </aside>

          <div>
            {tab === 'orders' && <OrdersTab orders={orders} />}
            {tab === 'loyalty' && <LoyaltyTab />}
            {tab === 'wishlist' && <WishlistTab />}
            {tab === 'codes' && <CodesTab />}
            {tab === 'addresses' && <AddressesTab user={user} />}
            {tab === 'ai' && <AiTab />}
            {tab === 'profile' && <ProfileTab user={user} onUpdate={(u) => setUser(u)} />}
          </div>
        </div>
      </section>
      <Footer />
    </>
  );
}

function OrdersTab({ orders }: { orders: OrderRow[] }) {
  if (orders.length === 0) {
    return (
      <div>
        <h2 className="font-display text-2xl text-kohl mb-6">My orders</h2>
        <div className="bg-beige p-8 text-center">
          <p className="font-italic italic text-mitti">Your trunk is still empty.</p>
          <Link href="/categories/sarees" className="btn-primary mt-6 inline-block">EXPLORE THE EDIT</Link>
        </div>
      </div>
    );
  }
  return (
    <div>
      <h2 className="font-display text-2xl text-kohl mb-6">My orders ({orders.length})</h2>
      <div className="space-y-4">
        {orders.map(o => (
          <div key={o.id} className="bg-beige p-6 flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[200px]">
              <p className="font-display text-lg">{o.id}</p>
              <p className="label">{new Date(o.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })} · {o.itemCount} item(s)</p>
            </div>
            <p className="font-display text-xl">{formatINR(o.total)}</p>
            <span className={`badge-founder ${o.status === 'DELIVERED' ? 'bg-neem' : 'bg-mitti'}`}>{o.status}</span>
            <Link href={`/orders/${o.id}`} className="btn-outline">VIEW</Link>
            {/* v23.40.18 — every customer can download their branded tax invoice at any time */}
            <a href={`/api/orders/${encodeURIComponent(o.id)}/invoice`} target="_blank" rel="noreferrer"
              className="btn-outline" title="Download / print branded tax invoice">
              INVOICE
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

function WishlistTab() {
  return (
    <div>
      <h2 className="font-display text-2xl text-kohl mb-6">Saved for later</h2>
      <p className="font-italic italic text-mitti">Heart any piece to save it here.</p>
    </div>
  );
}

const TIER_INFO: Record<string, { label: string; blurb: string; perks: string[]; color: string }> = {
  FOUND: {
    label: 'Found',
    blurb: "You've started a trunk with us.",
    perks: ['1 point per ₹100 spent', 'Welcome coupon', 'Quiet updates from Mumbai'],
    color: 'from-mitti/20 to-beige/30',
  },
  KNOWN: {
    label: 'Known',
    blurb: 'We know you now.',
    perks: ['1.5× points on every order', 'Free shipping, always', 'Early sale notice'],
    color: 'from-banarasi/30 to-haldi/20',
  },
  PERSONAL: {
    label: 'Personal',
    blurb: "You're someone we know by name.",
    perks: ['2× points on every order', 'Early access to drops', 'A personal note from Nidhi each season'],
    color: 'from-madder/20 to-banarasi/30',
  },
  FAMILY: {
    label: 'Family',
    blurb: 'Of the household.',
    perks: ['3× points, points never expire', 'Atelier invitation (by appointment)', 'Complimentary gift wrap', 'Direct WhatsApp line'],
    color: 'from-kohl/80 to-madder/40',
  },
};

function LoyaltyTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async (attempt = 1): Promise<void> => {
      try {
        const res = await fetch('/api/loyalty/me', { credentials: 'include', cache: 'no-store' });
        const raw = await res.text();
        let d: any = {};
        try { d = raw ? JSON.parse(raw) : {}; } catch { d = {}; }
        if (!mounted) return;
        if (!res.ok) {
          // Retry once on 5xx (cold start / brief outage)
          if (res.status >= 500 && attempt === 1) {
            await new Promise(r => setTimeout(r, 1500));
            return load(2);
          }
          setErrMsg(d.error || `Could not load your loyalty (status ${res.status}).`);
          return;
        }
        // Accept needsMigration fallback shape — still has user/progress/etc.
        setData(d);
      } catch (e: any) {
        if (!mounted) return;
        if (attempt === 1) { await new Promise(r => setTimeout(r, 1500)); return load(2); }
        setErrMsg('The loyalty service is taking a breath. Please refresh in a moment.');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  if (loading) return <p className="text-mitti font-italic italic">Counting your trunk…</p>;
  if (!data) return (
    <div className="space-y-3">
      <p className="text-madder font-ui text-sm">{errMsg || 'Could not load your loyalty.'}</p>
      <button onClick={() => location.reload()} className="btn-outline text-xs">TRY AGAIN</button>
    </div>
  );

  const { user, progress, ledger, referrals, settings } = data;
  const tierInfo = TIER_INFO[user.tier] || TIER_INFO.FOUND;
  const referralUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/signup?ref=${user.referralCode}`;

  const copyReferral = () => {
    navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="label text-madder">FOUND. PERSONAL.</p>
        <h2 className="font-display text-3xl text-kohl mt-2">Founder&apos;s Circle</h2>
      </div>

      {/* Tier hero card */}
      <div className={`bg-gradient-to-br ${tierInfo.color} p-8`}>
        <div className="flex items-start justify-between">
          <div>
            <p className="label text-kohl">YOUR TIER</p>
            <p className="font-display text-5xl text-kohl mt-2">{tierInfo.label}</p>
            <p className="font-italic italic text-kohl/80 mt-2">{tierInfo.blurb}</p>
          </div>
          <div className="text-right">
            <p className="label text-kohl">POINTS</p>
            <p className="font-display text-4xl text-kohl mt-2">{user.points.toLocaleString('en-IN')}</p>
            <p className="text-xs text-kohl/70 mt-1">Worth {formatINR(user.points * settings.redemptionValue)}</p>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-kohl/20">
          <p className="label text-kohl mb-2">YOUR PERKS</p>
          <ul className="space-y-1 text-sm text-kohl">
            {tierInfo.perks.map((p, i) => <li key={i}>· {p}</li>)}
          </ul>
        </div>

        {progress.nextTier && (
          <div className="mt-6 pt-6 border-t border-kohl/20">
            <div className="flex justify-between text-xs text-kohl/80 mb-2">
              <span>To {TIER_INFO[progress.nextTier].label}: {formatINR(progress.spendToNext)} more</span>
              <span>{progress.progressPct}%</span>
            </div>
            <div className="h-2 bg-kohl/10 overflow-hidden">
              <div className="h-full bg-kohl" style={{ width: `${progress.progressPct}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Referral card */}
      <div className="bg-beige p-6">
        <div className="flex items-start gap-3">
          <Gem className="w-5 h-5 text-madder flex-shrink-0 mt-1" />
          <div className="flex-1">
            <p className="font-display text-xl text-kohl">Share NEEJEE, earn together</p>
            <p className="font-italic italic text-mitti text-sm mt-1">
              Send a friend your link. They get {settings.refereeDiscountPct}% off their first order. You get {settings.referralRewardPoints} points when they buy.
            </p>
            <div className="flex gap-2 mt-4">
              <input
                readOnly
                value={referralUrl}
                className="flex-1 p-2 bg-ivory border border-mitti/20 text-xs font-mono"
              />
              <button onClick={copyReferral} className="px-4 py-2 bg-kohl text-ivory text-xs tracking-widest hover:bg-kohl/90">
                {copied ? 'COPIED' : 'COPY LINK'}
              </button>
            </div>
            <p className="font-italic italic text-mitti text-xs mt-3">
              Your code: <strong className="text-madder">{user.referralCode}</strong>
              {referrals.total > 0 && (
                <> · {referrals.rewarded} rewarded, {referrals.pending} pending, {referrals.pointsEarned} points earned</>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Activity */}
      <div>
        <p className="label text-madder mb-3">RECENT ACTIVITY</p>
        {ledger.length === 0 ? (
          <p className="font-italic italic text-mitti text-sm">No points activity yet. Your first order will earn points.</p>
        ) : (
          <ul className="divide-y divide-mitti/10 bg-beige/40">
            {ledger.slice(0, 10).map((e: any) => (
              <li key={e.id} className="p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm text-kohl">{e.reason || e.type}</p>
                  <p className="text-xs text-mitti">{new Date(e.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </div>
                <p className={`font-ui ${e.points > 0 ? 'text-neem' : 'text-madder'}`}>
                  {e.points > 0 ? '+' : ''}{e.points.toLocaleString('en-IN')}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function AddressesTab({ user }: { user: SessionUser }) {
  return (
    <div>
      <h2 className="font-display text-2xl text-kohl mb-6">Addresses</h2>
      <div className="bg-beige p-6">
        <p className="label text-madder">NO DEFAULT ADDRESS YET</p>
        <p className="font-italic italic text-mitti mt-2">Add an address during your next checkout — we'll save it here.</p>
      </div>
      <button className="btn-primary mt-6">+ ADD NEW ADDRESS</button>
    </div>
  );
}

function AiTab() {
  return (
    <div>
      <h2 className="font-display text-2xl text-kohl mb-6">Your AI previews</h2>
      <p className="font-italic italic text-mitti">Previews are auto-deleted 30 days after creation.</p>
      <div className="mt-6 p-6 bg-beige border-l-2 border-madder">
        <p className="label text-madder">PRIVACY</p>
        <p className="font-body text-kohl/85 mt-2">We never sell or share your photos. You can delete all AI previews now using the button below.</p>
        <button className="btn-outline mt-4">DELETE ALL PREVIEWS</button>
      </div>
    </div>
  );
}

function ProfileTab({ user, onUpdate }: { user: SessionUser; onUpdate: (u: SessionUser) => void }) {
  const [name, setName] = useState(user.name || '');
  const [email, setEmail] = useState(user.email || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [marketingConsent, setMarketingConsent] = useState(!!user.marketingConsent);
  const [smsOptIn, setSmsOptIn] = useState(!!user.smsOptIn);
  const [whatsappOptIn, setWhatsappOptIn] = useState(!!user.whatsappOptIn);
  const [emailOptIn, setEmailOptIn] = useState(user.emailOptIn ?? true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const isPlaceholderEmail = /^user_\d+@neejee\.local$/i.test(String(email || '')) || /^\d+@phone\.neejee\.com$/i.test(String(email || ''));

  const save = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    setSaving(true); setMsg(''); setErr('');
    try {
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify({ name, email, phone, marketingConsent, smsOptIn, whatsappOptIn, emailOptIn }),
      });
      const raw = await res.text();
      let j: any = {};
      try { j = raw ? JSON.parse(raw) : {}; } catch {
        throw new Error('Save failed — the connection slipped. Please try again.');
      }
      if (!res.ok) {
        if (res.status === 401) throw new Error('Your session has timed out. Please sign in again.');
        throw new Error(j.error || 'Save failed');
      }
      if (j.user) onUpdate({ ...user, ...j.user });
      setMsg('✓ Saved');
      setTimeout(() => setMsg(''), 2500);
    } catch (e: any) {
      setErr(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h2 className="font-display text-2xl text-kohl mb-6">Profile</h2>
      <div className="space-y-4 max-w-md">
        <label className="block">
          <span className="label">NAME</span>
          <input value={name} onChange={e => setName(e.target.value)} className="w-full mt-1 p-3 bg-beige border border-mitti/20 font-ui" />
        </label>

        <label className="block">
          <span className="label">EMAIL</span>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full mt-1 p-3 bg-beige border border-mitti/20 font-ui" />
        </label>

        {isPlaceholderEmail && (
          <p className="text-xs text-madder bg-madder/5 border border-madder/30 p-2">This is a temporary phone-based email. Replace it with your real email address.</p>
        )}

        <div>
          <span className="label">PHONE</span>
          <div className="mt-1">
            <PhoneInput value={phone} onChange={setPhone} defaultCountry="IN" />
          </div>
        </div>

        <div className="border border-mitti/20 bg-beige/40 p-4 space-y-2.5">
          <p className="label text-mitti">REACH PREFERENCES</p>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" checked={whatsappOptIn} onChange={e => setWhatsappOptIn(e.target.checked)} className="accent-madder" />
            <span className="text-sm text-kohl">WhatsApp — shipping &amp; delivery</span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" checked={smsOptIn} onChange={e => setSmsOptIn(e.target.checked)} className="accent-madder" />
            <span className="text-sm text-kohl">SMS — OTPs &amp; alerts</span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" checked={emailOptIn} onChange={e => setEmailOptIn(e.target.checked)} className="accent-madder" />
            <span className="text-sm text-kohl">Email — order notes &amp; updates</span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" checked={marketingConsent} onChange={e => setMarketingConsent(e.target.checked)} className="accent-madder" />
            <span className="text-sm text-kohl">Marketing letters — new drops, stories</span>
          </label>
        </div>

        <p className="font-ui text-xs text-mitti/70">Role: {user.role}</p>

        {msg && <p className="text-xs text-neem">{msg}</p>}
        {err && <p className="text-xs text-madder">{err}</p>}

        <button type="button" onClick={save} disabled={saving} className="btn-primary disabled:opacity-50">
          {saving ? 'SAVING…' : 'SAVE CHANGES'}
        </button>
      </div>
    </div>
  );
}

function CodesTab() {
  const [codes, setCodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string>('');

  useEffect(() => {
    fetch('/api/my-coupons').then(r => r.ok ? r.json() : { coupons: [] })
      .then(d => { setCodes(d.coupons || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(''), 2000);
    } catch {}
  };

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const fmtValue = (c: any) =>
    c.type === 'PERCENT' ? `${c.value}% off` :
    c.type === 'FLAT' ? `₹${(c.value / 100).toLocaleString('en-IN')} off` :
    c.type === 'FREE_SHIPPING' ? 'Free shipping' : '';

  return (
    <div>
      <h2 className="font-display text-2xl text-kohl">My Codes</h2>
      <p className="font-italic italic text-mitti mt-1">Personal codes, yours alone.</p>
      <div className="madder-divider mt-3 mb-8"></div>

      {loading ? (
        <p className="text-mitti text-sm">Loading…</p>
      ) : codes.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-mitti/30">
          <p className="font-display text-2xl text-kohl">No codes yet.</p>
          <p className="text-mitti mt-2">Codes issued to you appear here.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {codes.map((c: any) => {
            const available = c.status === 'AVAILABLE';
            return (
              <div key={c.id} className={`border ${available ? 'border-madder/40 bg-beige/30' : 'border-mitti/20 bg-beige/10 opacity-70'} p-5`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-display text-xl text-kohl">{fmtValue(c)}</p>
                    <p className="text-xs tracking-wider text-mitti mt-1">
                      {available ? `VALID TILL ${fmtDate(c.validTo)?.toUpperCase()}` : c.status}
                    </p>
                  </div>
                  {available && <span className="text-[10px] tracking-wider text-madder bg-madder/10 px-2 py-1">SINGLE USE</span>}
                </div>

                <div className="mt-4 flex items-stretch border border-mitti/20">
                  <div className="flex-1 px-3 py-2.5 font-mono text-sm text-kohl bg-ivory truncate">
                    {c.code}
                  </div>
                  <button
                    onClick={() => copy(c.code)}
                    disabled={!available}
                    className="px-3 text-xs tracking-wider bg-kohl text-ivory hover:bg-kohl/90 disabled:opacity-40"
                  >
                    {copied === c.code ? 'COPIED' : 'COPY'}
                  </button>
                </div>

                {c.minCart > 0 && (
                  <p className="text-[10px] text-mitti mt-2">Min. cart ₹{(c.minCart / 100).toLocaleString('en-IN')}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
