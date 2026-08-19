// NEEJEE Homepage — pre-Phase-2-fidelity visual composition with current live-data safeguards.
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ProductCard, type ProductCardData } from '@/components/product/ProductCard';
import { HeroCarousel } from '@/components/home/HeroCarousel';
import { NewsletterForm } from '@/components/ui/NewsletterForm';
import { Sparkles, ShieldCheck, Truck, RotateCcw, LockKeyhole } from 'lucide-react';

export const revalidate = 60;
export const runtime = 'nodejs';

function publicProductWhere(): any {
  return {
    status: 'ACTIVE',
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
    const founderEdit = await prisma.product.findMany({
      where: {
        AND: [
          publicWhere,
          {
            OR: [
              { catalogueFeatured: true },
              { catalogueEditorial: true },
              { badges: { has: "FOUNDER'S EDIT" } },
              { badges: { has: 'FOUNDERS_EDIT' } },
            ],
          },
        ],
      },
      take: 6,
      orderBy: [{ catalogueFeatured: 'desc' }, { catalogueEditorial: 'desc' }, { createdAt: 'desc' }],
      include: { variants: { select: { inventory: true, images: true } } },
    });

    const newArrivals = await prisma.product.findMany({
      where: publicWhere,
      take: 8,
      orderBy: { createdAt: 'desc' },
      include: { variants: { select: { inventory: true, images: true } } },
    });

    const allActive = await prisma.product.findMany({
      where: publicWhere,
      take: 4,
      orderBy: { createdAt: 'asc' },
      include: { variants: { select: { inventory: true, images: true } } },
    });

    const categories = await prisma.category.findMany({
      where: {
        active: true,
        hidden: false,
        products: { some: publicWhere },
      },
      select: {
        id: true,
        slug: true,
        name: true,
        products: { where: publicWhere, select: { id: true }, take: 1 },
      },
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

    const mapCard = (p: any): ProductCardData => {
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
        id: p.id,
        slug: p.slug,
        name: p.name,
        poeticLine: p.poeticLine,
        craft: p.craft,
        region: p.region,
        mrp: p.mrp,
        sellingPrice: p.sellingPrice,
        salePrice: p.salePrice,
        saleStartsAt: p.saleStartsAt,
        saleEndsAt: p.saleEndsAt,
        images: imgs,
        badges: Array.isArray(p.badges) ? p.badges : [],
        aiTryOnEligible: !!p.aiTryOnEligible,
        inventory: p.variants.reduce((sum: number, v: any) => sum + (v.inventory || 0), 0),
      };
    };

    const founderRaw = founderEdit.length > 0 ? founderEdit : allActive;
    const founder = founderRaw.map(mapCard);
    const founderIds = new Set(founder.map((p) => p.id));
    const distinctNewArrivals = newArrivals.map(mapCard).filter((p) => !founderIds.has(p.id));
    const primaryCat = categories.find((c: any) => /sare|women|textile/i.test(c.name + c.slug)) || categories[0];

    return {
      founder,
      newArrivals: distinctNewArrivals,
      categories,
      primaryCatSlug: primaryCat?.slug || 'women-sarees',
      heroBanners: heroBanner as any[],
      founderNoteTitle,
      founderNoteBody,
      founderNoteAlign,
      journalEntries,
    };
  } catch (e: any) {
    console.warn('[home] DB query failed:', e.message);
    return {
      founder: [],
      newArrivals: [],
      categories: [],
      heroBanners: [],
      founderNoteTitle: null,
      founderNoteBody: null,
      founderNoteAlign: 'center' as const,
      journalEntries: [],
      error: e.message,
    };
  }
}

export default async function HomePage() {
  const data = await getHomeData();

  return (
    <>
      <Header />

      <HeroCarousel banners={data.heroBanners || []} primaryCatSlug={data.primaryCatSlug || 'women-sarees'} />

      <section className="bg-beige border-y border-mitti/20">
        <div className="max-w-8xl mx-auto px-6 lg:px-12 py-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: ShieldCheck, label: 'FOUNDER-VERIFIED', sub: 'Curated before publication' },
            { icon: Truck, label: 'FREE SHIPPING', sub: 'Above ₹2,500 across India' },
            { icon: RotateCcw, label: 'RETURNS', sub: 'Product-specific eligibility' },
            { icon: LockKeyhole, label: 'SECURE CHECKOUT', sub: 'Server-verified orders' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              <item.icon className="w-6 h-6 text-madder flex-shrink-0" />
              <div>
                <p className="font-ui text-[10px] tracking-widest text-kohl">{item.label}</p>
                <p className="font-italic italic text-mitti text-sm">{item.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {data.founder.length > 0 && (
        <section className="max-w-8xl mx-auto px-6 lg:px-12 py-20">
          <div className="flex items-baseline justify-between mb-10">
            <div>
              <p className="label text-madder">THE FIRST EDIT</p>
              <h2 className="font-display text-4xl lg:text-5xl text-kohl mt-2">Founder&apos;s Edit</h2>
              <p className="font-italic italic text-mitti mt-2">Personally chosen · Limited edit</p>
            </div>
            <Link href={`/categories/${data.primaryCatSlug || 'women-sarees'}`} className="font-ui text-xs tracking-widest text-madder hover:underline">VIEW ALL →</Link>
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
                    {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
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
                <p className="label text-madder">NEW IN</p>
                <h2 className="font-display text-4xl text-kohl mt-2">Just arrived</h2>
              </div>
              <Link href={`/categories/${data.primaryCatSlug || 'women-sarees'}?sort=newest`} className="font-ui text-xs tracking-widest text-madder hover:underline">BROWSE ALL →</Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 lg:gap-8">
              {data.newArrivals.slice(0, 4).map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </div>
        </section>
      )}

      <section className="max-w-8xl mx-auto px-6 lg:px-12 py-20">
        <div className="bg-kohl text-ivory p-10 lg:p-16 relative overflow-hidden">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <p className="label text-banarasi flex items-center gap-2"><Sparkles className="w-4 h-4" /> NEEJEE AI</p>
              <h2 className="font-display text-4xl lg:text-5xl mt-4">See it on you.<br />See it in your home.</h2>
              <p className="font-italic italic text-beige/80 text-lg mt-4 max-w-md">Mirror, Space and Gift Concierge bring personal discovery into the NEEJEE world.</p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link href="/ai/mirror" className="btn-primary">TRY THE MIRROR</Link>
                <Link href="/ai/gift" className="font-ui text-xs tracking-widest text-ivory hover:text-banarasi self-center underline underline-offset-4">GIFT CONCIERGE →</Link>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {['Mirror', 'Space', 'Gift'].map((label) => (
                <div key={label} className="aspect-square bg-mitti/30 flex items-center justify-center">
                  <p className="font-display text-lg text-banarasi">{label}</p>
                </div>
              ))}
            </div>
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
                <Link key={entry.id} href={`/p/${entry.slug}`} className="group">
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

      <section className="max-w-3xl mx-auto px-6 py-20 text-center">
        <p className="label text-madder">STAY IN THE TRUNK</p>
        <h2 className="font-display text-3xl text-kohl mt-3">Get our limited drops first.</h2>
        <p className="font-italic italic text-mitti mt-3 mb-8">Founder&apos;s edits, craft stories and early access.</p>
        <div className="max-w-md mx-auto"><NewsletterForm source="homepage" /></div>
      </section>

      <Footer />
    </>
  );
}
