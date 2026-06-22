'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Mail, MessageCircle, AlertCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface Entry {
  id: string;
  productId: string;
  email: string;
  whatsapp: string | null;
  name: string | null;
  source: string | null;
  notified: boolean;
  createdAt: string;
}
interface Summary {
  productId: string;
  count: number;
  product: {
    id: string;
    name: string;
    slug: string;
    status: string;
    fulfilmentMode: string;
    editionSize: number | null;
    editionSold: number;
  } | null;
}

export default function AdminWaitlistPage() {
  const [summary, setSummary] = useState<Summary[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = (productId?: string | null) => {
    setLoading(true);
    const qs = productId ? `?productId=${productId}` : '';
    fetch(`/api/admin/waitlist${qs}`, { credentials: 'include', cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (d.summary) setSummary(d.summary);
        if (d.entries) setEntries(d.entries);
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const selectedSummary = summary.find(s => s.productId === selectedProductId);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-3xl text-kohl">Waitlist</h1>
        <p className="text-mitti text-sm">
          Customers waiting for sold-out, pre-order, or coming-soon pieces. When a count crosses a
          threshold, consider commissioning more.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Per-product summary */}
        <div className="md:col-span-1 space-y-2">
          <p className="label text-madder mb-2">PIECES WITH WAITERS</p>
          {loading && summary.length === 0 ? (
            <div className="text-center py-6 text-mitti"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
          ) : summary.length === 0 ? (
            <p className="text-sm italic text-mitti">No one is on the waitlist yet.</p>
          ) : (
            summary.map(s => {
              const isHot = s.count >= 10;
              const isWarmer = s.count >= 25;
              const isHottest = s.count >= 50;
              return (
                <button
                  key={s.productId}
                  onClick={() => { setSelectedProductId(s.productId); load(s.productId); }}
                  className={`w-full text-left p-3 border transition-colors ${
                    selectedProductId === s.productId
                      ? 'bg-madder/10 border-madder'
                      : 'bg-ivory border-mitti/20 hover:border-madder/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-display text-kohl text-sm truncate">
                        {s.product?.name || s.productId}
                      </p>
                      <p className="text-[10px] uppercase tracking-widest text-mitti mt-0.5">
                        {s.product?.fulfilmentMode || '\u2014'} \u00b7 {s.product?.status || '\u2014'}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className={`font-display text-2xl ${isHottest ? 'text-madder' : isWarmer ? 'text-madder/80' : isHot ? 'text-haldi' : 'text-mitti'}`}>
                        {s.count}
                      </div>
                      <div className="text-[9px] uppercase tracking-widest text-mitti">waiting</div>
                    </div>
                  </div>
                  {isHottest && (
                    <div className="mt-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-madder">
                      <AlertCircle className="w-3 h-3" /> 50+ \u2014 commission more
                    </div>
                  )}
                  {isWarmer && !isHottest && (
                    <div className="mt-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-madder/80">
                      <AlertCircle className="w-3 h-3" /> 25+ \u2014 worth a second look
                    </div>
                  )}
                  {isHot && !isWarmer && (
                    <div className="mt-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-haldi">
                      <AlertCircle className="w-3 h-3" /> 10+ \u2014 interest is building
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Entries list */}
        <div className="md:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <p className="label text-madder">
              {selectedSummary
                ? `${selectedSummary.count} entries for "${selectedSummary.product?.name || selectedProductId}"`
                : `${entries.length} most recent entries`}
            </p>
            {selectedProductId && (
              <button
                onClick={() => { setSelectedProductId(null); load(); }}
                className="text-xs text-mitti hover:text-madder underline"
              >
                Show all
              </button>
            )}
          </div>
          {selectedSummary?.product && (
            <Link
              href={`/admin/products/${selectedSummary.product.id}`}
              className="text-xs text-madder underline mb-3 inline-block"
            >
              Open piece in editor →
            </Link>
          )}
          <div className="bg-beige/30 border border-mitti/20">
            {entries.length === 0 ? (
              <p className="text-sm italic text-mitti text-center py-12">No entries.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-ivory border-b border-mitti/15">
                  <tr>
                    <th className="text-left p-2 font-ui text-[10px] uppercase tracking-widest text-mitti">When</th>
                    <th className="text-left p-2 font-ui text-[10px] uppercase tracking-widest text-mitti">Email</th>
                    <th className="text-left p-2 font-ui text-[10px] uppercase tracking-widest text-mitti">WhatsApp</th>
                    <th className="text-left p-2 font-ui text-[10px] uppercase tracking-widest text-mitti">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map(e => (
                    <tr key={e.id} className="border-b border-mitti/10 hover:bg-ivory/50">
                      <td className="p-2 text-[11px] text-mitti">
                        {new Date(e.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </td>
                      <td className="p-2 text-kohl">
                        <a href={`mailto:${e.email}`} className="hover:text-madder inline-flex items-center gap-1">
                          <Mail className="w-3 h-3" /> {e.email}
                        </a>
                      </td>
                      <td className="p-2 text-mitti">
                        {e.whatsapp ? (
                          <a href={`https://wa.me/${e.whatsapp.replace(/[^\d]/g, '')}`} target="_blank" rel="noopener noreferrer" className="hover:text-madder inline-flex items-center gap-1">
                            <MessageCircle className="w-3 h-3" /> {e.whatsapp}
                          </a>
                        ) : <span className="text-mitti/40">\u2014</span>}
                      </td>
                      <td className="p-2 text-[11px] text-mitti capitalize">{e.source || '\u2014'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
