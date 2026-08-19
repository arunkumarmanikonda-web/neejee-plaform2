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
      className="group/hero relative overflow-hidden border-b border-mitti/20 bg-beige"
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
            className="hidden lg:flex absolute left-6 top-1/2 -translate-y-1/2 z-20 w-11 h-11 items-center justify-center border border-ivory/55 bg-kohl/15 text-ivory backdrop-blur-sm opacity-0 group-hover/hero:opacity-100 transition-all hover:bg-kohl/35"
          >
            <ChevronLeft className="w-5 h-5" strokeWidth={1.25} />
          </button>
          <button
            type="button"
            onClick={() => setActive(a => (a + 1) % slides.length)}
            aria-label="Next banner"
            className="hidden lg:flex absolute right-6 top-1/2 -translate-y-1/2 z-20 w-11 h-11 items-center justify-center border border-ivory/55 bg-kohl/15 text-ivory backdrop-blur-sm opacity-0 group-hover/hero:opacity-100 transition-all hover:bg-kohl/35"
          >
            <ChevronRight className="w-5 h-5" strokeWidth={1.25} />
          </button>
        </>
      )}

      {slides.length > 1 && (
        <div className="absolute bottom-5 right-5 md:right-9 z-20 flex items-center gap-2.5">
          {slides.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setActive(idx)}
              aria-label={`Show banner ${idx + 1}`}
              className={`h-[2px] transition-all ${active === idx ? 'w-9 bg-ivory' : 'w-4 bg-ivory/45 hover:bg-ivory/75'}`}
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
    <div className="relative h-[72svh] min-h-[560px] max-h-[790px] md:h-[74vh] md:min-h-[620px] w-full flex-shrink-0 snap-start overflow-hidden">
      {image && (
        <Image
          src={image}
          alt={banner.title || 'NEEJEE — The rare, the rooted, the personal.'}
          fill
          priority
          sizes="100vw"
          className="object-cover object-[62%_center] sm:object-[60%_center] lg:object-center scale-[1.015]"
        />
      )}

      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(244,239,230,0.97)_0%,rgba(244,239,230,0.91)_26%,rgba(244,239,230,0.62)_42%,rgba(244,239,230,0.18)_58%,rgba(26,22,19,0.08)_100%)] md:bg-[linear-gradient(90deg,rgba(244,239,230,0.95)_0%,rgba(244,239,230,0.86)_24%,rgba(244,239,230,0.42)_43%,rgba(244,239,230,0.02)_68%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(26,22,19,0.03)_0%,rgba(26,22,19,0)_56%,rgba(26,22,19,0.17)_100%)]" />

      <div className="relative h-full mx-auto max-w-[1680px] px-6 sm:px-10 lg:px-16 xl:px-20 flex items-center">
        <div className="max-w-[650px] -translate-y-2 md:-translate-y-4">
          <h1 className="font-display text-[49px] leading-[0.98] sm:text-[64px] lg:text-[74px] xl:text-[82px] text-kohl max-w-[9.2ch] tracking-[-0.035em] drop-shadow-[0_1px_0_rgba(244,239,230,0.2)]">
            {isDefault ? (<>The rare,<br />the rooted,<br />the personal.</>) : title}
          </h1>
          <div className="w-12 h-px bg-madder mt-5 md:mt-6" />
          <p className="font-ui text-[11px] sm:text-[12px] tracking-[0.28em] uppercase text-kohl/78 mt-5 md:mt-6 max-w-[38rem] leading-[1.8]">
            {isDefault ? 'FOUND. PERSONAL.' : subtitle}
          </p>
          {!isDefault && (
            <p className="font-display italic text-[16px] md:text-[18px] text-mitti/90 mt-2 max-w-[31rem] leading-relaxed">{subtitle}</p>
          )}
          <div className="mt-7 md:mt-8 flex items-center gap-5">
            <Link href={ctaUrl} className="bg-madder text-ivory px-7 md:px-8 py-3.5 md:py-4 font-display text-[16px] md:text-[17px] tracking-[0.02em] border border-madder transition-colors hover:bg-[#742522] hover:border-[#742522]">
              {ctaText}
            </Link>
          </div>
        </div>
      </div>

      <div className="absolute left-0 right-0 bottom-0 h-px bg-ivory/30" />
    </div>
  );
}
