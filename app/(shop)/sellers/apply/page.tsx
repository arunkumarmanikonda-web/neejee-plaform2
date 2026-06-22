'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Check } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { SingleImageInput } from '@/components/admin/SingleImageInput';

export const dynamic = 'force-dynamic';

const CRAFT_OPTIONS = [
  'Banarasi', 'Chanderi', 'Kanjeevaram', 'Paithani', 'Patola', 'Pochampally',
  'Kalamkari', 'Ajrakh', 'Block Print', 'Bandhani', 'Phulkari', 'Lucknowi Chikankari',
  'Pashmina', 'Kashmiri', 'Bidri', 'Pattachitra', 'Meenakari', 'Temple Jewellery',
  'Kundan', 'Polki', 'Filigree', 'Channapatna', 'Blue Pottery', 'Terracotta',
  'Brass', 'Bell Metal', 'Madhubani', 'Warli', 'Other',
];

export default function SellerApplyPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    businessName: '',
    contactName: '',
    email: '',
    phone: '',
    craft: '',
    region: '',
    cluster: '',
    yearsOfPractice: '',
    story: '',
    pan: '',
    gstin: '',
  });
  const [portfolio, setPortfolio] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const addPortfolioImage = (url: string) => {
    if (!url) return;
    setPortfolio(p => p.length < 10 ? [...p, url] : p);
  };
  const removePortfolioImage = (i: number) => setPortfolio(p => p.filter((_, idx) => idx !== i));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.story.trim().length < 50) {
      setError('Please share at least a short story about your craft (50+ characters).');
      return;
    }
    if (portfolio.length === 0) {
      setError('Please add at least one sample of your work.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/sellers/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          yearsOfPractice: form.yearsOfPractice ? parseInt(form.yearsOfPractice) : undefined,
          portfolio,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Submission failed');
      setSubmitted(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <>
        <Header />
        <section className="max-w-2xl mx-auto px-6 py-24 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-neem/15 flex items-center justify-center mb-6">
            <Check className="w-7 h-7 text-neem" />
          </div>
          <p className="label text-madder">APPLICATION RECEIVED</p>
          <h1 className="font-display text-4xl text-kohl mt-3">Thank you.</h1>
          <p className="font-italic italic text-mitti mt-3 text-lg">
            We have your application. A note is on its way to your inbox.
          </p>
          <p className="text-kohl/75 leading-relaxed mt-6 max-w-md mx-auto">
            We read every application personally. You will hear from us within 3â€“5 working days.
          </p>
          {/* v26.1.7 — clear path back into Seller Studio after applying */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <button onClick={() => router.push('/seller/login?applied=1')} className="btn-primary">GO TO SELLER STUDIO</button>
            <button onClick={() => router.push('/')} className="font-ui text-xs tracking-widest text-kohl hover:text-madder underline underline-offset-4">
              RETURN HOME
            </button>
          </div>
        </section>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />

      <section className="bg-kohl text-ivory py-16 px-6 text-center">
        <p className="text-xs tracking-[0.35em] text-banarasi mb-4">SELL WITH US</p>
        <h1 className="font-display text-5xl md:text-6xl">For the makers.</h1>
        <p className="font-italic italic text-ivory/70 max-w-2xl mx-auto mt-6 text-lg">
          NEEJEE works with a small circle of artisans. We don't list. We collaborate.
          If your craft is honest, we would love to hear from you.
        </p>
      </section>

      <div className="max-w-2xl mx-auto px-6 py-12">
        <form onSubmit={submit} className="space-y-6">
          {/* About you */}
          <fieldset className="space-y-3">
            <legend className="label text-madder mb-2">ABOUT YOU</legend>
            <Field label="Business / Studio name" value={form.businessName} onChange={v => setForm({ ...form, businessName: v })} required />
            <Field label="Your name" value={form.contactName} onChange={v => setForm({ ...form, contactName: v })} required />
            <Field type="email" label="Email" value={form.email} onChange={v => setForm({ ...form, email: v })} required />
            <div>
              <label className="label text-mitti">PHONE</label>
              <div className="mt-1">
                <PhoneInput value={form.phone} onChange={v => setForm({ ...form, phone: v })} required defaultCountry="IN" />
              </div>
            </div>
          </fieldset>

          {/* Your craft */}
          <fieldset className="space-y-3 pt-4 border-t border-mitti/20">
            <legend className="label text-madder mb-2">YOUR CRAFT</legend>
            <div>
              <label className="label text-mitti">CRAFT TRADITION</label>
              <select
                required
                value={form.craft}
                onChange={e => setForm({ ...form, craft: e.target.value })}
                className="w-full p-3 bg-beige border border-mitti/20 font-ui text-sm mt-1"
              >
                <option value="">Chooseâ€¦</option>
                {CRAFT_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <Field label="Region / State" value={form.region} onChange={v => setForm({ ...form, region: v })} placeholder="e.g. Varanasi, UP" required />
            <Field label="Cluster / Village (optional)" value={form.cluster} onChange={v => setForm({ ...form, cluster: v })} placeholder="e.g. Bhadohi" />
            <Field label="Years of practice" type="number" value={form.yearsOfPractice} onChange={v => setForm({ ...form, yearsOfPractice: v })} placeholder="e.g. 15" />
            <div>
              <label className="label text-mitti">YOUR STORY <span className="text-mitti">(50â€“500 words)</span></label>
              <textarea
                required
                value={form.story}
                onChange={e => setForm({ ...form, story: e.target.value })}
                rows={6}
                placeholder="Where does your craft come from? Who taught you? What makes your work yours?"
                className="w-full p-3 bg-beige border border-mitti/20 font-ui text-sm mt-1"
              />
              <p className="text-[10px] text-mitti mt-1">{form.story.length} characters</p>
            </div>
          </fieldset>

          {/* Portfolio */}
          <fieldset className="space-y-3 pt-4 border-t border-mitti/20">
            <legend className="label text-madder mb-2">PORTFOLIO</legend>
            <p className="text-sm text-mitti">Share 1â€“10 photographs of your work. These help us see your hand.</p>

            {portfolio.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                {portfolio.map((url, i) => (
                  <div key={i} className="relative aspect-square">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="w-full h-full object-cover border border-mitti/20" />
                    <button type="button" onClick={() => removePortfolioImage(i)} className="absolute top-1 right-1 bg-kohl/80 text-ivory text-xs px-2 py-0.5">Ã—</button>
                  </div>
                ))}
              </div>
            )}

            {portfolio.length < 10 && (
              <SingleImageInput
                value=""
                onChange={addPortfolioImage}
                folder="seller-applications"
                label={`ADD SAMPLE ${portfolio.length + 1}`}
                recommendedSize="1200 Ã— 1200 px"
                recommendedAspect="square or 4:5"
                endpoint="/api/sellers/upload"
              />
            )}
          </fieldset>

          {/* Business documents (optional at apply stage) */}
          <fieldset className="space-y-3 pt-4 border-t border-mitti/20">
            <legend className="label text-madder mb-2">BUSINESS (OPTIONAL)</legend>
            <p className="text-sm text-mitti">Share if you have them; we can collect later if not.</p>
            <Field label="PAN" value={form.pan} onChange={v => setForm({ ...form, pan: v.toUpperCase() })} placeholder="ABCDE1234F" />
            <Field label="GSTIN" value={form.gstin} onChange={v => setForm({ ...form, gstin: v.toUpperCase() })} placeholder="22ABCDE1234F1Z5" />
          </fieldset>

          {error && <p className="text-madder text-sm">{error}</p>}

          <button type="submit" disabled={submitting} className="btn-primary w-full disabled:opacity-50 flex items-center justify-center gap-2">
            {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> SENDINGâ€¦</> : 'SEND APPLICATION'}
          </button>

          <p className="text-[11px] text-mitti/70 leading-relaxed text-center">
            By applying you agree that NEEJEE may review your portfolio and that the relationship is judged by craft, not volume.
          </p>
        </form>
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
