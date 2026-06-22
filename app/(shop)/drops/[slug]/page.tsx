'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { formatINR, effectivePricePaise } from '@/lib/money';
import { fulfilmentStatusLine, isSoldOut } from '@/lib/fulfilment';
import { Loader2, Clock } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface DropData {
  id: string;
  slug: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  coverImage?: string | null;
  startsAt: string;
  endsAt?: string | null;
  status: string;
  founderNote?: string | null;
}

export default function DropPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const [data, setData] = useState<{ drop: DropData; products: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    fetch(`/api/drops/${slug}`)
      .then(r => {
        if (r.status === 404) { setNotFound(true); return null; }
        return r.json();
      })
      .then(d => {
        if (d?.drop) setData(d);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  // Countdown tick
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  if (loading) {
    return (
      <>
        <Header />
        <main className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-mitti" />
        </main>
        <Footer />
      </>
    );
  }
  if (notFound || !data) {
    return (
      <>
        <Header />
        <main className="min-h-[60vh] flex items-center justify-center px-6 text-center">
          <div>
            <h1 className="font-display text-3xl text-madder mb-2">Drop not found</h1>
            <p className="italic text-mitti mb-6">This drop may not have opened yet, or has closed.</p>
            <Link href="/" className="px-4 py-2 border border-mitti/40 text-kohl text-xs uppercase tracking-widest hover:bg-mitti/10">
              Back to NEEJEE
            </Link>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  const { drop, products } = data;
  const startsAt = new Date(drop.startsAt);
  const endsAt = drop.endsAt ? new Date(drop.endsAt) : null;
  const isPreLaunch = drop.status === 'SCHEDULED' && now < startsAt;
  const isLive = drop.status === 'LIVE' || (drop.status === 'SCHEDULED' && now >= startsAt && (!endsAt || now < endsAt));
  const isClosed = drop.status === 'CLOSED' || (endsAt && now >= endsAt);

  // Countdown calc
  const ms = startsAt.getTime() - now.getTime();
  const days = Math.max(0, Math.floor(ms / 86400000));
  const hours = Math.max(0, Math.floor((ms % 86400000) / 3600000));
  const minutes = Math.max(0, Math.floor((ms % 3600000) / 60000));
  const seconds = Math.max(0, Math.floor((ms % 60000) / 1000));

  return (
    <>
      <Header />

      {/* Cover */}
      {drop.coverImage && (
        <div className="relative w-full h-[55vh] sm:h-[70vh] overflow-hidden bg-beige">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={drop.coverImage} alt={drop.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-kohl/40" />
          <div className="absolute inset-0 flex items-end justify-center pb-12 px-6">
            <div className="text-center text-ivory max-w-2xl">
              <p className="label text-banarasi mb-2">NEEJEE DROP</p>
              <h1 className="font-display text-4xl sm:text-6xl mb-3 drop-shadow-lg">{drop.title}</h1>
              {drop.subtitle && <p className="italic text-lg sm:text-xl drop-shadow">{drop.subtitle}</p>}
            </div>
          </div>
        </div>
      )}

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        {!drop.coverImage && (
          <header className="mb-10">
            <p className="label text-madder">NEEJEE DROP</p>
            <h1 className="font-display text-5xl text-kohl mt-2">{drop.title}</h1>
            {drop.subtitle && <p className="italic text-lg text-mitti mt-2">{drop.subtitle}</p>}
            <div className="madder-divider mt-4"></div>
          </header>
        )}

        {/* COUNTDOWN — pre-launch */}
        {isPreLaunch && (
          <section className="text-center my-10 p-8 bg-beige/40 border border-mitti/20">
            <Clock className="w-8 h-8 text-madder mx-auto mb-3" />
            <p className="font-display text-2xl text-kohl mb-1">Opens in</p>
            <div className="flex justify-center gap-4 sm:gap-8 mt-4">
              {[
                { v: days, l: 'days' },
                { v: hours, l: 'hours' },
                { v: minutes, l: 'mins' },
                { v: seconds, l: 'secs' },
              ].map(b => (
                <div key={b.l} className="text-center">
                  <div className="font-display text-3xl sm:text-5xl text-madder tabular-nums">{String(b.v).padStart(2, '0')}</div>
                  <div className="text-[10px] uppercase tracking-widest text-mitti mt-1">{b.l}</div>
                </div>
              ))}
            </div>
            <p className="italic text-mitti text-sm mt-6 max-w-md mx-auto">
              {startsAt.toLocaleString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })}
            </p>
          </section>
        )}

        {/* LIVE banner */}
        {isLive && (
          <section className="text-center my-8">
            <span className="inline-block px-4 py-1 bg-madder text-ivory text-xs uppercase tracking-widest font-ui">
              ● Live now
            </span>
            {endsAt && (
              <p className="italic text-mitti text-sm mt-2">
                Closes {endsAt.toLocaleString('en-IN', { day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })}
              </p>
            )}
          </section>
        )}

        {/* CLOSED banner */}
        {isClosed && (
          <section className="text-center my-8 p-6 bg-mitti/10 border border-mitti/20">
            <p className="font-display text-xl text-mitti">This drop has closed.</p>
            <p className="italic text-mitti text-sm mt-1">If a piece you wanted slipped through, join its waitlist below — we may find more.</p>
          </section>
        )}

        {/* Founder note */}
        {drop.founderNote && (
          <section className="my-12 max-w-2xl mx-auto">
            <p className="label text-madder text-center">A note from Nidhi</p>
            <div className="madder-divider mt-2 mb-6 max-w-xs mx-auto"></div>
            <p className="italic text-mitti text-lg leading-relaxed whitespace-pre-wrap">
              {drop.founderNote}
            </p>
          </section>
        )}

        {/* Description */}
        {drop.description && (
          <section className="my-12 max-w-2xl mx-auto text-mitti leading-relaxed whitespace-pre-wrap">
            {drop.description}
          </section>
        )}

        {/* Pieces — only show on LIVE or CLOSED, not PRE-LAUNCH */}
        {!isPreLaunch && products.length > 0 && (
          <section className="mt-10">
            <h2 className="font-display text-3xl text-kohl mb-2">The pieces</h2>
            <p className="italic text-mitti mb-6">{products.length} piece{products.length === 1 ? '' : 's'} in this drop.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map(p => {
                const soldOut = isSoldOut(p);
                const status = fulfilmentStatusLine(p);
                const priceInfo = effectivePricePaise(p.sellingPrice, p.salePrice, p.saleStartsAt, p.saleEndsAt);
                const price = priceInfo.price;
                return (
                  <Link
                    key={p.id}
                    href={soldOut ? '#' : `/products/${p.slug}`}
                    className={`block group ${soldOut ? 'cursor-default opacity-60' : ''}`}
                  >
                    <div className="relative aspect-[4/5] bg-beige/30 overflow-hidden">
                      {p.images?.[0] && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      )}
                      {soldOut && (
                        <div className="absolute inset-0 flex items-center justify-center bg-kohl/60">
                          <span className="font-display text-ivory text-xl tracking-widest">SOLD OUT</span>
                        </div>
                      )}
                    </div>
                    <p className="font-display text-kohl mt-3">{p.name}</p>
                    {p.poeticLine && <p className="italic text-xs text-mitti mt-1">{p.poeticLine}</p>}
                    <p className="text-sm text-kohl mt-2">{formatINR(price)}</p>
                    {status && <p className="text-[10px] uppercase tracking-widest text-madder mt-1">{status}</p>}
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Pre-launch — show pieces as a teaser without prices/CTAs */}
        {isPreLaunch && products.length > 0 && (
          <section className="mt-10">
            <h2 className="font-display text-2xl text-kohl mb-4">A first look</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {products.slice(0, 6).map(p => (
                <div key={p.id} className="aspect-square bg-beige/30 overflow-hidden">
                  {p.images?.[0] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover blur-sm hover:blur-none transition-all duration-700" />
                  )}
                </div>
              ))}
            </div>
            <p className="italic text-mitti text-center mt-6 text-sm">
              The pieces reveal themselves when the drop opens.
            </p>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
