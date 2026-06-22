'use client';
import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';

export function ReviewsSection({ productSlug }: { productSlug: string }) {
  const [reviews, setReviews] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({ count: 0, avg: 0, dist: {} });
  const [me, setMe] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ rating: 5, title: '', body: '' });
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const r = await fetch(`/api/reviews?product=${productSlug}`);
      const d = await r.json();
      setReviews(d.reviews || []);
      setSummary(d.summary || { count: 0, avg: 0 });
    } catch {}
  };

  useEffect(() => {
    fetch('/api/me').then(r => r.json()).then(d => d?.email && setMe(d)).catch(() => {});
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productSlug]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitting(true); setError(''); setMsg('');
    try {
      const r = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productSlug, rating: form.rating, title: form.title, reviewBody: form.body }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setMsg(d.message || 'Thank you — your review is awaiting moderation.');
      setForm({ rating: 5, title: '', body: '' });
      setShowForm(false);
    } catch (e: any) { setError(e.message); }
    finally { setSubmitting(false); }
  };

  return (
    <section className="mt-16 border-t border-mitti/20 pt-12">
      <div className="flex items-baseline justify-between flex-wrap gap-4">
        <div>
          <p className="label text-madder">REVIEWS</p>
          <h2 className="font-display text-3xl text-kohl mt-2">What our buyers say</h2>
          {summary.count > 0 && (
            <div className="flex items-center gap-3 mt-3">
              <div className="flex">
                {[1,2,3,4,5].map(n => (
                  <Star key={n} className={`w-5 h-5 ${n <= Math.round(summary.avg) ? 'fill-haldi text-haldi' : 'text-mitti/30'}`} />
                ))}
              </div>
              <span className="font-display text-lg">{summary.avg}</span>
              <span className="font-italic italic text-mitti">based on {summary.count} review{summary.count !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
        {me && (
          <button onClick={() => setShowForm(!showForm)} className="btn-outline text-xs">
            {showForm ? 'CANCEL' : 'WRITE A REVIEW'}
          </button>
        )}
      </div>

      {msg && <p className="mt-6 font-italic italic text-neem">{msg}</p>}

      {showForm && me && (
        <form onSubmit={submit} className="mt-8 bg-beige p-6 max-w-2xl">
          {error && <p className="font-ui text-xs text-madder bg-madder/10 p-2 mb-3">{error}</p>}
          <div className="mb-4">
            <p className="label text-mitti mb-2">YOUR RATING</p>
            <div className="flex gap-1">
              {[1,2,3,4,5].map(n => (
                <button key={n} type="button" onClick={() => setForm({...form, rating: n})}>
                  <Star className={`w-7 h-7 ${n <= form.rating ? 'fill-haldi text-haldi' : 'text-mitti/30 hover:text-haldi'}`} />
                </button>
              ))}
            </div>
          </div>
          <div className="mb-3">
            <label className="label text-mitti block mb-1">Headline (optional)</label>
            <input value={form.title} onChange={e => setForm({...form, title: e.target.value})}
              className="w-full p-3 bg-ivory border border-mitti/20 font-ui text-sm" />
          </div>
          <div className="mb-3">
            <label className="label text-mitti block mb-1">Your review *</label>
            <textarea required rows={4} value={form.body} onChange={e => setForm({...form, body: e.target.value})}
              placeholder="Tell us about the craft, fit, feel..."
              className="w-full p-3 bg-ivory border border-mitti/20 font-body text-sm" />
          </div>
          <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-50">
            {submitting ? 'POSTING...' : 'POST REVIEW'}
          </button>
          <p className="font-italic italic text-mitti text-xs mt-3">
            Reviews are moderated for spam. Yours will appear after admin approval.
          </p>
        </form>
      )}

      {!me && (
        <p className="mt-6 font-italic italic text-mitti">
          <a href="/login" className="text-madder hover:underline">Sign in</a> to leave a review.
        </p>
      )}

      <div className="mt-8 space-y-6">
        {reviews.length === 0 && (
          <p className="font-italic italic text-mitti">Be the first to review this piece.</p>
        )}
        {reviews.map(r => (
          <div key={r.id} className="pb-6 border-b border-mitti/15">
            <div className="flex items-center gap-2">
              <div className="flex">
                {[1,2,3,4,5].map(n => (
                  <Star key={n} className={`w-4 h-4 ${n <= r.rating ? 'fill-haldi text-haldi' : 'text-mitti/30'}`} />
                ))}
              </div>
              <span className="font-ui text-xs text-mitti">
                {r.author} · {new Date(r.createdAt).toLocaleDateString('en-IN')}
              </span>
            </div>
            {r.title && <p className="font-display text-lg text-kohl mt-2">{r.title}</p>}
            <p className="font-body text-kohl/85 mt-1">{r.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
