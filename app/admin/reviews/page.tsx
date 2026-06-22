'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Star, Check, X, Trash2 } from 'lucide-react';

const STATUS_COLOR: Record<string, string> = { PENDING: 'bg-haldi', APPROVED: 'bg-neem', REJECTED: 'bg-madder' };

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const url = filter === 'ALL' ? '/api/admin/reviews' : `/api/admin/reviews?status=${filter}`;
      const r = await fetch(url);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setReviews(d.reviews || []);
      setCounts(d.statusCounts || {});
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filter]);

  const setStatus = async (id: string, status: string) => {
    try {
      const r = await fetch(`/api/admin/reviews/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      await load();
    } catch (e: any) { alert(e.message); }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this review permanently?')) return;
    try {
      const r = await fetch(`/api/admin/reviews/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error((await r.json()).error);
      await load();
    } catch (e: any) { alert(e.message); }
  };

  const total = Object.values(counts).reduce((s, n) => s + n, 0);

  return (
    <>
      <p className="label text-madder">MODERATION</p>
      <h1 className="font-display text-4xl text-kohl mt-2">Reviews & Ratings</h1>
      <p className="font-italic italic text-mitti mt-2">{loading ? 'Loading...' : `${reviews.length} of ${total} shown`}</p>
      <div className="madder-divider mt-4"></div>

      {error && <p className="mt-6 font-ui text-sm text-madder bg-madder/10 p-3">{error}</p>}

      <div className="flex gap-2 mt-8 font-ui text-xs tracking-widest">
        {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 transition-colors ${filter === f ? 'bg-kohl text-ivory' : 'bg-beige text-kohl hover:bg-mitti/20'}`}>
            {f} {f === 'ALL' ? `(${total})` : counts[f] ? `(${counts[f]})` : ''}
          </button>
        ))}
      </div>

      <div className="mt-8 space-y-4">
        {loading && <p className="text-mitti text-center p-8">Loading...</p>}
        {!loading && reviews.length === 0 && (
          <div className="bg-beige p-12 text-center">
            <Star className="w-8 h-8 text-mitti mx-auto" />
            <p className="font-italic italic text-mitti mt-3">No reviews to show.</p>
          </div>
        )}
        {reviews.map(r => (
          <div key={r.id} className="bg-beige p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex">
                    {[1,2,3,4,5].map(n => (
                      <Star key={n} className={`w-4 h-4 ${n <= r.rating ? 'fill-haldi text-haldi' : 'text-mitti/30'}`} />
                    ))}
                  </div>
                  <span className={`badge-founder ${STATUS_COLOR[r.status]}`}>{r.status}</span>
                </div>
                {r.title && <p className="font-display text-lg text-kohl">{r.title}</p>}
                <p className="font-body text-kohl/85 mt-2">{r.body}</p>
                <div className="mt-4 flex items-center gap-3 font-ui text-xs text-mitti">
                  <span>{r.user?.name || 'Anonymous'}</span>
                  <span>·</span>
                  <span>{r.user?.email}</span>
                  <span>·</span>
                  <span>{new Date(r.createdAt).toLocaleDateString('en-IN')}</span>
                  <span>·</span>
                  <Link href={`/products/${r.product?.slug}`} className="text-madder hover:underline">
                    {r.product?.name}
                  </Link>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {r.status !== 'APPROVED' && (
                  <button onClick={() => setStatus(r.id, 'APPROVED')} title="Approve"
                    className="p-2 bg-neem text-ivory hover:bg-neem/80"><Check className="w-4 h-4" /></button>
                )}
                {r.status !== 'REJECTED' && (
                  <button onClick={() => setStatus(r.id, 'REJECTED')} title="Reject"
                    className="p-2 bg-madder text-ivory hover:bg-madder/80"><X className="w-4 h-4" /></button>
                )}
                <button onClick={() => remove(r.id)} title="Delete"
                  className="p-2 bg-monsoon text-ivory hover:bg-kohl"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
