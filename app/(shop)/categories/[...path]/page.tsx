import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ProductCard } from '@/components/product/ProductCard';
import { ChevronRight } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { resolveCategoryWhere } from '@/lib/category-resolve';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: { path?: string[] };
  searchParams?: { [key: string]: string | string[] | undefined };
};

function first(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] || '') : (v || '');
}

export default async function PLPPage({ params, searchParams }: PageProps) {
  const pathSegments = Array.isArray(params?.path) ? params.path : [];
  const slug = pathSegments.join('/');

  const craft = first(searchParams?.craft);
  const region = first(searchParams?.region);
  const material = first(searchParams?.material);
  const occasion = first(searchParams?.occasion);
  const badge = first(searchParams?.badge);
  const minPrice = first(searchParams?.minPrice);
  const maxPrice = first(searchParams?.maxPrice);
  const q = first(searchParams?.q);
  const sort = first(searchParams?.sort) || 'newest';

  const resolved = await resolveCategoryWhere(slug);

  const where: any = { ...(resolved.where || {}) };

  if (craft) where.craft = { equals: craft, mode: 'insensitive' };
  if (region) where.region = { equals: region, mode: 'insensitive' };
  if (material) where.material = { contains: material, mode: 'insensitive' };
  if (occasion) where.occasion = { contains: occasion, mode: 'insensitive' };
  if (badge) where.badges = { has: badge };

  if (minPrice || maxPrice) {
    where.sellingPrice = {};
    if (minPrice) where.sellingPrice.gte = Math.round(Number(minPrice) * 100);
    if (maxPrice) where.sellingPrice.lte = Math.round(Number(maxPrice) * 100);
  }

  if (q) {
    where.AND = [
      ...(where.AND || []),
      {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { craft: { contains: q, mode: 'insensitive' } },
          { material: { contains: q, mode: 'insensitive' } },
          { region: { contains: q, mode: 'insensitive' } },
        ],
      },
    ];
  }

  let orderBy: any = { createdAt: 'desc' };
  if (sort === 'price_asc') orderBy = { sellingPrice: 'asc' };
  else if (sort === 'price_desc') orderBy = { sellingPrice: 'desc' };
  else if (sort === 'name') orderBy = { name: 'asc' };

  const rawProducts = await prisma.product.findMany({
    where,
    orderBy,
    include: {
      category: { select: { slug: true, name: true } },
      variants: { select: { id: true, inventory: true, images: true } },
    },
    take: 60,
  });

  const products = rawProducts.map((p: any) => {
    let imgs: string[] = Array.isArray(p.images) ? p.images.filter(Boolean) : [];
    if (imgs.length === 0 && Array.isArray(p.variants)) {
      for (const v of p.variants) {
        if (Array.isArray(v.images) && v.images.length > 0) {
          imgs = v.images.filter(Boolean);
          break;
        }
      }
    }

    return {
      id: p.id,
      slug: p.slug,
      sku: p.sku,
      name: p.name,
      shortName: p.shortName,
      poeticLine: p.poeticLine,
      craft: p.craft,
      region: p.region,
      category: p.category?.slug || '',
      categoryName: p.category?.name || '',
      mrp: p.mrp,
      sellingPrice: p.sellingPrice,
      salePrice: p.salePrice,
      saleStartsAt: p.saleStartsAt,
      saleEndsAt: p.saleEndsAt,
      images: imgs,
      badges: Array.isArray(p.badges) ? p.badges : [],
      aiTryOnEligible: !!p.aiTryOnEligible,
      aiRoomEligible: !!p.aiRoomEligible,
      codEligible: !!p.codEligible,
      returnEligible: !!p.returnEligible,
      returnPolicy: p.returnPolicy,
      inventory: Array.isArray(p.variants)
        ? p.variants.reduce((s: number, v: any) => s + (v.inventory || 0), 0)
        : 0,
    };
  });

  const breadcrumbs = pathSegments.map((seg, i) => {
    const href = '/categories/' + pathSegments.slice(0, i + 1).join('/');
    const label = seg.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    return { label, href, isLast: i === pathSegments.length - 1 };
  });

  const categoryName =
    resolved.matchedCategory?.name ||
    pathSegments[pathSegments.length - 1]?.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) ||
    'ALL';

  return (
    <>
      <Header />

      <section className="max-w-8xl mx-auto px-6 lg:px-12 pt-10 pb-6">
        <nav className="flex items-center flex-wrap gap-1.5 text-xs tracking-wider text-mitti">
          <Link href="/" className="hover:text-madder uppercase">Home</Link>
          {breadcrumbs.map((b) => (
            <span key={b.href} className="flex items-center gap-1.5">
              <ChevronRight className="w-3 h-3 text-mitti/60" />
              {b.isLast
                ? <span className="text-kohl uppercase font-medium">{b.label}</span>
                : <Link href={b.href} className="hover:text-madder uppercase">{b.label}</Link>}
            </span>
          ))}
        </nav>

        <h1 className="font-display text-4xl lg:text-5xl text-kohl mt-3">
          {categoryName}
        </h1>

        <p className="font-italic italic text-mitti mt-2">
          {products.length} pieces · India's finest craft, curated by hand
        </p>

        <div className="madder-divider mt-4"></div>
      </section>

      <section className="max-w-8xl mx-auto px-6 lg:px-12 py-8">
        {products.length === 0 ? (
          <div className="py-20 text-center">
            <p className="font-display text-2xl text-kohl">Nothing matches yet.</p>
            <p className="font-italic italic text-mitti mt-2">Try removing some filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {products.map((p: any) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </section>

      <Footer />
    </>
  );
}