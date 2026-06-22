// Renders a CMS section block - used by both the admin editor preview and public CMS pages.
// Server-safe definitions live in lib/cms-sections.ts; this file owns the React component.
'use client';
import Link from 'next/link';
import { useState } from 'react';
import {
  SECTION_TYPES,
  defaultData,
  isSectionVisibleNow,
  type Section,
  type SectionType,
  type VisibilityRules,
} from '@/lib/cms-sections';

// Re-export for back-compat with existing imports
export { SECTION_TYPES, defaultData, isSectionVisibleNow };
export type { Section, SectionType, VisibilityRules };

export function SectionRenderer({ section }: { section: Section }) {
  const { type, data } = section;

  if (!isSectionVisibleNow(section)) return null;

  // ===== HERO =====
  // v23.40.24 — full-bleed background image + dark gradient overlay so text
  // reads cleanly even on a busy product photo. No image → solid colour fallback.
  if (type === 'hero') {
    return (
      <section className={`relative overflow-hidden ${data.dark ? 'bg-kohl text-ivory' : 'bg-ivory text-kohl'} py-20 md:py-32 px-6`}>
        {data.image && (
          <>
            <div className="absolute inset-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={data.image} alt={data.title} className="w-full h-full object-cover" />
            </div>
            {/* Legibility overlay — stronger when dark theme is on */}
            <div className={`absolute inset-0 ${data.dark ? 'bg-kohl/65' : 'bg-ivory/55'}`} />
            <div className={`absolute inset-0 bg-gradient-to-b ${data.dark ? 'from-kohl/40 via-transparent to-kohl/70' : 'from-ivory/30 via-transparent to-ivory/70'}`} />
          </>
        )}
        <div className="relative max-w-4xl mx-auto text-center">
          {data.eyebrow && <p className="text-xs tracking-[0.3em] text-banarasi mb-4">{data.eyebrow}</p>}
          <h1 className="font-display text-5xl md:text-7xl mb-6">{data.title}</h1>
          {data.subtitle && <p className="text-lg opacity-80 max-w-2xl mx-auto mb-8">{data.subtitle}</p>}
          {data.ctaText && (
            <Link href={data.ctaUrl || '#'} className="inline-block bg-madder text-ivory px-8 py-3 tracking-[0.2em] text-sm hover:bg-madder/90">
              {data.ctaText}
            </Link>
          )}
        </div>
      </section>
    );
  }

  // ===== VIDEO HERO =====
  if (type === 'videoHero') {
    return (
      <section className="relative bg-kohl text-ivory overflow-hidden">
        {data.videoUrl ? (
          <video
            src={data.videoUrl}
            poster={data.poster || undefined}
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 w-full h-full object-cover opacity-60"
          />
        ) : data.poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.poster} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60" />
        ) : null}
        <div className="relative max-w-4xl mx-auto text-center py-32 md:py-48 px-6">
          {data.eyebrow && <p className="text-xs tracking-[0.3em] text-banarasi mb-4">{data.eyebrow}</p>}
          <h1 className="font-display text-5xl md:text-7xl mb-6">{data.title}</h1>
          {data.subtitle && <p className="font-italic italic text-xl opacity-80 max-w-2xl mx-auto mb-8">{data.subtitle}</p>}
          {data.ctaText && (
            <Link href={data.ctaUrl || '#'} className="inline-block border border-ivory text-ivory px-8 py-3 tracking-[0.2em] text-sm hover:bg-ivory hover:text-kohl transition-colors">
              {data.ctaText}
            </Link>
          )}
        </div>
      </section>
    );
  }

  // ===== TEXT =====
  if (type === 'text') {
    const align = ['left','center','right','justify'].includes(data.align) ? data.align : 'center';
    const titleAlignClass = 'text-center'; // headline always centered per brand standard
    const bodyAlignClass = align === 'justify' ? 'text-justify'
                        : align === 'left' ? 'text-left'
                        : align === 'right' ? 'text-right'
                        : 'text-center';
    return (
      <section className="max-w-3xl mx-auto px-6 py-12">
        {data.title && <h2 className={`font-display text-3xl md:text-4xl text-kohl mb-8 ${titleAlignClass}`}>{data.title}</h2>}
        <div className={`font-body text-kohl/80 leading-relaxed whitespace-pre-wrap ${bodyAlignClass}`} style={{ textAlign: align as any }}>{data.body}</div>
      </section>
    );
  }

  // ===== IMAGE =====
  if (type === 'image') {
    if (!data.url) {
      return <div className="max-w-5xl mx-auto px-6 py-8"><div className="aspect-video bg-kohl/5 border border-dashed border-kohl/20 flex items-center justify-center text-mitti italic">Image placeholder</div></div>;
    }
    return (
      <section className="max-w-5xl mx-auto px-6 py-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={data.url} alt={data.alt || ''} className="w-full" />
        {data.caption && <p className="font-italic italic text-mitti text-sm text-center mt-3">{data.caption}</p>}
      </section>
    );
  }

  // ===== IMAGE GRID =====
  if (type === 'imageGrid') {
    const cols = data.columns || 3;
    const gridCls = cols === 2 ? 'grid-cols-2' : cols === 4 ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-3';
    return (
      <section className="max-w-6xl mx-auto px-6 py-12">
        <div className={`grid ${gridCls} gap-4`}>
          {(data.items || []).map((it: any, i: number) => (
            it.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={it.url} alt={it.alt || ''} className="w-full aspect-square object-cover" />
            ) : <div key={i} className="aspect-square bg-kohl/5" />
          ))}
        </div>
      </section>
    );
  }

  // ===== LOOKBOOK =====
  if (type === 'lookbook') {
    const items = data.items || [];
    return (
      <section className="max-w-7xl mx-auto px-6 py-16">
        {data.title && <h2 className="font-display text-3xl md:text-4xl text-kohl mb-8 text-center">{data.title}</h2>}
        {data.layout === 'stacked' ? (
          <div className="space-y-12">
            {items.map((it: any, i: number) => (
              <div key={i} className="max-w-3xl mx-auto">
                {it.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.url} alt="" className="w-full" />
                ) : <div className="aspect-[3/4] bg-kohl/5" />}
                {it.caption && <p className="font-italic italic text-mitti text-center mt-4">{it.caption}</p>}
              </div>
            ))}
          </div>
        ) : data.layout === 'grid' ? (
          <div className="grid md:grid-cols-2 gap-6">
            {items.map((it: any, i: number) => (
              <div key={i}>
                {it.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.url} alt="" className="w-full aspect-[3/4] object-cover" />
                ) : <div className="aspect-[3/4] bg-kohl/5" />}
                {it.caption && <p className="font-italic italic text-mitti text-sm mt-2">{it.caption}</p>}
              </div>
            ))}
          </div>
        ) : (
          // asymmetric (default)
          <div className="grid md:grid-cols-12 gap-4">
            {items.map((it: any, i: number) => {
              const span = i % 3 === 0 ? 'md:col-span-7' : i % 3 === 1 ? 'md:col-span-5' : 'md:col-span-12';
              const aspect = i % 3 === 2 ? 'aspect-[16/7]' : 'aspect-[3/4]';
              return (
                <div key={i} className={span}>
                  {it.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.url} alt="" className={`w-full ${aspect} object-cover`} />
                  ) : <div className={`${aspect} bg-kohl/5`} />}
                  {it.caption && <p className="font-italic italic text-mitti text-sm mt-2">{it.caption}</p>}
                </div>
              );
            })}
          </div>
        )}
      </section>
    );
  }

  // ===== FOUNDER NOTE =====
  if (type === 'founderNote') {
    return (
      <section className="max-w-3xl mx-auto px-6 py-16 text-center">
        <p className="font-italic italic text-mitti text-lg leading-relaxed whitespace-pre-wrap">{data.body}</p>
        <p className="font-display text-2xl text-kohl mt-6">— {data.name}</p>
        <p className="text-xs tracking-[0.2em] text-mitti mt-1">{data.title}</p>
      </section>
    );
  }

  // ===== JOURNAL ENTRY =====
  if (type === 'journalEntry') {
    return (
      <article className="max-w-3xl mx-auto px-6 py-16">
        {data.heroImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.heroImage} alt={data.title} className="w-full aspect-[16/9] object-cover mb-12" />
        )}
        <div className="flex items-center gap-4 text-xs tracking-[0.2em] text-mitti mb-4">
          <span>BY {data.author?.toUpperCase() || 'NEEJEE'}</span>
          <span>·</span>
          <time>{data.date ? new Date(data.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}</time>
        </div>
        <h1 className="font-display text-4xl md:text-5xl text-kohl mb-6">{data.title}</h1>
        {data.excerpt && <p className="font-italic italic text-xl text-mitti leading-relaxed mb-8">{data.excerpt}</p>}
        <div className="madder-divider mb-8" />
        <div className="font-body text-kohl/85 leading-relaxed whitespace-pre-wrap text-lg">{data.body}</div>
      </article>
    );
  }

  // ===== SPLIT SECTION =====
  if (type === 'splitSection') {
    const isImageLeft = (data.imagePosition || 'left') === 'left';
    const ImagePart = (
      <div className="md:flex-1">
        {data.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.image} alt={data.title || ''} className="w-full aspect-[4/5] object-cover" />
        ) : (
          <div className="aspect-[4/5] bg-kohl/5" />
        )}
      </div>
    );
    const TextPart = (
      <div className="md:flex-1 px-6 md:px-12 py-12 flex flex-col justify-center">
        <h2 className="font-display text-3xl md:text-4xl text-kohl mb-4">{data.title}</h2>
        <p className="font-body text-kohl/75 leading-relaxed whitespace-pre-wrap">{data.body}</p>
        {data.ctaText && (
          <Link href={data.ctaUrl || '#'} className="inline-block mt-6 text-madder text-sm tracking-widest hover:underline self-start">
            {data.ctaText} →
          </Link>
        )}
      </div>
    );
    return (
      <section className="max-w-7xl mx-auto py-12">
        <div className={`flex flex-col md:flex-row ${isImageLeft ? '' : 'md:flex-row-reverse'}`}>
          {ImagePart}
          {TextPart}
        </div>
      </section>
    );
  }

  // ===== FEATURE GRID =====
  if (type === 'featureGrid') {
    const cols = data.columns || 3;
    const gridCls = cols === 2 ? 'md:grid-cols-2' : cols === 4 ? 'md:grid-cols-4' : 'md:grid-cols-3';
    return (
      <section className="max-w-6xl mx-auto px-6 py-16">
        {data.title && <h2 className="font-display text-3xl text-kohl text-center mb-12">{data.title}</h2>}
        <div className={`grid grid-cols-1 ${gridCls} gap-8`}>
          {(data.items || []).map((it: any, i: number) => (
            <div key={i} className="text-center">
              <div className="font-display text-4xl text-madder mb-3">{it.icon || '✦'}</div>
              <h3 className="font-display text-xl text-kohl mb-2">{it.title}</h3>
              <p className="text-sm text-kohl/70 leading-relaxed">{it.body}</p>
            </div>
          ))}
        </div>
      </section>
    );
  }

  // ===== TESTIMONIAL =====
  if (type === 'testimonial') {
    return (
      <section className="max-w-3xl mx-auto px-6 py-16 text-center">
        {data.photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.photo} alt={data.author} className="w-20 h-20 rounded-full object-cover mx-auto mb-6" />
        )}
        {data.rating > 0 && (
          <div className="flex justify-center gap-1 mb-4 text-madder">
            {Array.from({ length: data.rating }).map((_, i) => <span key={i}>★</span>)}
          </div>
        )}
        <p className="font-italic italic text-2xl md:text-3xl text-kohl leading-relaxed">“{data.text}”</p>
        <p className="font-display text-lg text-kohl mt-6">{data.author}</p>
        {data.location && <p className="text-xs tracking-wider text-mitti mt-1">{data.location}</p>}
      </section>
    );
  }

  // ===== ACCORDION =====
  if (type === 'accordion') {
    return (
      <section className="max-w-3xl mx-auto px-6 py-16">
        {data.title && <h2 className="font-display text-3xl text-kohl mb-8 text-center">{data.title}</h2>}
        <div className="space-y-2">
          {(data.items || []).map((it: any, i: number) => (
            <AccordionItem key={i} question={it.question} answer={it.answer} />
          ))}
        </div>
      </section>
    );
  }

  // ===== PRODUCT CAROUSEL (placeholder; public page resolves real products) =====
  if (type === 'productCarousel') {
    return (
      <section className="max-w-7xl mx-auto px-6 py-12">
        <h2 className="font-display text-3xl text-kohl mb-6">{data.title}</h2>
        <div className="border border-dashed border-kohl/20 p-8 text-center text-kohl/40">
          Product Carousel · source: {data.source} · limit: {data.limit}
        </div>
      </section>
    );
  }

  // ===== QUOTE =====
  if (type === 'quote') {
    return (
      <section className="max-w-3xl mx-auto px-6 py-16 text-center">
        <p className="font-display text-3xl md:text-4xl text-kohl leading-relaxed">“{data.text}”</p>
        {data.attribution && <p className="text-sm tracking-wider text-mitti mt-4">{data.attribution}</p>}
      </section>
    );
  }

  // ===== MARQUEE =====
  if (type === 'marquee') {
    const speed = Math.max(10, Math.min(120, data.speed || 30));
    return (
      <section className="bg-kohl text-ivory py-4 overflow-hidden">
        <div
          className="whitespace-nowrap inline-block"
          style={{ animation: `cms-marquee ${speed}s linear infinite` }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i} className="font-display text-lg tracking-[0.3em] mx-8">{data.text}</span>
          ))}
        </div>
        <style jsx>{`
          @keyframes cms-marquee {
            from { transform: translateX(0); }
            to { transform: translateX(-50%); }
          }
        `}</style>
      </section>
    );
  }

  // ===== DIVIDER =====
  if (type === 'divider') {
    return <div className="max-w-2xl mx-auto px-6 py-6"><div className="h-px bg-madder/60" /></div>;
  }

  // ===== CTA =====
  if (type === 'cta') {
    return (
      <section className="bg-beige py-16 px-6 text-center">
        {data.eyebrow && <p className="text-xs tracking-[0.3em] text-madder mb-3">{data.eyebrow}</p>}
        <h2 className="font-display text-4xl text-kohl mb-3">{data.title}</h2>
        {data.body && <p className="text-kohl/70 mb-6">{data.body}</p>}
        {data.ctaText && (
          <Link href={data.ctaUrl || '#'} className="inline-block bg-kohl text-ivory px-8 py-3 tracking-[0.2em] text-sm hover:bg-kohl/90">
            {data.ctaText}
          </Link>
        )}
      </section>
    );
  }

  return null;
}

// Sub-component: AccordionItem with local state for collapse
function AccordionItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-mitti/20">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full py-4 flex items-center justify-between text-left hover:text-madder"
      >
        <span className="font-ui text-kohl">{question}</span>
        <span className={`text-madder transition-transform ${open ? 'rotate-45' : ''}`}>+</span>
      </button>
      {open && (
        <div className="pb-4 text-kohl/75 leading-relaxed whitespace-pre-wrap">{answer}</div>
      )}
    </div>
  );
}
