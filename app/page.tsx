// NEEJEE Homepage — built to Phase 2 spec
import Link from 'next/link';
import Image from 'next/image';
import { prisma } from '@/lib/prisma';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ProductCard, type ProductCardData } from '@/components/product/ProductCard';
import { HeroCarousel } from '@/components/home/HeroCarousel';
import { Sparkles, ShieldCheck, Truck, RotateCcw, HandCoins } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function getHomeData() {
  try {
    const now = new Date();
    const [founderEdit, newArrivals, allActive, categories, heroBanner, founderNotePage] = await Promise.all([
      // v23.40.22 — read latest active hero banner from CMS
      // (added inside Promise.all below)
      prisma.product.findMany({
        where: { status: 'ACTIVE', badges: { has: "FOUNDER'S EDIT" } },
        take: 6, orderBy: { createdAt: 'desc' },
        include: { variants: { select: { inventory: true, images: true } } },
      }),
      prisma.product.findMany({
        where: { status: 'ACTIVE' },
        take: 8, orderBy: { createdAt: 'desc' },
        include: { variants: { select: { inventory: true, images: true } } },
      }),
      prisma.product.findMany({
        where: { status: 'ACTIVE' },
        take: 4, orderBy: { createdAt: 'asc' },
        include: { variants: { select: { inventory: true, images: true } } },
      }),
      prisma.category.findMany({
        where: { products: { some: { status: 'ACTIVE' } } },
        select: { id: true, slug: true, name: true, products: { select: { id: true }, take: 1 } },
        take: 8,
      }),
      // v23.40.23 — ALL active hero banners (scrollable carousel)
      prisma.banner.findMany({
        where: {
          position: 'hero',
          active: true,
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
            { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
          ],
        },
        orderBy: { order: 'asc' },
      }),
      // v23.40.25.9 — CMS-driven founder note. Editable at /admin/cms (slug: home-founder-note)
      prisma.cmsPage.findUnique({
        where: { slug: 'home-founder-note' },
        select: { status: true, sections: true },
      }).catch(() => null),
    ]);

    // Extract founder note paragraphs from CMS (if published).
    // v23.40.26.0.6 — Capture title, body, and alignment from CMS.
    let founderNoteTitle: string | null = null;
    let founderNoteBody: string | null = null;
    let founderNoteAlign: 'left' | 'center' | 'justify' = 'center';
    let founderNoteAlignSet = false;
    if (founderNotePage && founderNotePage.status === 'PUBLISHED') {
      const sections = Array.isArray(founderNotePage.sections) ? founderNotePage.sections : [];
      for (const s of sections as any[]) {
        if (!s) continue;
        if (typeof s?.data?.title === 'string' && s.data.title.trim() && !founderNoteTitle) {
          founderNoteTitle = s.data.title.trim();
        }
        if (typeof s?.data?.body === 'string' && s.data.body.trim() && !founderNoteBody) {
          founderNoteBody = s.data.body.trim();
        }
        if (s?.data?.align && ['left','center','justify'].includes(s.data.align) && !founderNoteAlignSet) {
          founderNoteAlign = s.data.align as 'left' | 'center' | 'justify';
          founderNoteAlignSet = true;
        }
      }
    }
    const mapCard = (p: any): ProductCardData => {
      // v23.40.25.11 — fall back to variant images if Product.images is empty.
      // Some admin upload flows save into Variant.images only; without this,
      // the homepage shows a "No image" placeholder while the PDP looks fine.
      let imgs: string[] = Array.isArray(p.images) ? p.images.filter(Boolean) : [];
      if (imgs.length === 0 && Array.isArray(p.variants)) {
        for (const v of p.variants) {
          if (Array.isArray(v?.images) && v.images.length > 0) {
            imgs = v.images.filter(Boolean);
            if (imgs.length > 0) break;
          }
        }
      }
      return {
        id: p.id, slug: p.slug, name: p.name, poeticLine: p.poeticLine,
        craft: p.craft, region: p.region,
        mrp: p.mrp, sellingPrice: p.sellingPrice, salePrice: p.salePrice,
        saleStartsAt: p.saleStartsAt, saleEndsAt: p.saleEndsAt,
        images: imgs,
        badges: Array.isArray(p.badges) ? p.badges : [],
        aiTryOnEligible: !!p.aiTryOnEligible,
        inventory: p.variants.reduce((s: number, v: any) => s + (v.inventory || 0), 0),
      };
    };
    // Pick the best 'sarees-like' category for the hero CTA
    const primaryCat = categories.find((c: any) => /sare|women|textile/i.test(c.name + c.slug)) || categories[0];
    return {
      founder: founderEdit.length > 0 ? founderEdit.map(mapCard) : allActive.map(mapCard),
      newArrivals: newArrivals.map(mapCard),
      categories,
      primaryCatSlug: primaryCat?.slug || 'sarees',
      heroBanners: heroBanner as any[],  // v23.40.23 — plural
      founderNoteTitle,                  // v23.40.26.0.3 — CMS section.data.title (e.g. 'From the Founder')
      founderNoteBody,                   // v23.40.26.0.3 — CMS section.data.body (full text with \n\n paragraph breaks)
      founderNoteAlign,                  // v23.40.26.0.6 — 'left' | 'center' | 'justify' from CMS
    };
  } catch (e: any) {
    console.warn('[home] DB query failed:', e.message);
    return { founder: [], newArrivals: [], categories: [], heroBanners: [], founderNoteTitle: null, founderNoteBody: null, founderNoteAlign: 'center' as const, error: e.message };
  }
}

// Slugs MUST match either static stories in lib/data.ts or published CMS journal pages.
const JOURNAL_FALLBACK = [
  { slug: 'why-we-built-neejee', title: 'Why we built NEEJEE', excerpt: 'I searched for years for the things I knew existed in India, and found nothing good enough online. So I built it.', image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=800&q=80' },
  { slug: 'fourteen-days-on-a-loom', title: 'Fourteen days on a loom', excerpt: 'Fourteen days of weaving. One saree. Three generations.', image: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=800&q=80' },
  { slug: 'how-to-store-a-banarasi', title: 'How to store a Banarasi', excerpt: 'Wrap it in muslin, not plastic. Refold it once a season. Let it breathe.', image: 'https://images.unsplash.com/photo-1583394293214-28a4b6cdf5b2?w=800&q=80' },
];

export default async function HomePage() {
  const data = await getHomeData();

  return (
    <>
      <Header />

      {/* HERO — v23.40.23: scrollable carousel of CMS-driven hero banners with default fallback */}
      <HeroCarousel
        banners={(data as any).heroBanners || []}
        primaryCatSlug={data.primaryCatSlug || 'sarees'}
      />

      {/* TRUST STRIP */}
      <section className="bg-beige border-y border-mitti/20">
        <div className="max-w-8xl mx-auto px-6 lg:px-12 py-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: ShieldCheck, label: 'AUTHENTICITY GUARANTEED', sub: 'Founder-verified craft' },
            { icon: Truck, label: 'FREE SHIPPING', sub: 'Above ₹2,500 across India' },
            { icon: RotateCcw, label: '7-DAY RETURNS', sub: 'No questions asked' },
            { icon: HandCoins, label: 'FAIR TO MAKERS', sub: 'Direct artisan payouts' },
          ].map(t => (
            <div key={t.label} className="flex items-center gap-3">
              <t.icon className="w-6 h-6 text-madder flex-shrink-0" />
              <div>
                <p className="font-ui text-[10px] tracking-widest text-kohl">{t.label}</p>
                <p className="font-italic italic text-mitti text-sm">{t.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FOUNDER'S EDIT — featured products */}
      {data.founder.length > 0 && (
        <section className="max-w-8xl mx-auto px-6 lg:px-12 py-20">
          <div className="flex items-baseline justify-between mb-10">
            <div>
              <p className="label text-madder">THE FIRST EDIT</p>
              <h2 className="font-display text-4xl lg:text-5xl text-kohl mt-2">Founder's Edit</h2>
              <p className="font-italic italic text-mitti mt-2">Hand-picked by Nidhi · Limited drop</p>
            </div>
            <Link href={`/categories/${data.primaryCatSlug || 'sarees'}`} className="font-ui text-xs tracking-widest text-madder hover:underline">
              VIEW ALL →
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 lg:gap-8">
            {data.founder.slice(0, 4).map(p => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}

      {/* FOUNDER NOTE — CMS-driven. Headline always centered. Body alignment from CMS (default: center). */}
      <section className="bg-beige py-16 md:py-24">
        <div className="max-w-3xl mx-auto px-6">
          {data.founderNoteTitle && (
            <h2 className="font-display text-3xl md:text-4xl text-kohl mb-10 text-center">{data.founderNoteTitle}</h2>
          )}
          {(() => {
            const fullBody = data.founderNoteBody || `It began with one saree. Woven by Ramji bhai in Varanasi, over fourteen days, on a pit-loom older than him.

And then I realised he was one of thousands. The weavers, the potters, the carpenters, the brassworkers, the attar-makers, the dyers, the embroiderers, the hands that have shaped India for centuries, were vanishing into the noise of glass-fronted malls and over-hyped digital platforms.

So I built one place to find them. One spotlight. One honest price.

Nidhi Chauhan`;
            const paragraphs = fullBody.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
            let signature: string | null = null;
            const last = paragraphs[paragraphs.length - 1];
            if (last && last.length < 60 && !last.endsWith('.') && !last.includes('\n')) {
              signature = last;
              paragraphs.pop();
            }
            const alignClass = data.founderNoteAlign === 'justify' ? 'text-justify'
                             : data.founderNoteAlign === 'left' ? 'text-left'
                             : 'text-center';
            return (
              <>
                <div className={`font-body text-kohl/80 text-[15px] md:text-base leading-[1.85] space-y-5 ${alignClass}`} style={{ textAlign: data.founderNoteAlign || 'center' }}>
                  {paragraphs.map((p, i) => (<p key={i}>{p}</p>))}
                </div>
                {signature && (
                  <div className="mt-10 pt-6 border-t border-madder/20 flex justify-center">
                    <p className="font-display italic text-mitti text-lg">{signature}</p>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </section>

      {/* NEW ARRIVALS */}
      {data.newArrivals.length > 0 && (
        <section className="bg-beige py-20">
          <div className="max-w-8xl mx-auto px-6 lg:px-12">
            <div className="flex items-baseline justify-between mb-10">
              <div>
                <p className="label text-madder">NEW IN</p>
                <h2 className="font-display text-4xl text-kohl mt-2">Just arrived</h2>
              </div>
              <Link href={`/categories/${data.primaryCatSlug || 'sarees'}?sort=newest`} className="font-ui text-xs tracking-widest text-madder hover:underline">
                BROWSE ALL →
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 lg:gap-8">
              {data.newArrivals.slice(0, 4).map(p => <ProductCard key={p.id} product={p} />)}
            </div>
          </div>
        </section>
      )}

      {/* AI TILE */}
      <section className="max-w-8xl mx-auto px-6 lg:px-12 py-20">
        <div className="bg-kohl text-ivory p-10 lg:p-16 relative overflow-hidden">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <p className="label text-banarasi flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> NEEJEE AI
              </p>
              <h2 className="font-display text-4xl lg:text-5xl mt-4">See it on you.<br/>See it in your home.</h2>
              <p className="font-italic italic text-beige/80 text-lg mt-4 max-w-md">
                Try sarees on with the Mirror. Place stoneware in your room with Space. Find the perfect gift with the Concierge.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link href="/ai/mirror" className="btn-primary">TRY THE MIRROR</Link>
                <Link href="/ai/gift" className="font-ui text-xs tracking-widest text-ivory hover:text-banarasi self-center underline underline-offset-4">
                  GIFT CONCIERGE →
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {['Mirror', 'Space', 'Gift'].map(s => (
                <div key={s} className="aspect-square bg-mitti/30 flex items-center justify-center">
                  <p className="font-display text-lg text-banarasi">{s}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* STORIES / JOURNAL */}
      <section className="bg-beige py-20">
        <div className="max-w-8xl mx-auto px-6 lg:px-12">
          <div className="text-center mb-12">
            <p className="label text-madder">STORIES</p>
            <h2 className="font-display text-4xl text-kohl mt-2">From the Journal</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            {JOURNAL_FALLBACK.map(j => (
              <Link key={j.slug} href={`/journal/${j.slug}`} className="group">
                <div className="aspect-[4/3] bg-ivory overflow-hidden">
                  <Image src={j.image} alt={j.title} width={800} height={600}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                </div>
                <h3 className="font-display text-xl text-kohl mt-4 group-hover:text-madder transition-colors">{j.title}</h3>
                <p className="font-italic italic text-mitti text-sm mt-2">{j.excerpt}</p>
                <p className="font-ui text-xs tracking-widest text-madder mt-3">READ →</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* NEWSLETTER */}
      <section className="max-w-3xl mx-auto px-6 py-20 text-center">
        <p className="label text-madder">STAY IN THE TRUNK</p>
        <h2 className="font-display text-3xl text-kohl mt-3">Get our limited drops first.</h2>
        <p className="font-italic italic text-mitti mt-3">No spam. Just craft, once a week.</p>
        <form className="mt-8 flex gap-3 max-w-md mx-auto">
          <input type="email" required placeholder="Your email" className="flex-1 p-3 bg-beige border border-mitti/20 font-ui text-sm" />
          <button type="submit" className="btn-primary">SUBSCRIBE</button>
        </form>
      </section>

      <Footer />
    </>
  );
}
