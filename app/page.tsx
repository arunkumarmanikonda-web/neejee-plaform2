// NEEJEE Homepage — Phase 2 editorial storefront, backed by live catalogue/CMS data.
import Link from 'next/link';
import Image from 'next/image';
import { prisma } from '@/lib/prisma';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ProductCard, type ProductCardData } from '@/components/product/ProductCard';
import { HeroCarousel } from '@/components/home/HeroCarousel';
import { NewsletterForm } from '@/components/ui/NewsletterForm';
import { Sparkles, ShieldCheck, Truck, RotateCcw, LockKeyhole } from 'lucide-react';

export const revalidate = 60;
export const runtime = 'nodejs';

async function getHomeData() {
  try {
    const now = new Date();

    // Production deliberately uses a small serverless connection pool. These reads
    // stay sequential so one ISR regeneration cannot self-starve Prisma.
    const founderEdit = await prisma.product.findMany({
      where: { status: 'ACTIVE', badges: { has: "FOUNDER'S EDIT" } },
      take: 6,
      orderBy: { createdAt: 'desc' },
      include: { variants: { select: { inventory: true, images: true } } },
    });

    const newArrivals = await prisma.product.findMany({
      where: { status: 'ACTIVE' },
      take: 8,
      orderBy: { createdAt: 'desc' },
      include: { variants: { select: { inventory: true, images: true } } },
    });

    const allActive = await prisma.product.findMany({
      where: { status: 'ACTIVE' },
      take: 4,
      orderBy: { createdAt: 'asc' },
      include: { variants: { select: { inventory: true, images: true } } },
    });

    const categories = await prisma.category.findMany({
      where: { products: { some: { status: 'ACTIVE' } } },
      select: { id: true, slug: true, name: true, products: { select: { id: true }, take: 1 } },
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

    const journalPages = await prisma.cmsPage.findMany({
      where: { pageType: 'journal', status: 'PUBLISHED' },
      orderBy: [{ featured: 'desc' }, { publishedAt: 'desc' }, { updatedAt: 'desc' }],
      take: 3,
      select: {
        slug: true,
        title: true,
        excerpt: true,
        coverImage: true,
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
        if (typeof s?.data?.title === 'string' && s.data.title.trim() && !founderNoteTitle) founderNoteTitle = s.data.title.trim();
        if (typeof s?.data?.body === 'string' && s.data.body.trim() && !founderNoteBody) founderNoteBody = s.data.body.trim();
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
      journalPages,
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
      journalPages: [],
      error: e.message,
    };
  }
}

export default async function HomePage() {
  const data = await getHomeData();

  return (
    <>
      <Header />
      <HeroCarousel banners={(data as any).heroBanners || []} primaryCatSlug={data.primaryCatSlug || 'women-sarees'} />

      {data.founder.length > 0 && (
        <section className="max-w-[1680px] mx-auto px-5 sm:px-8 lg:px-12 pt-16 md:pt-20 pb-16">
          <div className="text-center max-w-2xl mx-auto mb-10 md:mb-12">
            <p className="editorial-kicker">THE FIRST EDIT</p>
            <h2 className="font-display text-[38px] md:text-[50px] leading-none text-kohl mt-3">Founder&apos;s Edit</h2>
            <div className="ornament-rule justify-center mt-5"><span className="font-display italic text-mitti text-sm">Personally chosen by Nidhi</span></div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-9 sm:gap-6 lg:gap-8 max-w-6xl mx-auto">
            {data.founder.slice(0, 3).map((p) => <ProductCard key={p.id} product={p} />)}
          </div>

          <div className="mt-10 text-center">
            <Link href={`/categories/${data.primaryCatSlug || 'women-sarees'}`} className="micro-link">VIEW THE EDIT →</Link>
          </div>
        </section>
      )}

      <section className="border-y border-mitti/15 bg-paper-deep/55">
        <div className="max-w-[1380px] mx-auto px-6 py-7 grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-7">
          {[
            { icon: ShieldCheck, label: 'FOUNDER-VERIFIED', sub: 'Curated before publication' },
            { icon: Truck, label: 'FREE SHIPPING', sub: 'Above ₹2,500 across India' },
            { icon: RotateCcw, label: 'RETURNS', sub: 'Product-specific eligibility' },
            { icon: LockKeyhole, label: 'SECURE CHECKOUT', sub: 'Server-verified orders' },
          ].map((item) => (
            <div key={item.label} className="flex items-start gap-3">
              <item.icon className="w-[18px] h-[18px] text-madder flex-shrink-0 mt-0.5" strokeWidth={1.35} />
              <div>
                <p className="font-ui text-[9px] tracking-[0.18em] text-kohl">{item.label}</p>
                <p className="font-display italic text-mitti text-[13px] mt-1">{item.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {data.newArrivals.length > 0 && (
        <section className="max-w-[1680px] mx-auto px-5 sm:px-8 lg:px-12 py-16 md:py-20">
          <div className="flex items-end justify-between gap-6 mb-9">
            <div>
              <p className="editorial-kicker">NEW IN</p>
              <h2 className="font-display text-[36px] md:text-[46px] leading-none text-kohl mt-3">Just arrived</h2>
            </div>
            <Link href={`/categories/${data.primaryCatSlug || 'women-sarees'}?sort=newest`} className="micro-link hidden sm:block">BROWSE ALL →</Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-9 sm:gap-6 lg:gap-8">
            {data.newArrivals.slice(0, 4).map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}

      <section className="bg-paper-deep/65 border-y border-mitti/12 py-16 md:py-24">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <p className="editorial-kicker mb-4">A NOTE FROM THE FOUNDER</p>
          {data.founderNoteTitle && (
            <h2 className="font-display text-3xl md:text-[42px] leading-tight text-kohl mb-9">{data.founderNoteTitle}</h2>
          )}
          {(() => {
            const fullBody = data.founderNoteBody || `It began with one saree. Woven by Ramji bhai in Varanasi, over fourteen days, on a pit-loom older than him.\n\nAnd then I realised he was one of thousands. The weavers, the potters, the carpenters, the brassworkers, the attar-makers, the dyers, the embroiderers, the hands that have shaped India for centuries, were vanishing into the noise of glass-fronted malls and over-hyped digital platforms.\n\nSo I built one place to find them. One spotlight. One honest price.\n\nNidhi Chauhan`;
            const paragraphs = fullBody.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
            let signature: string | null = null;
            const last = paragraphs[paragraphs.length - 1];
            if (last && last.length < 60 && !last.endsWith('.') && !last.includes('\n')) {
              signature = last;
              paragraphs.pop();
            }
            const alignClass = data.founderNoteAlign === 'justify' ? 'text-justify' : data.founderNoteAlign === 'left' ? 'text-left' : 'text-center';
            return (
              <>
                <div className={`font-display text-kohl/80 text-[16px] md:text-[18px] leading-[1.8] space-y-5 ${alignClass}`} style={{ textAlign: data.founderNoteAlign || 'center' }}>
                  {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
                </div>
                {signature && (
                  <div className="mt-10 flex justify-center">
                    <div className="min-w-52 border-t border-madder/25 pt-5">
                      <p className="font-display italic text-madder text-lg">{signature}</p>
                      <p className="font-ui text-[9px] tracking-[0.2em] text-mitti mt-1">FOUNDER</p>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </section>

      <section className="max-w-[1440px] mx-auto px-5 sm:px-8 lg:px-12 py-16 md:py-20">
        <div className="bg-kohl text-ivory p-8 sm:p-10 lg:p-14 relative overflow-hidden border border-kohl">
          <div className="absolute inset-y-0 right-0 w-2/5 opacity-[0.08] bg-[radial-gradient(circle_at_center,#F4EFE6_0_1px,transparent_1.5px)] [background-size:18px_18px]" />
          <div className="relative grid lg:grid-cols-[1.15fr_.85fr] gap-10 items-center">
            <div>
              <p className="font-ui text-[9px] tracking-[0.22em] text-banarasi flex items-center gap-2"><Sparkles className="w-4 h-4" /> NEEJEE AI</p>
              <h2 className="font-display text-[38px] lg:text-[52px] leading-[1.05] mt-4">See it on you.<br />See it in your home.</h2>
              <p className="font-display italic text-beige/75 text-[17px] mt-5 max-w-lg">Use the Mirror for wearable pieces, Space for the room around you, and the Concierge when the choice is personal.</p>
              <div className="mt-8 flex flex-wrap gap-5 items-center">
                <Link href="/ai/mirror" className="btn-primary">TRY THE MIRROR</Link>
                <Link href="/ai/gift" className="micro-link !text-ivory/80 hover:!text-banarasi">GIFT CONCIERGE →</Link>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {['Mirror', 'Space', 'Gift'].map((label) => (
                <div key={label} className="aspect-square border border-ivory/18 bg-ivory/[0.03] flex flex-col items-center justify-center text-center px-2">
                  <Sparkles className="w-4 h-4 text-banarasi mb-3" strokeWidth={1.2} />
                  <p className="font-display text-[16px] text-ivory">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {data.journalPages.length > 0 && (
        <section className="bg-paper-deep/55 border-y border-mitti/12 py-16 md:py-20">
          <div className="max-w-[1440px] mx-auto px-5 sm:px-8 lg:px-12">
            <div className="text-center mb-10">
              <p className="editorial-kicker">STORIES</p>
              <h2 className="font-display text-[38px] md:text-[46px] text-kohl mt-3">From the Journal</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-7 lg:gap-9">
              {data.journalPages.map((j) => (
                <Link key={j.slug} href={`/p/${j.slug}`} className="group block">
                  <div className="aspect-[4/3] bg-ivory overflow-hidden border border-mitti/12">
                    {j.coverImage ? (
                      <Image src={j.coverImage} alt={j.title} width={800} height={600} className="w-full h-full object-cover group-hover:scale-[1.025] transition-transform duration-700" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-beige to-mitti/20" />
                    )}
                  </div>
                  <p className="editorial-kicker mt-4">JOURNAL</p>
                  <h3 className="font-display text-[22px] text-kohl mt-1.5 group-hover:text-madder transition-colors">{j.title}</h3>
                  {j.excerpt && <p className="font-display italic text-mitti text-[14px] mt-2 line-clamp-2">{j.excerpt}</p>}
                  <p className="micro-link mt-3">READ →</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="max-w-3xl mx-auto px-6 py-16 md:py-20 text-center">
        <p className="editorial-kicker">STAY IN THE TRUNK</p>
        <h2 className="font-display text-[34px] md:text-[42px] text-kohl mt-3">The next find, personally.</h2>
        <p className="font-display italic text-mitti mt-3 mb-8">Founder&apos;s edits, craft stories and early access. No noise.</p>
        <div className="max-w-md mx-auto"><NewsletterForm source="homepage" /></div>
      </section>

      <Footer />
    </>
  );
}
