// Cross-sell recommendations — catalogue-backed and inventory-aware.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PAIRINGS: Array<{ seeds: string[]; recommend: string[]; label: string }> = [
  { seeds: ['saree', 'sari'], recommend: ['jhumka', 'bangle', 'necklace', 'earring', 'maang', 'pendant', 'brooch', 'pin', 'clutch', 'potli', 'jutti', 'attar'], label: 'Complete your look' },
  { seeds: ['kurta', 'kurti', 'lehenga', 'sherwani'], recommend: ['jhumka', 'earring', 'jutti', 'mojari', 'pocket square', 'stole', 'dupatta', 'pagri', 'necklace', 'potli'], label: 'Style the look' },
  { seeds: ['necklace', 'jhumka', 'earring', 'bangle', 'pendant', 'choker'], recommend: ['saree', 'kurta', 'lehenga', 'maang tikka', 'anklet', 'ring', 'potli'], label: 'Wear it with' },
  { seeds: ['console', 'chester', 'sideboard', 'desk'], recommend: ['vase', 'lamp', 'tray', 'planter', 'mirror', 'frame', 'art', 'sculpture', 'incense'], label: 'Complete this setting' },
  { seeds: ['side table', 'bedside table'], recommend: ['lamp', 'frame', 'vase', 'tray', 'candle', 'incense'], label: 'For this table' },
  { seeds: ['sofa', 'lounge', 'chair', 'armchair', 'bench'], recommend: ['cushion', 'throw', 'rug', 'dhurrie', 'side table', 'lamp', 'floor lamp'], label: 'Complete this corner' },
  { seeds: ['dining table'], recommend: ['tableware', 'runner', 'vase', 'centre', 'candle', 'pendant', 'lamp'], label: 'Set the table' },
  { seeds: ['bed'], recommend: ['bedsheet', 'duvet', 'dohar', 'quilt', 'cushion', 'throw', 'bedside table', 'lamp'], label: 'Complete the room' },
  { seeds: ['cushion', 'throw', 'rug', 'dhurrie'], recommend: ['vase', 'lamp', 'cushion', 'wall', 'art', 'side table'], label: 'Lives well with' },
  { seeds: ['lamp', 'lantern', 'candle'], recommend: ['vase', 'tray', 'incense', 'art', 'mirror', 'side table', 'console'], label: 'For warm corners' },
  { seeds: ['attar', 'perfume', 'incense', 'agarbatti'], recommend: ['attar', 'incense', 'pouch', 'gift', 'candle'], label: 'A complete sensory ritual' },
];

type Pairing = { recommend: string[]; label: string };

function pickPairing(haystack: string): Pairing | null {
  const normalized = haystack.toLowerCase();
  for (const pairing of PAIRINGS) {
    if (pairing.seeds.some((seed) => normalized.includes(seed))) {
      return { recommend: pairing.recommend, label: pairing.label };
    }
  }
  return null;
}

function parseIds(url: URL): string[] {
  const single = url.searchParams.get('productId');
  const many = url.searchParams.get('productIds');
  return Array.from(new Set([
    ...(single ? [single] : []),
    ...(many ? many.split(',') : []),
  ].map((id) => id.trim()).filter(Boolean)))
    .filter((id) => id.length <= 120)
    .slice(0, 20);
}

const recommendationSelect = {
  id: true,
  slug: true,
  name: true,
  poeticLine: true,
  craft: true,
  region: true,
  mrp: true,
  sellingPrice: true,
  salePrice: true,
  saleStartsAt: true,
  saleEndsAt: true,
  images: true,
  badges: true,
  aiTryOnEligible: true,
  aiRoomEligible: true,
  variants: {
    select: { id: true, size: true, color: true, inventory: true },
  },
} as const;

function cachedJson(body: unknown) {
  const response = NextResponse.json(body);
  response.headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=120');
  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const seedIds = parseIds(url);
  const limit = Math.min(Math.max(Number.parseInt(url.searchParams.get('limit') || '6', 10) || 6, 1), 12);
  if (seedIds.length === 0) return cachedJson({ products: [], label: null });

  try {
    const seeds = await prisma.product.findMany({
      where: { id: { in: seedIds }, status: 'ACTIVE', catalogueExclude: false },
      select: { id: true, name: true, craft: true, material: true, category: { select: { name: true, slug: true } } },
    });
    if (seeds.length === 0) return cachedJson({ products: [], label: null });

    const pairings = seeds
      .map((seed) => pickPairing([seed.name, seed.craft, seed.material, seed.category?.name].filter(Boolean).join(' ')))
      .filter((value): value is Pairing => Boolean(value));

    const recommendedKeywords = Array.from(new Set(pairings.flatMap((pairing) => pairing.recommend)));
    const label = seeds.length > 1 ? 'Complete your edit' : pairings[0]?.label || 'You may also like';

    if (recommendedKeywords.length === 0) {
      const categorySlug = seeds[0].category?.slug;
      if (!categorySlug) return cachedJson({ products: [], label });

      const fallback = await prisma.product.findMany({
        where: {
          status: 'ACTIVE',
          catalogueExclude: false,
          id: { notIn: seedIds },
          category: { slug: categorySlug },
          variants: { some: { inventory: { gt: 0 } } },
        },
        take: limit,
        orderBy: [{ catalogueFeatured: 'desc' }, { createdAt: 'desc' }],
        select: recommendationSelect,
      });
      return cachedJson({ label, products: shape(fallback) });
    }

    const orClauses = recommendedKeywords.flatMap((keyword) => [
      { name: { contains: keyword, mode: 'insensitive' as const } },
      { craft: { contains: keyword, mode: 'insensitive' as const } },
      { material: { contains: keyword, mode: 'insensitive' as const } },
      { category: { name: { contains: keyword, mode: 'insensitive' as const } } },
    ]);

    const matches = await prisma.product.findMany({
      where: {
        status: 'ACTIVE',
        catalogueExclude: false,
        id: { notIn: seedIds },
        variants: { some: { inventory: { gt: 0 } } },
        OR: orClauses,
      },
      take: limit,
      orderBy: [{ catalogueFeatured: 'desc' }, { catalogueBestseller: 'desc' }, { createdAt: 'desc' }],
      select: recommendationSelect,
    });

    return cachedJson({
      label,
      products: shape(matches),
      context: { seedCount: seeds.length, basketAware: seeds.length > 1 },
    });
  } catch (error: any) {
    console.error('[recommendations] failed', { message: error?.message });
    return NextResponse.json({ products: [], label: null, error: 'Recommendations are temporarily unavailable' }, { status: 500 });
  }
}

function shape(products: any[]) {
  return products
    .map((product) => {
      const inStockVariants = (product.variants || []).filter((variant: any) => Number(variant.inventory || 0) > 0);
      const singleVariant = inStockVariants.length === 1 ? inStockVariants[0] : null;
      return {
        id: product.id,
        slug: product.slug,
        name: product.name,
        poeticLine: product.poeticLine,
        craft: product.craft,
        region: product.region,
        mrp: product.mrp,
        sellingPrice: product.sellingPrice,
        salePrice: product.salePrice,
        saleStartsAt: product.saleStartsAt,
        saleEndsAt: product.saleEndsAt,
        images: Array.isArray(product.images) ? product.images : [],
        badges: Array.isArray(product.badges) ? product.badges : [],
        inventory: inStockVariants.reduce((sum: number, variant: any) => sum + Math.max(0, variant.inventory || 0), 0),
        aiTryOnEligible: !!product.aiTryOnEligible,
        aiRoomEligible: !!product.aiRoomEligible,
        requiresChoice: inStockVariants.length > 1,
        quickAddVariant: singleVariant ? {
          id: singleVariant.id,
          size: singleVariant.size || null,
          color: singleVariant.color || null,
          label: [singleVariant.size, singleVariant.color].filter(Boolean).join(' · ') || null,
        } : null,
      };
    })
    .filter((product) => product.inventory > 0);
}
