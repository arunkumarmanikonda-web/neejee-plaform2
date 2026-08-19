'use client';

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

const DEFAULT_HERO = {
  id: 'default',
  title: null,
  subtitle: null,
  image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=1920&q=80',
  ctaText: 'SHOP THE FIRST EDIT',
  ctaUrl: null,
};

const AUTOPLAY_MS = 6500;

function canonicalPrimaryCategorySlug(slug: string) {
  return slug === 'sarees' ? 'women-sarees' : slug;
}

export function HeroCarousel({ banners, primaryCatSlug }: Props) {
  const slides = banners.length > 0 ? banners : [DEFAULT_HERO];
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (paused || slides.length <= 1) return;
    const t = setInterval(() => setActive(a => (a + 1) % slides.length), AUTOPLAY_MS);
    return () => clearInterval(t);
  }, [paused, slides.length]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const slide = el.children[active] as HTMLElement | undefined;
    if (slide) el.scrollTo({ left: slide.offsetLeft, behavior: 'smooth' });
  }, [active]);

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const next = Math.round(el.scrollLeft / el.clientWidth);
    if (next !== active && next >= 0 && next < slides.length) setActive(next);
  };

  return (
    <section
      className="relative overflow-hidden border-b border-mitti/15 bg-beige"
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

      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => setActive(a => (a - 1 + slides.length) % slides.length)}
            aria-label="Previous banner"
            className="hidden md:flex absolute left-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 items-center justify-center border border-kohl/25 bg-ivory/75 backdrop-blur-sm text-kohl hover:bg-ivory transition"
          >
            <ChevronLeft className="w-5 h-5" strokeWidth={1.4} />
          </button>
          <button
            type="button"
            onClick={() => setActive(a => (a + 1) % slides.length)}
            aria-label="Next banner"
            className="hidden md:flex absolute right-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 items-center justify-center border border-kohl/25 bg-ivory/75 backdrop-blur-sm text-kohl hover:bg-ivory transition"
          >
            <ChevronRight className="w-5 h-5" strokeWidth={1.4} />
          </button>
        </>
      )}

      {slides.length > 1 && (
        <div className="absolute bottom-5 right-5 md:right-10 z-20 flex items-center gap-2 bg-ivory/70 backdrop-blur-sm px-3 py-2">
          {slides.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setActive(idx)}
              aria-label={`Show banner ${idx + 1}`}
              className={`h-1.5 rounded-full transition-all ${active === idx ? 'w-7 bg-madder' : 'w-2 bg-mitti/35 hover:bg-mitti/60'}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function HeroSlide({ banner, primaryCatSlug }: { banner: HeroBanner; primaryCatSlug: string }) {
  const isDefault = banner.id === 'default';
  const title = banner.title || 'The rare, the rooted, the personal.';
  const subtitle = banner.subtitle || "India's finest craft, personally chosen and founder-verified.";
  const ctaText = banner.ctaText || 'SHOP THE FIRST EDIT';
  const ctaUrl = banner.ctaUrl || `/categories/${canonicalPrimaryCategorySlug(primaryCatSlug)}`;
  const image = banner.image || DEFAULT_HERO.image;

  return (
    <div className="relative min-h-[600px] h-[72vh] max-h-[760px] sm:min-h-[620px] w-full flex-shrink-0 snap-start overflow-hidden">
      {image && (
        <Image
          src={image}
          alt={banner.title || 'NEEJEE — The rare, the rooted, the personal.'}
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
      )}

      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(244,239,230,0.98)_0%,rgba(244,239,230,0.92)_24%,rgba(244,239,230,0.56)_43%,rgba(244,239,230,0.08)_67%,rgba(244,239,230,0)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(26,22,19,0.04)_0%,rgba(26,22,19,0)_45%,rgba(26,22,19,0.08)_100%)]" />

      <div className="relative h-full mx-auto max-w-[1680px] px-6 sm:px-10 lg:px-16 flex items-center">
        <div className="max-w-[620px] pt-6">
          <p className="editorial-kicker">FOUND. PERSONAL.</p>
          <h1 className="font-display text-[48px] sm:text-[62px] lg:text-[72px] leading-[0.98] text-kohl mt-5 max-w-[10ch]">
            {isDefault ? (<>The rare,<br />the rooted,<br />the personal.</>) : title}
          </h1>
          <div className="madder-divider mt-6" />
          <p className="font-display tracking-[0.12em] uppercase text-[14px] sm:text-[16px] text-mitti mt-5">{subtitle}</p>
          <div className="mt-7 flex flex-wrap items-center gap-5">
            <Link href={ctaUrl} className="btn-primary">{ctaText}</Link>
            <Link href="/about" className="micro-link text-kohl/80 hover:text-madder">THE NEEJEE STORY →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
