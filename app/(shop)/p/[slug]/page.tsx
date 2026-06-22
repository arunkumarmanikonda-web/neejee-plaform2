// Public CMS page renderer at /p/[slug]
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { SectionRenderer, type Section } from '@/components/cms/SectionRenderer';
import { isSectionVisibleNow } from '@/lib/cms-sections';
import { ProductCard } from '@/components/product/ProductCard';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface PageProps { params: { slug: string } }

async function getPage(slug: string) {
  try {
    const page = await prisma.cmsPage.findUnique({ where: { slug } });
    if (!page || page.status !== 'PUBLISHED') return null;
    return page;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const page = await getPage(params.slug);
  if (!page) return { title: 'Not found' };
  return {
    title: page.seoTitle || page.title,
    description: page.seoDesc || undefined,
    openGraph: page.ogImage ? { images: [page.ogImage] } : undefined,
  };
}

async function resolveCarouselProducts(source: string, limit: number) {
  try {
    const where: any = { status: 'ACTIVE' };
    if (source === 'founder') where.badges = { has: "FOUNDER'S EDIT" };
    if (source === 'sale') {
      where.salePrice = { not: null };
      where.OR = [{ saleEndsAt: null }, { saleEndsAt: { gte: new Date() } }];
    }
    if (source === 'new') {
      const thirty = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      where.createdAt = { gte: thirty };
    }
    const products = await prisma.product.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { variants: { select: { inventory: true } } },
    });
    return products.map((p: any) => ({
      id: p.id, slug: p.slug, name: p.name,
      mrp: p.mrp, sellingPrice: p.sellingPrice, salePrice: p.salePrice,
      saleStartsAt: p.saleStartsAt, saleEndsAt: p.saleEndsAt,
      images: Array.isArray(p.images) ? p.images : [],
      badges: Array.isArray(p.badges) ? p.badges : [],
      craft: p.craft, region: p.region,
      inventory: p.variants.reduce((s: number, v: any) => s + (v.inventory || 0), 0),
    }));
  } catch {
    return [];
  }
}

export default async function CMSPublicPage({ params }: PageProps) {
  const page = await getPage(params.slug);
  if (!page) notFound();

  const sections: Section[] = Array.isArray(page.sections) ? (page.sections as any) : [];

  // Pre-fetch products for productCarousel blocks
  const carouselData: Record<string, any[]> = {};
  for (const s of sections) {
    if (s.type === 'productCarousel') {
      carouselData[s.id] = await resolveCarouselProducts(
        s.data.source || 'founder',
        s.data.limit || 6,
      );
    }
  }

  return (
    <div className="min-h-screen bg-ivory">
      <Header />
      <main>
        {sections.map((s) => {
          // Server-side: enforce hidden + date window
          if (!isSectionVisibleNow(s)) return null;
          if (s.type === 'productCarousel') {
            const products = carouselData[s.id] || [];
            return (
              <section key={s.id} className="max-w-7xl mx-auto px-6 py-12">
                <h2 className="font-display text-3xl text-kohl mb-6">{s.data.title}</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                  {products.map((p: any) => <ProductCard key={p.id} product={p as any} />)}
                </div>
              </section>
            );
          }
          return <SectionRenderer key={s.id} section={s} />;
        })}
      </main>
      <Footer />
    </div>
  );
}
