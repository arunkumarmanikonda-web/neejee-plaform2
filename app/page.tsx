import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ProductCard, type ProductCardData } from '@/components/product/ProductCard';
import { editLead } from '@/lib/shop-edit-catalog';
import { shopEdits } from '@/lib/shop-edits';
import { HomePrint, homeStudyIds } from '@/components/home/HomePrint';
import { HouseCampaign } from '@/components/home/HouseCampaign';
import { StudyShelf } from '@/components/shop/StudyShelf';
import { previewPricingEnabled } from '@/lib/shop-studies';
import { readEdit } from '@/lib/shop-edit-catalog';
import { getPublicContact } from '@/lib/public-contact';
import { StudioDoors } from '@/components/home/StudioDoors';
import { studioHref } from '@/lib/studio';
import { HeroCarousel } from '@/components/home/HeroCarousel';
import { resolveMedia } from '@/lib/catalog/media-read';
import { buildPricing } from '@/lib/catalog/pricing-read';
import { formatINR } from '@/lib/money';
import type { Prisma } from '@prisma/client';


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
    const media = { variants: { select: { id: true, inventory: true, images: true, color:true } } } as const;
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

    const saree = await editLead(shopEdits[0]);
    const suit = await editLead(shopEdits[1]);

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
      technique:p.technique,state:p.state,colours:[...new Set(p.variants.flatMap(v=>v.color && v.inventory>0?[v.color]:[]))],
      material:p.material, craft:p.craft, region:p.region, mrp:p.mrp, sellingPrice: p.sellingPrice,
      salePrice: p.salePrice, saleStartsAt: p.saleStartsAt, saleEndsAt: p.saleEndsAt,
      images: resolveMedia(p).gallery,
      badges: p.badges, aiTryOnEligible: p.aiTryOnEligible,
      inventory: p.catalogueStockVisibility === 'SHOW_ALL'
        ? p.variants.reduce((sum, v) => sum + v.inventory, 0)
        : null,
    });

    const picture = lead && resolveMedia(lead).approvedPrimaryImage;
    const spotlight = lead && picture ? {
      title: lead.name,
      name: lead.name,
      image: picture,
      gallery: [...new Set([picture,...resolveMedia(lead).approvedGallery])].slice(0,6),
      material: lead.material,
      roomHref: lead.aiRoomEligible ? studioHref('imagine',lead.slug) : null,
      mirrorHref: lead.aiTryOnEligible ? studioHref('mirror',lead.slug) : null,
      slug: lead.slug,
      subtitle: lead.poeticLine,
      origin: [lead.region, lead.state].filter((v,i,values)=>v && values.indexOf(v)===i).join(', '),
      price: formatINR(buildPricing(lead).effectivePrice),
      href: `/products/${encodeURIComponent(lead.slug)}`,
      curated: edit.some(p => p.id === lead.id),
    } : null;
    const founder = edit.filter(p => p.id !== (spotlight && lead?.id)).slice(0, 4).map(mapCard);
    const shown = new Set([spotlight && lead?.id, ...founder.map(p => p.id)]);
    return {
      spotlight, spotlightCard: spotlight && lead ? mapCard(lead) : null, founder, saree, suit,
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
      spotlight: null, spotlightCard: null,
      founder: [],
      newArrivals: [],
      saree:null, suit:null,
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
  const fashion = await readEdit(shopEdits[3],1).catch(() => null);
  const moreFashion = fashion?.pieces.filter(p=>p.slug!==data.saree?.slug).slice(0,4) || [];
  const {email} = await getPublicContact();
  return (
    <>
      <Header shop/>
      <main className="house-front">
        <HouseCampaign lead={data.saree} preview={previewPricingEnabled()} email={email}/>
        {(!fashion?.pieces.length || moreFashion.length>0) && <div className="nj-market house-shelf" style={{paddingBottom:'1rem'}}>
          {fashion?.pieces.length ? <section className="nj-shelf"><div className="nj-shelf-head"><h2>Sarees <em>&amp; suit sets</em></h2><Link className="nj-text-link" href="/edits/clothing">Shop the collection</Link></div><div className="nj-grid">{moreFashion.map(p=><ProductCard key={p.id} product={{...p,images:p.cover?[p.cover,...p.images.filter(i=>i!==p.cover)]:p.images}}/>)}</div></section> :
            <StudyShelf home ids={homeStudyIds} preview={previewPricingEnabled()} email={email}/>}
        </div>}
        {(data.heroBanners.length>0) && <HeroCarousel banners={data.heroBanners} spotlight={data.spotlight}/>}

        {(data.founder.length > 0 || (data.spotlight && !data.heroBanners.length)) && (
          <section className="max-w-8xl mx-auto px-6 lg:px-12 py-20">
            <div className="flex items-baseline justify-between mb-10">
              <div>
                <h2 className="font-display text-4xl lg:text-5xl text-kohl mt-2">Founder&apos;s Edit</h2>
              </div>
              <Link href="/products" className="font-ui text-xs tracking-widest text-madder">SHOP ALL PIECES</Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 lg:gap-8">
              {data.spotlight && !data.heroBanners.length && data.spotlightCard && <ProductCard product={data.spotlightCard}/>}
              {data.founder.slice(0, 4).map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </section>
        )}

        <StudioDoors roomPiece={data.spotlight?.roomHref ? data.spotlight.slug : undefined} wearable={data.saree?.mirror ? data.saree.slug : data.suit?.mirror ? data.suit.slug : undefined}/>
        <div className="house-letter">
          <figure><img src="/brand/journey-loom.webp" loading="lazy" alt="Coloured bobbins at a handloom in Varanasi"/><figcaption>Varanasi, 2011 · <a href="https://commons.wikimedia.org/wiki/File:Silk_Looms,_Varanasi.jpg">Dan Ruth</a> · <a href="https://creativecommons.org/licenses/by/2.0/">CC BY 2.0</a> · cropped</figcaption></figure>
          <div>
        {data.founderNoteBody ? (
          <section id="founder-letter" className="scroll-mt-24 bg-beige py-12 md:py-16">
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
                      {paragraphs.slice(0, 1).map((p, i) => <p key={i}>{p}</p>)}
                      {paragraphs.length > 1 && (
                        <details>
                          <summary className="cursor-pointer text-madder underline underline-offset-4">Read the full founder’s letter</summary>
                          <div className="space-y-5 mt-5">{paragraphs.slice(1).map((p, i) => <p key={i}>{p}</p>)}</div>
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
        ) : <section id="founder-letter" className="max-w-3xl scroll-mt-24 mx-auto px-6 py-12"><h2 className="font-display text-3xl">A letter from Nidhi</h2><p className="mt-3">In her letter, Nidhi remembers Ramji bhai and the fourteen days he spent weaving a saree in Banaras.</p><Link href="/about" className="nj-text-link">Read the founder’s story</Link></section>}


        </div></div>

        {data.newArrivals.length > 0 && (
          <section className="bg-beige py-20">
            <div className="max-w-8xl mx-auto px-6 lg:px-12">
              <div className="flex items-baseline justify-between mb-10">
                <div>
                    <h2 className="font-display text-4xl text-kohl mt-2">Just arrived</h2>
                </div>
                <Link href="/products?sort=newest" className="font-ui text-xs tracking-widest text-madder">SHOP ALL PIECES</Link>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 lg:gap-8">
                {data.newArrivals.slice(0, 4).map((p) => <ProductCard key={p.id} product={p} />)}
              </div>
            </div>
          </section>
        )}

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
          <Link className="nj-text-link" href="/help/shipping">Shipping and delivery</Link>
          <Link className="nj-text-link" href="/help/returns">Returns by product</Link>
          <Link className="nj-text-link" href="/help/track">Track your order</Link>
        </nav>
        <HomePrint lead={data.saree} fashion={fashion?.pieces.length ? moreFashion : null}
          curated={data.spotlightCard ? [data.spotlightCard, ...data.founder] : data.founder}
          arrivals={data.newArrivals} founderNote={data.founderNoteBody} preview={previewPricingEnabled()}/>
      </main>
      <Footer />
    </>
  );
}
