import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ProductCard, type ProductCardData } from '@/components/product/ProductCard';
import { PitariCounter } from '@/components/home/Pitari';
import { HeroCarousel } from '@/components/home/HeroCarousel';
import { resolveMedia } from '@/lib/catalog/media-read';
import { buildPricing } from '@/lib/catalog/pricing-read';
import { formatINR } from '@/lib/money';
import type { Prisma } from '@prisma/client';
import { Gift, LampDesk, Shirt } from 'lucide-react';

export const revalidate = 60;
export const runtime = 'nodejs';

function publicProductWhere(): Prisma.ProductWhereInput {
  return {
    status: 'ACTIVE',
    takedownAt: null,
    catalogueExclude: false,
    OR: [
      { catalogueStockVisibility: { in: ['SHOW_ALL', 'HIDE_STOCK'] } },
      {
        AND: [
          { catalogueStockVisibility: 'IN_STOCK_ONLY' },
          { variants: { some: { inventory: { gt: 0 } } } },
        ],
      },
    ],
  };
}

async function getHomeData() {
  try {
    const now = new Date();
    const publicWhere = publicProductWhere();

    // Keep reads sequential for the intentionally small production serverless pool.
    const media = { variants: { select: { id: true, inventory: true, images: true } } } as const;
    const curated: Prisma.ProductWhereInput = { OR: [
      { cataloguePinHero: true }, { catalogueFeatured: true }, { catalogueEditorial: true },
      { badges: { hasSome: ["FOUNDER'S EDIT", 'FOUNDERS_EDIT'] } },
    ] };
    const lead = await prisma.product.findFirst({
      where: { AND: [
        publicWhere,
        { catalogueImageApproved: true, sellingPrice: { gt: 0 }, variants: { some: { inventory: { gt: 0 } } } },
        { OR: [
          { cataloguePreferredImage: { not: '' } }, { images: { isEmpty: false } },
          { variants: { some: { images: { isEmpty: false } } } },
        ] },
      ] },
      orderBy: [{ cataloguePinHero: 'desc' }, { catalogueFeatured: 'desc' }, { catalogueEditorial: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
      include: media,
    });

    const edit = await prisma.product.findMany({
      where: { AND: [publicWhere, curated] },
      orderBy: [
        { cataloguePinHero: 'desc' }, { catalogueFeatured: 'desc' },
        { catalogueEditorial: 'desc' }, { createdAt: 'desc' }, { id: 'asc' },
      ],
      take: 8,
      include: media,
    });

    const arrivals = await prisma.product.findMany({
      where: publicWhere,
      take: 12,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      include: media,
    });

    const categories = await prisma.category.findMany({
      where: { active: true, hidden: false, products: { some: publicWhere } },
      orderBy: [{ featured: 'desc' }, { order: 'asc' }, { name: 'asc' }],
      select: { id: true, slug: true, name: true },
      take: 8,
    });

    const heroBanner = await prisma.banner.findMany({
      where: {
        position: 'hero',
        active: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      orderBy: { order: 'asc' },
      select: { id: true, title: true, subtitle: true, image: true, ctaText: true, ctaUrl: true },
    }).catch((e: any) => {
      console.warn('[home] Hero banner query failed:', e.message);
      return [];
    });

    const founderNotePage = await prisma.cmsPage.findUnique({
      where: { slug: 'home-founder-note' },
      select: { status: true, sections: true },
    }).catch((e: any) => {
      console.warn('[home] Founder note query failed:', e.message);
      return null;
    });

    const journalEntries = await prisma.cmsPage.findMany({
      where: { pageType: 'journal', status: 'PUBLISHED' },
      orderBy: [{ featured: 'desc' }, { publishedAt: 'desc' }, { updatedAt: 'desc' }],
      take: 3,
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
        coverImage: true,
        author: true,
        publishedAt: true,
        updatedAt: true,
      },
    }).catch((e: any) => {
      console.warn('[home] Journal query failed:', e.message);
      return [];
    });

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
        if (s?.data?.align && ['left', 'center', 'justify'].includes(s.data.align) && !founderNoteAlignSet) {
          founderNoteAlign = s.data.align as 'left' | 'center' | 'justify';
          founderNoteAlignSet = true;
        }
      }
    }

    type HomeProduct = (typeof arrivals)[number];
    const mapCard = (p: HomeProduct): ProductCardData => ({
      id: p.id, slug: p.slug, name: p.name, poeticLine: p.poeticLine,
      craft: p.craft, region: p.region, mrp: p.mrp, sellingPrice: p.sellingPrice,
      salePrice: p.salePrice, saleStartsAt: p.saleStartsAt, saleEndsAt: p.saleEndsAt,
      images: p.images.length ? p.images : p.variants.flatMap(v => v.images),
      badges: p.badges, aiTryOnEligible: p.aiTryOnEligible,
      inventory: p.catalogueStockVisibility === 'SHOW_ALL'
        ? p.variants.reduce((sum, v) => sum + v.inventory, 0)
        : null,
    });

    const picture = lead && resolveMedia(lead).approvedPrimaryImage;
    const spotlight = lead && picture ? {
      title: lead.shortName?.trim() || lead.name,
      name: lead.name,
      image: picture,
      subtitle: lead.poeticLine,
      origin: [lead.craft, lead.region].filter(Boolean).join(' · '),
      price: formatINR(buildPricing(lead).effectivePrice),
      href: `/products/${encodeURIComponent(lead.slug)}`,
      curated: edit.some(p => p.id === lead.id),
    } : null;
    const founder = edit.filter(p => p.id !== (spotlight && lead?.id)).slice(0, 4).map(mapCard);
    const shown = new Set([spotlight && lead?.id, ...founder.map(p => p.id)]);
    return {
      spotlight, founder, categories,
      newArrivals: arrivals.filter(p => !shown.has(p.id)).slice(0, 4).map(mapCard),
      heroBanners: heroBanner,
      founderNoteTitle,
      founderNoteBody,
      founderNoteAlign,
      journalEntries,
    };
  } catch (e: any) {
    console.warn('[home] DB query failed:', e.message);
    return {
      spotlight: null,
      founder: [],
      newArrivals: [],
      categories: [],
      heroBanners: [],
      founderNoteTitle: null,
      founderNoteBody: null,
      founderNoteAlign: 'center' as const,
      journalEntries: [],
    };
  }
}

export default async function HomePage() {
  const data = await getHomeData();

  return (
    <>
      <Header />

      <main>
        <HeroCarousel banners={data.heroBanners} spotlight={data.spotlight} />
        <PitariCounter />

        <nav aria-label="Shop collections" className="border-y border-mitti/20 bg-ivory">
          <div className="max-w-8xl mx-auto px-6 lg:px-12 py-4 flex flex-wrap items-center gap-x-6 gap-y-2 font-ui text-sm">
            <Link className="text-madder font-medium underline underline-offset-4" href="/products">Shop all pieces</Link>
            {data.categories.map(category => (
              <Link key={category.id} href={`/categories/${category.slug}`} className="hover:underline underline-offset-4">{category.name}</Link>
            ))}
            <Link href="/about" className="sm:ml-auto hover:underline underline-offset-4">Meet NEEJEE</Link>
          </div>
        </nav>

        {data.founder.length > 0 && (
          <section className="max-w-8xl mx-auto px-6 lg:px-12 py-20">
            <div className="flex items-baseline justify-between mb-10">
              <div>
                <h2 className="font-display text-4xl lg:text-5xl text-kohl mt-2">Founder&apos;s Edit</h2>
              </div>
              <Link href="/products" className="font-ui text-xs tracking-widest text-madder hover:underline">SHOP ALL PIECES</Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 lg:gap-8">
              {data.founder.slice(0, 4).map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </section>
        )}

        {data.founderNoteBody && (
          <section className="bg-beige py-16 md:py-24">
            <div className="max-w-3xl mx-auto px-6">
              {data.founderNoteTitle && (
                <h2 className="font-display text-3xl md:text-4xl text-kohl mb-10 text-center">{data.founderNoteTitle}</h2>
              )}
              {(() => {
                const paragraphs = data.founderNoteBody.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
                let signature: string | null = null;
                const last = paragraphs[paragraphs.length - 1];
                if (last && last.length < 60 && !last.endsWith('.') && !last.includes('\n')) {
                  signature = last;
                  paragraphs.pop();
                }
                const alignClass = data.founderNoteAlign === 'justify' ? 'text-justify' : data.founderNoteAlign === 'left' ? 'text-left' : 'text-center';
                return (
                  <>
                    <div className={`font-body text-kohl/80 text-[15px] md:text-base leading-[1.85] space-y-5 ${alignClass}`} style={{ textAlign: data.founderNoteAlign || 'center' }}>
                      {paragraphs.slice(0, 2).map((p, i) => <p key={i}>{p}</p>)}
                      {paragraphs.length > 2 && (
                        <details>
                          <summary className="cursor-pointer text-madder underline underline-offset-4">Read the full founder’s letter</summary>
                          <div className="space-y-5 mt-5">{paragraphs.slice(2).map((p, i) => <p key={i}>{p}</p>)}</div>
                        </details>
                      )}
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
        )}

        {data.newArrivals.length > 0 && (
          <section className="bg-beige py-20">
            <div className="max-w-8xl mx-auto px-6 lg:px-12">
              <div className="flex items-baseline justify-between mb-10">
                <div>
                    <h2 className="font-display text-4xl text-kohl mt-2">Just arrived</h2>
                </div>
                <Link href="/products?sort=newest" className="font-ui text-xs tracking-widest text-madder hover:underline">SHOP ALL PIECES</Link>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 lg:gap-8">
                {data.newArrivals.slice(0, 4).map((p) => <ProductCard key={p.id} product={p} />)}
              </div>
            </div>
          </section>
        )}

        <section aria-labelledby="personal-shopping" className="bg-kohl text-ivory">
          <div className="max-w-8xl mx-auto px-6 lg:px-12 py-12 md:py-16 grid lg:grid-cols-[2fr_3fr] gap-8 lg:gap-16">
            <div>
              <p className="font-ui text-sm text-beige">Personal shopping</p>
              <h2 id="personal-shopping" className="font-display text-4xl md:text-5xl leading-tight mt-3">Make it yours.</h2>
            </div>
            <div className="divide-y divide-ivory/20 border-y border-ivory/20">
              {[
                { href: '/ai/space', title: 'See it in your room', detail: 'Sign in to preview eligible home pieces in your space.', icon: LampDesk },
                { href: '/ai/mirror', title: 'Try it in the Mirror', detail: 'Sign in to try on eligible pieces with your photo.', icon: Shirt },
                { href: '/ai/gift', title: 'Find a gift', detail: 'Choose a recipient, an occasion and a budget.', icon: Gift },
              ].map(item => (
                <Link key={item.href} href={item.href} className="group flex items-center gap-5 py-5">
                  <item.icon size={24} strokeWidth={1.25} aria-hidden="true" className="shrink-0 text-beige" />
                  <div><h3 className="font-display text-2xl group-hover:underline underline-offset-4">{item.title}</h3>
                    <p className="font-body text-lg text-beige mt-1">{item.detail}</p></div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {data.journalEntries.length > 0 && (
          <section className="bg-beige py-20">
            <div className="max-w-8xl mx-auto px-6 lg:px-12">
              <div className="text-center mb-12">
                <p className="label text-madder">STORIES</p>
                <h2 className="font-display text-4xl text-kohl mt-2">From the Journal</h2>
              </div>
              <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
                {data.journalEntries.map((entry) => (
                  <Link key={entry.id} href={`/journal/${entry.slug}`} className="group">
                    <div className="aspect-[4/3] bg-ivory overflow-hidden">
                      {entry.coverImage ? (
                        // CMS media providers are not guaranteed to exist in next/image remotePatterns.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={entry.coverImage} alt={entry.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                      ) : (
                        <div className="w-full h-full bg-ivory" />
                      )}
                    </div>
                    <h3 className="font-display text-xl text-kohl mt-4 group-hover:text-madder transition-colors">{entry.title}</h3>
                    {entry.excerpt && <p className="font-italic italic text-mitti text-sm mt-2">{entry.excerpt}</p>}
                    <p className="font-ui text-xs tracking-widest text-madder mt-3">READ →</p>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        <nav aria-label="Delivery and returns" className="max-w-8xl mx-auto px-6 lg:px-12 py-6 border-b border-mitti/20 flex flex-wrap gap-x-8 gap-y-3 font-ui text-sm">
          <Link className="underline underline-offset-4" href="/help/shipping">Shipping and delivery</Link>
          <Link className="underline underline-offset-4" href="/help/returns">Returns by product</Link>
          <Link className="underline underline-offset-4" href="/help/track">Track your order</Link>
        </nav>
      </main>
      <Footer />
    </>
  );
}
