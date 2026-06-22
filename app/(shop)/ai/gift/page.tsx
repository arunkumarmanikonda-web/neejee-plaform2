'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Sparkles, Loader2, Gift } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export const dynamic = 'force-dynamic';

const PRODUCT_TYPES = ['Any', 'Saree', 'Jewellery', 'Kurta / Menswear', 'Home', 'Fragrance', 'Accessories', 'Gift Hampers'];

export default function GiftConciergePage() {
  const [me, setMe] = useState<{ name?: string | null } | null>(null);
  const [brief, setBrief] = useState({
    recipient: '',
    occasion: '',
    relationship: '',
    recipientStyle: '',
    productType: 'Any',
    budgetMin: '',
    budgetMax: '',
    notes: '',
  });

  useEffect(() => {
    fetch('/api/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.email) setMe(d); })
      .catch(() => {});
  }, []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [intro, setIntro] = useState('');
  const [picks, setPicks] = useState<any[]>([]);
  const [configured, setConfigured] = useState<boolean | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brief.recipient.trim()) { setError('Tell us who the gift is for'); return; }
    setLoading(true); setError(''); setPicks([]); setIntro('');
    try {
      const res = await fetch('/api/ai/gift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...brief,
          budgetMin: brief.budgetMin ? parseInt(brief.budgetMin) : undefined,
          budgetMax: brief.budgetMax ? parseInt(brief.budgetMax) : undefined,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Recommendation failed');
      setPicks(j.recommendations || []);
      setIntro(j.intro || j.message || '');
      setConfigured(!!j.configured);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Header />

      <section className="bg-madder text-ivory py-16 px-6 text-center">
        <p className="text-xs tracking-[0.35em] text-banarasi mb-4">AI GIFT CONCIERGE</p>
        <h1 className="font-display text-5xl md:text-6xl">
          {me?.name ? `Namaste, ${me.name.split(' ')[0]}.` : 'A personal gift, found.'}
        </h1>
        <p className="font-italic italic text-ivory/80 max-w-xl mx-auto mt-4">
          {me?.name
            ? 'Tell us who you are gifting. We will help you find something they will hold close.'
            : 'Tell us who you are gifting. We will suggest pieces that feel right — quietly, like a friend would.'}
        </p>
      </section>

      <div className="max-w-5xl mx-auto px-6 py-12 grid lg:grid-cols-[400px_1fr] gap-12">
        {/* Brief form */}
        <aside>
          <form onSubmit={submit} className="space-y-4 sticky top-24">
            <p className="label text-madder">THE BRIEF</p>

            <Field label="WHO IS IT FOR" placeholder="e.g. my mother, my wife, a dear friend" value={brief.recipient} onChange={v => setBrief({ ...brief, recipient: v })} required />
            <Field label="OCCASION" placeholder="anniversary, diwali, just because…" value={brief.occasion} onChange={v => setBrief({ ...brief, occasion: v })} />
            <Field label="THEIR STYLE" placeholder="minimalist, traditional, modern, eclectic…" value={brief.recipientStyle} onChange={v => setBrief({ ...brief, recipientStyle: v })} />
            <Field label="THE RELATIONSHIP" placeholder="warm and close, formal, family…" value={brief.relationship} onChange={v => setBrief({ ...brief, relationship: v })} />

            <div>
              <label className="label text-mitti">KIND OF GIFT</label>
              <select value={brief.productType} onChange={e => setBrief({ ...brief, productType: e.target.value })} className="w-full p-3 bg-beige border border-mitti/20 font-ui text-sm mt-1">
                {PRODUCT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <p className="text-[10px] tracking-wider text-mitti/70 mt-1">Leave on “Any” to let us choose freely.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="BUDGET MIN (₹)" type="number" placeholder="0" value={brief.budgetMin} onChange={v => setBrief({ ...brief, budgetMin: v })} />
              <Field label="BUDGET MAX (₹)" type="number" placeholder="25000" value={brief.budgetMax} onChange={v => setBrief({ ...brief, budgetMax: v })} />
            </div>

            <div>
              <label className="label text-mitti">ANYTHING ELSE</label>
              <textarea
                value={brief.notes}
                onChange={e => setBrief({ ...brief, notes: e.target.value })}
                placeholder="She loves indigo. He collects fountain pens. They have a young child…"
                rows={3}
                className="w-full p-3 bg-beige border border-mitti/20 font-ui text-sm mt-1"
              />
            </div>

            {error && <p className="text-madder text-xs">{error}</p>}

            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-40">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> THINKING…</> : <><Sparkles className="w-4 h-4" /> FIND PIECES</>}
            </button>
          </form>
        </aside>

        {/* Results */}
        <div>
          {picks.length === 0 && !loading && !intro && (
            <div className="text-center py-20 border border-dashed border-mitti/30">
              <Gift className="w-12 h-12 text-mitti/40 mx-auto mb-4" />
              <p className="font-display text-2xl text-kohl">A personal gift, just ahead.</p>
              <p className="text-mitti mt-2 text-sm">Fill in the brief and we will choose pieces with care.</p>
            </div>
          )}

          {loading && (
            <div className="text-center py-20">
              <Loader2 className="w-8 h-8 text-madder mx-auto animate-spin" />
              <p className="text-mitti italic mt-4">Looking through our trunk for the right pieces…</p>
            </div>
          )}

          {intro && !loading && (
            <div className="mb-8 p-6 bg-beige/40 border-l-2 border-madder">
              {configured === false && (
                <p className="text-[10px] tracking-wider text-madder mb-2">A QUIET DEFAULT · ADD OPENAI KEY FOR PERSONAL RECOMMENDATIONS</p>
              )}
              <p className="font-display text-lg text-kohl leading-relaxed">{intro}</p>
            </div>
          )}

          {picks.length > 0 && !loading && (
            <div className="space-y-6">
              {picks.map((p: any) => (
                <Link key={p.productId} href={`/products/${p.slug}`} className="flex gap-5 group hover:bg-beige/30 p-3 -m-3 transition-colors">
                  {p.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image} alt={p.name} className="w-28 h-36 object-cover border border-mitti/20 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className="font-display text-xl text-kohl group-hover:text-madder transition-colors">{p.name}</p>
                    <p className="text-sm text-kohl/80 leading-relaxed mt-2">{p.why}</p>
                    <p className="text-xs tracking-wider text-mitti mt-3">
                      ₹{(p.pricePaise / 100).toLocaleString('en-IN')} · <span className="text-madder underline">View piece →</span>
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <Footer />
    </>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text', required = false }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; required?: boolean }) {
  return (
    <div>
      <label className="label text-mitti">{label}{required && <span className="text-madder ml-1">*</span>}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full p-3 bg-beige border border-mitti/20 font-ui text-sm mt-1"
      />
    </div>
  );
}
