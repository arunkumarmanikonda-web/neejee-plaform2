// NEEJEE Homepage — Phase 2 editorial storefront, backed only by live catalogue/CMS data.
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

    // Production deliberately uses a small serverless connection pool. Keep the
    // reads sequential so one ISR regeneration cannot self-starve Prisma.
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

      {data.founder.length > 0 && (
        <section className="max-w-[1600px] mx-auto px-5 sm:px-8 lg:px-12 xl:px-14 py-14 md:py-18 lg:py-20">
          <div className="flex items-end justify-between gap-6 border-b border-mitti/18 pb-4 mb-7 md:mb-8">
            <div>
              <p className="font-ui text-[9px] tracking-[0.24em] text-madder uppercase">THE FIRST EDIT</p>
              <h2 className="font-display text-[29px] sm:text-[34px] md:text-[38px] leading-none text-kohl mt-2 uppercase tracking-[0.01em]">Founder&apos;s Edit</h2>
            </div>
            <Link href={`/categories/${data.primaryCatSlug || 'women-sarees'}`} className="font-ui text-[9px] tracking-[0.2em] text-kohl/75 hover:text-madder transition-colors whitespace-nowrap">VIEW ALL &nbsp;›</Link>
          </div>

          <div className={`grid gap-x-6 gap-y-10 lg:gap-x-8 ${data.founder.length === 1 ? 'md:grid-cols-[minmax(0,1.45fr)_minmax(260px,.55fr)] max-w-[1120px]' : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'}`}>
            {data.founder.slice(0, 3).map((p) => <ProductCard key={p.id} product={p} />)}
            {data.founder.length === 1 && (
              <aside className="hidden md:flex border-l border-mitti/18 pl-8 lg:pl-10 flex-col justify-center">
                <p className="font-ui text-[9px] tracking-[0.24em] text-madder uppercase">PERSONALLY CHOSEN</p>
                <p className="font-display text-[30px] lg:text-[38px] leading-[1.08] text-kohl mt-5">A single find can still open an entire world.</p>
                <div className="w-10 h-px bg-madder mt-6" />
                <p className="font-display italic text-[16px] text-mitti leading-relaxed mt-5">Selected by Nidhi for its character, craft and the quiet pleasure of living with it.</p>
                <Link href={`/products/${data.founder[0].slug}`} className="micro-link mt-7">DISCOVER THE PIECE →</Link>
              </aside>
            )}
          </div>
        </section>
      )}

      <section className="border-y border-mitti/15 bg-[#efe5d6]/70">
        <div className="max-w-[1500px] mx-auto px-6 lg:px-12 py-5 md:py-6 grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5">
          {[
            { icon: ShieldCheck, label: 'FOUNDER-VERIFIED', sub: 'Curated before publication' },
            { icon: Truck, label: 'FREE SHIPPING', sub: 'Above ₹2,500 across India' },
            { icon: RotateCcw, label: 'RETURNS', sub: 'Product-specific eligibility' },
            { icon: LockKeyhole, label: 'SECURE CHECKOUT', sub: 'Server-verified orders' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-3 min-w-0">
              <item.icon className="w-[16px] h-[16px] text-madder flex-shrink-0" strokeWidth={1.25} />
              <div className="min-w-0">
                <p className="font-ui text-[8px] md:text-[9px] tracking-[0.18em] text-kohl truncate">{item.label}</p>
                <p className="font-display text-mitti text-[12px] md:text-[13px] mt-0.5 truncate">{item.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {data.newArrivals.length > 0 && (
        <section className="max-w-[1600px] mx-auto px-5 sm:px-8 lg:px-12 xl:px-14 py-14 md:py-20">
          <div className="flex items-end justify-between gap-6 border-b border-mitti/18 pb-4 mb-7 md:mb-8">
            <div>
              <p className="font-ui text-[9px] tracking-[0.24em] text-madder uppercase">NEW IN</p>
              <h2 className="font-display text-[29px] md:text-[38px] leading-none text-kohl mt-2 uppercase tracking-[0.01em]">Just arrived</h2>
            </div>
            <Link href={`/categories/${data.primaryCatSlug || 'women-sarees'}?sort=newest`} className="font-ui text-[9px] tracking-[0.2em] text-kohl/75 hover:text-madder hidden sm:block">BROWSE ALL &nbsp;›</Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-9 sm:gap-6 lg:gap-8">
            {data.newArrivals.slice(0, 4).map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}

      {data.founderNoteBody && (
        <section className="relative overflow-hidden bg-[#eee2d2] border-y border-mitti/14 py-16 md:py-24 lg:py-28">
          <div className="absolute inset-0 opacity-[0.13] bg-[radial-gradient(circle_at_center,rgba(107,68,35,0.28)_0_1px,transparent_1.3px)] [background-size:24px_24px]" />
          <div className="relative max-w-[1180px] mx-auto px-6 md:px-10">
            <div className="grid lg:grid-cols-[300px_1fr] gap-9 lg:gap-16 items-start">
              <div>
                <p className="font-ui text-[9px] tracking-[0.25em] text-madder uppercase">A NOTE FROM THE FOUNDER</p>
                <h2 className="font-display text-[38px] md:text-[48px] lg:text-[54px] leading-[0.98] text-kohl mt-5">{data.founderNoteTitle || 'From the Founder'}</h2>
                <div className="w-11 h-px bg-madder mt-7" />
              </div>
              {(() => {
                const paragraphs = data.founderNoteBody.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
                let signature: string | null = null;
                const last = paragraphs[paragraphs.length - 1];
                if (last && last.length < 60 && !last.endsWith('.') && !last.includes('\n')) {
                  signature = last;
                  paragraphs.pop();
                }

                return (
                  <div>
                    <div className="font-display text-kohl/84 text-[17px] md:text-[19px] leading-[1.75] space-y-5 text-left">
                      {paragraphs.map((p, i) => <p key={i} className={i === 0 ? 'text-[21px] md:text-[24px] italic leading-[1.55] text-kohl' : ''}>{p}</p>)}
                    </div>
                    {signature && (
                      <div className="mt-9 border-t border-madder/22 pt-5 max-w-xs">
                        <p className="font-display italic text-madder text-xl">{signature}</p>
                        <p className="font-ui text-[8px] tracking-[0.22em] text-mitti mt-1">FOUNDER</p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </section>
      )}

      <section className="max-w-[1500px] mx-auto px-5 sm:px-8 lg:px-12 py-16 md:py-20 lg:py-24">
        <div className="bg-kohl text-ivory relative overflow-hidden border border-kohl">
          <div className="absolute inset-0 opacity-[0.07] bg-[linear-gradient(135deg,transparent_0_47%,#F4EFE6_48%_48.5%,transparent_49%_100%)] [background-size:42px_42px]" />
          <div className="relative grid lg:grid-cols-[1.05fr_.95fr] min-h-[430px]">
            <div className="p-8 sm:p-10 lg:p-14 xl:p-16 flex flex-col justify-center">
              <p className="font-ui text-[9px] tracking-[0.24em] text-banarasi flex items-center gap-2 uppercase">
                <Sparkles className="w-4 h-4" strokeWidth={1.2} /> NEEJEE AI
              </p>
              <h2 className="font-display text-[40px] sm:text-[48px] lg:text-[58px] leading-[1.02] mt-5 max-w-[10ch]">See it on you. See it in your home.</h2>
              <p className="font-display italic text-beige/72 text-[17px] md:text-[18px] mt-6 max-w-lg leading-relaxed">
                Mirror, Space and Gift Concierge bring personal discovery into the NEEJEE world without interrupting the quiet of the experience.
              </p>
              <div className="mt-8 flex flex-wrap gap-6 items-center">
                <Link href="/ai/mirror" className="bg-madder text-ivory px-7 py-4 font-ui text-[10px] tracking-[0.18em] hover:bg-[#742522] transition-colors">TRY THE MIRROR</Link>
                <Link href="/ai/gift" className="font-ui text-[9px] tracking-[0.18em] text-ivory/80 hover:text-banarasi">GIFT CONCIERGE →</Link>
              </div>
            </div>
            <div className="grid grid-cols-3 border-t lg:border-t-0 lg:border-l border-ivory/16">
              {[
                ['Mirror', 'Try it on'],
                ['Space', 'Place it at home'],
                ['Gift', 'Find something personal'],
              ].map(([label, sub]) => (
                <Link key={label} href={label === 'Mirror' ? '/ai/mirror' : label === 'Space' ? '/ai/space' : '/ai/gift'} className="group border-r last:border-r-0 border-ivory/14 p-5 flex flex-col justify-end min-h-[180px] lg:min-h-full hover:bg-ivory/[0.045] transition-colors">
                  <Sparkles className="w-4 h-4 text-banarasi mb-auto" strokeWidth={1.1} />
                  <p className="font-display text-[24px] lg:text-[28px] text-ivory">{label}</p>
                  <p className="font-ui text-[8px] tracking-[0.14em] text-beige/60 mt-2 uppercase leading-relaxed">{sub}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {data.journalEntries.length > 0 && (
        <section className="bg-[#eee4d5]/72 border-y border-mitti/12 py-16 md:py-20">
          <div className="max-w-[1500px] mx-auto px-5 sm:px-8 lg:px-12">
            <div className="flex items-end justify-between gap-6 border-b border-mitti/18 pb-4 mb-8">
              <div>
                <p className="font-ui text-[9px] tracking-[0.24em] text-madder uppercase">STORIES</p>
                <h2 className="font-display text-[32px] md:text-[40px] text-kohl mt-2 uppercase">From the Journal</h2>
              </div>
              <Link href="/journal" className="font-ui text-[9px] tracking-[0.18em] text-kohl/75 hover:text-madder">VIEW ALL &nbsp;›</Link>
            </div>
            <div className="grid md:grid-cols-3 gap-7 lg:gap-9">
              {data.journalEntries.map((entry) => (
                <Link key={entry.id} href={`/p/${entry.slug}`} className="group block">
                  <div className="aspect-[4/3] bg-ivory overflow-hidden">
                    {entry.coverImage ? (
                      // CMS media can be stored on approved external providers that
                      // are not guaranteed to be in next/image remotePatterns.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={entry.coverImage}
                        alt={entry.title}
                        className="w-full h-full object-cover group-hover:scale-[1.018] transition-transform duration-700"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-beige to-mitti/15" />
                    )}
                  </div>
                  <p className="font-ui text-[8px] tracking-[0.22em] text-madder uppercase mt-4">JOURNAL</p>
                  <h3 className="font-display text-[23px] text-kohl mt-1.5 group-hover:text-madder transition-colors">{entry.title}</h3>
                  {entry.excerpt && <p className="font-display italic text-mitti text-[14px] mt-2 line-clamp-2">{entry.excerpt}</p>}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="max-w-3xl mx-auto px-6 py-16 md:py-20 text-center">
        <p className="font-ui text-[9px] tracking-[0.24em] text-madder uppercase">STAY IN THE TRUNK</p>
        <h2 className="font-display text-[34px] md:text-[42px] text-kohl mt-3">The next find, personally.</h2>
        <p className="font-display italic text-mitti mt-3 mb-8">Founder&apos;s edits, craft stories and early access. No noise.</p>
        <div className="max-w-md mx-auto"><NewsletterForm source="homepage" /></div>
      </section>

      <Footer />
    </>
  );
}
