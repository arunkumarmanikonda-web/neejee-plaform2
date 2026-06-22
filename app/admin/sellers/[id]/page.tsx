'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Check, X, Save, ExternalLink } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function AdminSellerDetail() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [seller, setSeller] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState('');

  const load = () => {
    setLoading(true);
    fetch(`/api/admin/sellers/${id}`)
      .then(r => r.json())
      .then(d => { setSeller(d.seller || null); setLoading(false); });
  };
  useEffect(load, [id]);

  const patch = async (body: any) => {
    setSaving(true); setErr(''); setMsg('');
    try {
      const res = await fetch(`/api/admin/sellers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Update failed');
      setSeller(j.seller);
      setMsg('✓ Saved');
      setTimeout(() => setMsg(''), 2500);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-mitti">Loading…</p>;
  if (!seller) return <p className="text-madder">Seller not found.</p>;

  const update = (key: string, value: any) => setSeller({ ...seller, [key]: value });

  return (
    <>
      <Link href="/admin/sellers" className="text-xs tracking-wider text-mitti hover:text-kohl flex items-center gap-1">
        <ArrowLeft className="w-3 h-3" /> ALL SELLERS
      </Link>
      <h1 className="font-display text-4xl text-kohl mt-2">{seller.businessName}</h1>
      <p className="font-italic italic text-mitti mt-2">{seller.craft} · {seller.region}</p>
      <div className="madder-divider mt-4"></div>

      {msg && <p className="text-neem text-sm mt-4">{msg}</p>}
      {err && <p className="text-madder text-sm mt-4">{err}</p>}

      {/* KYC quick actions */}
      <div className="mt-6 bg-beige p-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="label text-mitti">CURRENT STATUS</p>
          <p className="font-display text-2xl text-kohl mt-1">{seller.kycStatus.replace(/_/g, ' ')}</p>
          {seller.kycStatus === 'REJECTED' && seller.rejectionNote && (
            <p className="text-xs text-mitti mt-2 italic max-w-md">Note sent: “{seller.rejectionNote}”</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {seller.kycStatus !== 'APPROVED' && (
            <button onClick={() => patch({ kycStatus: 'APPROVED', rejectionNote: null })} disabled={saving} className="px-4 py-2 bg-neem text-ivory text-xs tracking-wider hover:bg-neem/90 disabled:opacity-50 flex items-center gap-1.5">
              <Check className="w-4 h-4" /> {seller.kycStatus === 'REJECTED' ? 'RE-APPROVE' : 'APPROVE'}
            </button>
          )}
          {seller.kycStatus !== 'UNDER_REVIEW' && seller.kycStatus !== 'APPROVED' && (
            <button onClick={() => patch({ kycStatus: 'UNDER_REVIEW' })} disabled={saving} className="px-4 py-2 bg-banarasi text-ivory text-xs tracking-wider hover:bg-banarasi/90 disabled:opacity-50">
              MARK UNDER REVIEW
            </button>
          )}
          {seller.kycStatus !== 'REJECTED' && (
            <button onClick={() => setRejectOpen(true)} disabled={saving} className="px-4 py-2 border border-madder text-madder text-xs tracking-wider hover:bg-madder/10 disabled:opacity-50 flex items-center gap-1.5">
              <X className="w-4 h-4" /> REJECT
            </button>
          )}
          <button onClick={() => patch({ resendApplicationEmail: true })} disabled={saving} className="px-3 py-2 border border-mitti/30 text-mitti text-[10px] tracking-wider hover:bg-mitti/5 disabled:opacity-50" title="Re-send the original application-received email">
            RESEND CONFIRMATION
          </button>
        </div>
      </div>

      {rejectOpen && (
        <div className="mt-4 bg-madder/5 border border-madder/30 p-4">
          <p className="label text-madder mb-2">REJECTION NOTE TO ARTISAN</p>
          <textarea
            value={rejectNote}
            onChange={e => setRejectNote(e.target.value)}
            placeholder="Optional — kept brief and kind"
            rows={3}
            className="w-full p-3 bg-ivory border border-mitti/20 text-sm"
          />
          <div className="flex gap-2 mt-3">
            <button onClick={() => { patch({ kycStatus: 'REJECTED', rejectionNote: rejectNote }); setRejectOpen(false); }} className="px-4 py-2 bg-madder text-ivory text-xs tracking-wider">SEND REJECTION</button>
            <button onClick={() => setRejectOpen(false)} className="px-4 py-2 border border-mitti/30 text-xs tracking-wider">CANCEL</button>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6 mt-8">
        {/* Story + portfolio */}
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-beige p-6">
            <p className="label text-madder mb-3">STORY</p>
            <p className="text-sm text-kohl whitespace-pre-wrap leading-relaxed">{seller.story || '—'}</p>
          </section>

          {seller.portfolio && seller.portfolio.length > 0 && (
            <section className="bg-beige p-6">
              <p className="label text-madder mb-3">PORTFOLIO ({seller.portfolio.length})</p>
              <div className="grid grid-cols-3 gap-3">
                {seller.portfolio.map((url: string, i: number) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                    <img src={url} alt="" className="w-full aspect-square object-cover border border-mitti/20 hover:border-kohl" />
                  </a>
                ))}
              </div>
            </section>
          )}

          <section className="bg-beige p-6">
            <p className="label text-madder mb-3">COMMERCIAL TERMS</p>
            <div className="grid grid-cols-2 gap-4">
              <NumField label="Commission %" value={seller.commissionPct} onChange={v => update('commissionPct', v)} step={0.5} />
              <NumField label="Quality Score" value={seller.qualityScore} onChange={v => update('qualityScore', v)} step={0.1} max={5} />
              <div>
                <label className="label text-mitti">PAYOUT CYCLE</label>
                <select value={seller.payoutCycle} onChange={e => update('payoutCycle', e.target.value)} className="w-full p-2 bg-ivory border border-mitti/20 text-sm mt-1">
                  <option value="WEEKLY">Weekly</option>
                  <option value="FORTNIGHTLY">Fortnightly</option>
                  <option value="MONTHLY">Monthly</option>
                </select>
              </div>
              <label className="flex items-center gap-2 mt-6">
                <input type="checkbox" checked={!!seller.isNeejeeSelect} onChange={e => update('isNeejeeSelect', e.target.checked)} className="accent-madder" />
                <span className="text-sm text-kohl">NEEJEE Select</span>
              </label>
            </div>
            <button
              onClick={() => patch({
                commissionPct: parseFloat(seller.commissionPct),
                qualityScore: parseFloat(seller.qualityScore),
                payoutCycle: seller.payoutCycle,
                isNeejeeSelect: seller.isNeejeeSelect,
              })}
              disabled={saving}
              className="btn-primary text-xs mt-4 inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" /> SAVE TERMS
            </button>
          </section>

          {seller.products?.length > 0 && (
            <section className="bg-beige p-6">
              <p className="label text-madder mb-3">PRODUCTS ({seller.products.length})</p>
              <ul className="space-y-2">
                {seller.products.map((p: any) => (
                  <li key={p.id} className="flex items-center justify-between text-sm">
                    <Link href={`/admin/products/${p.id}`} className="text-kohl hover:text-madder">{p.name}</Link>
                    <span className="text-xs tracking-wider text-mitti">{p.status}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Side rail */}
        <div className="space-y-4">
          <section className="bg-beige p-5">
            <p className="label text-madder mb-3">CONTACT</p>
            <p className="text-sm text-kohl">{seller.contactName}</p>
            <p className="text-xs text-mitti mt-1">{seller.email}</p>
            <p className="text-xs text-mitti">{seller.phone}</p>
            {seller.user && (
              <p className="text-[10px] tracking-wider mt-3">
                User role: <span className="text-madder">{seller.user.role}</span>
              </p>
            )}
          </section>

          <section className="bg-beige p-5">
            <p className="label text-madder mb-3">KYC DETAILS</p>
            <KvRow k="PAN" v={seller.pan} mono />
            <KvRow k="GSTIN" v={seller.gstin} mono />
            <KvRow k="Bank account" v={seller.bankAccount} mono />
            <KvRow k="IFSC" v={seller.ifsc} mono />
            <KvRow k="Bank name" v={seller.bankName} />
            <KvRow k="Years of practice" v={seller.yearsOfPractice} />
            <KvRow k="Cluster" v={seller.cluster} />
          </section>

          {seller.payouts && seller.payouts.length > 0 && (
            <section className="bg-beige p-5">
              <p className="label text-madder mb-3">RECENT PAYOUTS</p>
              <ul className="space-y-2 text-xs">
                {seller.payouts.slice(0, 5).map((p: any) => (
                  <li key={p.id} className="flex justify-between">
                    <span className="text-kohl">₹{(p.netPayoutPaise/100).toLocaleString('en-IN')}</span>
                    <span className="text-mitti">{p.status}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </>
  );
}

function NumField({ label, value, onChange, step = 1, max }: { label: string; value: any; onChange: (val: string) => void; step?: number; max?: number }) {
  return (
    <div>
      <label className="label text-mitti">{label}</label>
      <input
        type="number"
        step={step}
        max={max}
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        className="w-full p-2 bg-ivory border border-mitti/20 text-sm mt-1"
      />
    </div>
  );
}

function KvRow({ k, v, mono }: { k: string; v: any; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between text-xs py-1.5 border-b border-mitti/10 last:border-0">
      <span className="text-mitti">{k}</span>
      <span className={`${mono ? 'font-mono' : ''} text-kohl text-right ml-2`}>{v || '—'}</span>
    </div>
  );
}
