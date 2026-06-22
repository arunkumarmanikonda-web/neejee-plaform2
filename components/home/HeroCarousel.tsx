'use client';
// v23.40.23 — Scrollable hero carousel.
// Reads ALL active hero banners from the homepage server component and
// rotates through them with autoplay + manual nav + scroll-snap.

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface HeroBanner {
  id: string;
  title?: string | null;
  subtitle?: string | null;
  image?: string | null;
  ctaText?: string | null;
  ctaUrl?: string | null;
}

interface Props {
  banners: HeroBanner[];
  primaryCatSlug: string;
}

// Default hero shown when no banners are published (keeps homepage non-empty)
const DEFAULT_HERO = {
  id: 'default',
  title: null,
  subtitle: null,
  image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=1920&q=80',
  ctaText: 'SHOP THE FIRST EDIT',
  ctaUrl: null,
};

const AUTOPLAY_MS = 6000;

export function HeroCarousel({ banners, primaryCatSlug }: Props) {
  // If admin hasn't published any hero banners yet, show the default editorial hero
  const slides = banners.length > 0 ? banners : [DEFAULT_HERO];
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Autoplay
  useEffect(() => {
    if (paused || slides.length <= 1) return;
    const t = setInterval(() => {
      setActive(a => (a + 1) % slides.length);
    }, AUTOPLAY_MS);
    return () => clearInterval(t);
  }, [paused, slides.length]);

  // Scroll the underlying scroller when `active` changes
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const slide = el.children[active] as HTMLElement | undefined;
    if (slide) {
      el.scrollTo({ left: slide.offsetLeft, behavior: 'smooth' });
    }
  }, [active]);

  // Update `active` when the user scrolls/swipes the carousel
  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const slideWidth = el.clientWidth;
    const next = Math.round(el.scrollLeft / slideWidth);
    if (next !== active && next >= 0 && next < slides.length) {
      setActive(next);
    }
  };

  const prev = () => setActive(a => (a - 1 + slides.length) % slides.length);
  const next = () => setActive(a => (a + 1) % slides.length);

  return (
    <section
      className="relative bg-kohl text-ivory overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar"
        style={{ scrollbarWidth: 'none' }}
      >
        {slides.map((b, idx) => (
          <HeroSlide key={b.id || idx} banner={b} primaryCatSlug={primaryCatSlug} />
        ))}
      </div>

      {/* Prev / Next */}
      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={prev}
            aria-label="Previous banner"
            className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 items-center justify-center bg-ivory/10 hover:bg-ivory/20 backdrop-blur-sm text-ivory transition"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Next banner"
            className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 items-center justify-center bg-ivory/10 hover:bg-ivory/20 backdrop-blur-sm text-ivory transition"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}

      {/* Dots */}
      {slides.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2">
          {slides.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setActive(idx)}
              aria-label={`Show banner ${idx + 1}`}
              className={`h-1.5 transition-all ${
                active === idx ? 'w-8 bg-ivory' : 'w-4 bg-ivory/40 hover:bg-ivory/70'
              }`}
            />
          ))}
        </div>
      )}

      <style jsx>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </section>
  );
}

function HeroSlide({ banner, primaryCatSlug }: { banner: HeroBanner; primaryCatSlug: string }) {
  const isDefault = banner.id === 'default';
  const title = banner.title || 'The rare, the rooted, the personal.';
  const subtitle = banner.subtitle ||
    "India's finest craft — hand-woven sarees, oxidised silver, mitti attars, Phulkari dupattas. Personally chosen. Founder-verified.";
  const ctaText = banner.ctaText || 'SHOP THE FIRST EDIT';
  const ctaUrl = banner.ctaUrl || `/categories/${primaryCatSlug}`;
  const image = banner.image || DEFAULT_HERO.image;

  return (
    <div className="relative min-h-[80vh] w-full flex-shrink-0 snap-start overflow-hidden">
      {image && (
        <Image
          src={image}
          alt={banner.title || 'NEEJEE — The rare, the rooted, the personal.'}
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-50"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-kohl/80 via-kohl/40 to-transparent" />
      <div className="relative max-w-8xl mx-auto px-6 lg:px-12 min-h-[80vh] flex items-center">
        <div className="max-w-xl">
          <p className="label text-banarasi">FOUND. PERSONAL.</p>
          <h1 className="font-display text-5xl lg:text-7xl mt-4 leading-[1.05]">
            {isDefault ? (<>The rare, the rooted,<br />the personal.</>) : title}
          </h1>
          <p className="font-italic italic text-beige text-lg mt-6 max-w-md">{subtitle}</p>
          <div className="mt-10 flex gap-4 flex-wrap">
            <Link href={ctaUrl} className="btn-primary">{ctaText}</Link>
            <Link href="/about" className="font-ui text-xs tracking-widest text-ivory hover:text-banarasi underline underline-offset-4 self-center">
              WHY WE EXIST →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
