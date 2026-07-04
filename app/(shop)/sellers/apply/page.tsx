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
  'Banarasi',
  'Chanderi',
  'Kanjeevaram',
  'Paithani',
  'Patola',
  'Pochampally',
  'Kalamkari',
  'Ajrakh',
  'Block Print',
  'Bandhani',
  'Phulkari',
  'Lucknowi Chikankari',
  'Pashmina',
  'Kashmiri',
  'Bidri',
  'Pattachitra',
  'Meenakari',
  'Temple Jewellery',
  'Kundan',
  'Polki',
  'Filigree',
  'Channapatna',
  'Blue Pottery',
  'Terracotta',
  'Brass',
  'Bell Metal',
  'Madhubani',
  'Warli',
  'Other',
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
    setPortfolio((previous) =>
      previous.length < 10 ? [...previous, url] : previous,
    );
  };

  const removePortfolioImage = (index: number) => {
    setPortfolio((previous) => previous.filter((_, current) => current !== index));
  };

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
      const response = await fetch('/api/sellers/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          yearsOfPractice: form.yearsOfPractice
            ? parseInt(form.yearsOfPractice, 10)
            : undefined,
          portfolio,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Submission failed');
      }

      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Submission failed');
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
            We read every application personally. You will hear from us within 3-5 working days.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => router.push('/seller/login?applied=1')}
              className="btn-primary"
            >
              GO TO SELLER STUDIO
            </button>
            <button
              onClick={() => router.push('/')}
              className="font-ui text-xs tracking-widest text-kohl hover:text-madder underline underline-offset-4"
            >
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
          NEEJEE works with a small circle of artisans. We do not list. We collaborate.
          If your craft is honest, we would love to hear from you.
        </p>
      </section>

      <div className="max-w-2xl mx-auto px-6 py-12">
        <form onSubmit={submit} className="space-y-6">
          <fieldset className="space-y-3">
            <legend className="label text-madder mb-2">ABOUT YOU</legend>
            <Field
              label="Business / Studio name"
              value={form.businessName}
              onChange={(value) => setForm({ ...form, businessName: value })}
              required
            />
            <Field
              label="Your name"
              value={form.contactName}
              onChange={(value) => setForm({ ...form, contactName: value })}
              required
            />
            <Field
              type="email"
              label="Email"
              value={form.email}
              onChange={(value) => setForm({ ...form, email: value })}
              required
            />
            <div>
              <label className="label text-mitti">PHONE</label>
              <div className="mt-1">
                <PhoneInput
                  value={form.phone}
                  onChange={(value) => setForm({ ...form, phone: value })}
                  required
                  defaultCountry="IN"
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-3 pt-4 border-t border-mitti/20">
            <legend className="label text-madder mb-2">YOUR CRAFT</legend>
            <div>
              <label className="label text-mitti">CRAFT TRADITION</label>
              <select
                required
                value={form.craft}
                onChange={(e) => setForm({ ...form, craft: e.target.value })}
                className="w-full p-3 bg-beige border border-mitti/20 font-ui text-sm mt-1"
              >
                <option value="">Choose...</option>
                {CRAFT_OPTIONS.map((craft) => (
                  <option key={craft} value={craft}>
                    {craft}
                  </option>
                ))}
              </select>
            </div>
            <Field
              label="Region / State"
              value={form.region}
              onChange={(value) => setForm({ ...form, region: value })}
              placeholder="e.g. Varanasi, UP"
              required
            />
            <Field
              label="Cluster / Village (optional)"
              value={form.cluster}
              onChange={(value) => setForm({ ...form, cluster: value })}
              placeholder="e.g. Bhadohi"
            />
            <Field
              label="Years of practice"
              type="number"
              value={form.yearsOfPractice}
              onChange={(value) => setForm({ ...form, yearsOfPractice: value })}
              placeholder="e.g. 15"
            />
            <div>
              <label className="label text-mitti">
                YOUR STORY <span className="text-mitti">(50-500 words)</span>
              </label>
              <textarea
                required
                value={form.story}
                onChange={(e) => setForm({ ...form, story: e.target.value })}
                rows={6}
                placeholder="Where does your craft come from? Who taught you? What makes your work yours?"
                className="w-full p-3 bg-beige border border-mitti/20 font-ui text-sm mt-1"
              />
              <p className="text-[10px] text-mitti mt-1">{form.story.length} characters</p>
            </div>
          </fieldset>

          <fieldset className="space-y-3 pt-4 border-t border-mitti/20">
            <legend className="label text-madder mb-2">PORTFOLIO</legend>
            <p className="text-sm text-mitti">
              Share 1-10 photographs of your work. These help us see your hand.
            </p>

            {portfolio.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                {portfolio.map((url, index) => (
                  <div key={index} className="relative aspect-square">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt="Portfolio sample"
                      className="w-full h-full object-cover border border-mitti/20"
                    />
                    <button
                      type="button"
                      onClick={() => removePortfolioImage(index)}
                      className="absolute top-1 right-1 bg-kohl/80 text-ivory text-xs px-2 py-0.5"
                      aria-label={`Remove sample ${index + 1}`}
                    >
                      ×
                    </button>
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
                recommendedSize="1200 x 1200 px"
                recommendedAspect="square or 4:5"
                endpoint="/api/sellers/upload"
              />
            )}
          </fieldset>

          <fieldset className="space-y-3 pt-4 border-t border-mitti/20">
            <legend className="label text-madder mb-2">BUSINESS (OPTIONAL)</legend>
            <p className="text-sm text-mitti">Share if you have them; we can collect later if not.</p>
            <Field
              label="PAN"
              value={form.pan}
              onChange={(value) => setForm({ ...form, pan: value.toUpperCase() })}
              placeholder="ABCDE1234F"
            />
            <Field
              label="GSTIN"
              value={form.gstin}
              onChange={(value) => setForm({ ...form, gstin: value.toUpperCase() })}
              placeholder="22ABCDE1234F1Z5"
            />
          </fieldset>

          {error && <p className="text-madder text-sm">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                SENDING...
              </>
            ) : (
              'SEND APPLICATION'
            )}
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

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
};

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  required = false,
}: FieldProps) {
  return (
    <div>
      <label className="label text-mitti">
        {label}
        {required && <span className="text-madder ml-1">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full p-3 bg-beige border border-mitti/20 font-ui text-sm mt-1"
      />
    </div>
  );
}
