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
  title: 'The First Edit',
  subtitle: "India's finest craft, personally chosen.",
  image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=1920&q=80',
  ctaText: 'EXPLORE THE EDIT',
  ctaUrl: null,
};

const AUTOPLAY_MS = 7500;

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
      className="group/hero relative overflow-hidden border-b border-mitti/15 bg-beige"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar"
        style={{ scrollbarWidth: 'none' }}
      >
        {slides.map((banner, index) => (
          <HeroSlide key={banner.id || index} banner={banner} primaryCatSlug={primaryCatSlug} />
        ))}
      </div>

      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => setActive(a => (a - 1 + slides.length) % slides.length)}
            aria-label="Previous banner"
            className="hidden lg:flex absolute left-7 top-1/2 -translate-y-1/2 z-20 w-9 h-9 items-center justify-center border border-ivory/45 bg-kohl/5 text-ivory opacity-0 group-hover/hero:opacity-100 transition-opacity"
          >
            <ChevronLeft className="w-4 h-4" strokeWidth={1.1} />
          </button>
          <button
            type="button"
            onClick={() => setActive(a => (a + 1) % slides.length)}
            aria-label="Next banner"
            className="hidden lg:flex absolute right-7 top-1/2 -translate-y-1/2 z-20 w-9 h-9 items-center justify-center border border-ivory/45 bg-kohl/5 text-ivory opacity-0 group-hover/hero:opacity-100 transition-opacity"
          >
            <ChevronRight className="w-4 h-4" strokeWidth={1.1} />
          </button>
        </>
      )}

      {slides.length > 1 && (
        <div className="absolute bottom-5 right-6 md:right-10 z-20 flex items-center gap-2">
          {slides.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setActive(index)}
              aria-label={`Show banner ${index + 1}`}
              className={`h-px transition-all ${active === index ? 'w-8 bg-ivory' : 'w-4 bg-ivory/45'}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function HeroSlide({ banner, primaryCatSlug }: { banner: HeroBanner; primaryCatSlug: string }) {
  const eyebrow = banner.title || 'The First Edit';
  const subtitle = banner.subtitle || "India's finest craft, personally chosen.";
  const ctaText = banner.ctaText || 'EXPLORE THE EDIT';
  const ctaUrl = banner.ctaUrl || `/categories/${canonicalPrimaryCategorySlug(primaryCatSlug)}`;
  const image = banner.image || DEFAULT_HERO.image;

  return (
    <div className="relative h-[64svh] min-h-[500px] max-h-[720px] md:h-[68vh] md:min-h-[570px] w-full flex-shrink-0 snap-start overflow-hidden">
      <Image
        src={image}
        alt="NEEJEE — The rare, the rooted, the personal."
        fill
        priority
        sizes="100vw"
        className="object-cover object-[62%_center] md:object-center saturate-[0.78] contrast-[0.96] brightness-[0.94]"
      />

      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(244,239,230,0.94)_0%,rgba(244,239,230,0.83)_25%,rgba(244,239,230,0.42)_45%,rgba(244,239,230,0.04)_70%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(26,22,19,0.02),transparent_64%,rgba(26,22,19,0.10))]" />

      <div className="relative h-full mx-auto max-w-[1680px] px-6 sm:px-10 lg:px-16 xl:px-20 flex items-center">
        <div className="max-w-[560px]">
          <p className="font-ui text-[8px] sm:text-[9px] tracking-[0.26em] uppercase text-madder mb-5">{eyebrow}</p>
          <h1 className="font-display text-[45px] leading-[0.98] sm:text-[55px] lg:text-[64px] xl:text-[68px] text-kohl max-w-[9.5ch] tracking-[-0.035em]">
            The rare,<br />the rooted,<br />the personal.
          </h1>
          <div className="w-10 h-px bg-madder mt-5" />
          <p className="font-display italic text-[15px] md:text-[17px] text-mitti mt-5 max-w-[28rem] leading-relaxed">{subtitle}</p>
          <p className="font-ui text-[8px] tracking-[0.24em] uppercase text-kohl/70 mt-4">FOUND. PERSONAL.</p>
          <Link
            href={ctaUrl}
            className="inline-block mt-7 bg-madder text-ivory px-6 py-3 font-ui text-[9px] tracking-[0.2em] uppercase border border-madder hover:bg-[#742522] hover:border-[#742522] transition-colors"
          >
            {ctaText}
          </Link>
        </div>
      </div>
    </div>
  );
}
