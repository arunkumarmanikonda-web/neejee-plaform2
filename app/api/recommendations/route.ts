// Cross-sell recommendations — "Complete the Look" / "Pairs Well With"
//
// Given a product (or cart contents), returns 4-6 complementary pieces from the catalogue.
// Uses a simple rule engine: each seed category maps to a list of paired categories/keywords.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Pairings — what goes with what. Tuned for Indian craft commerce.
const PAIRINGS: Array<{
  seeds: string[];           // keywords that match the seed product (name/craft/material/category)
  recommend: string[];        // keywords to find paired pieces
  label: string;              // section heading shown to customer
}> = [
  {
    seeds: ['saree', 'sari'],
    recommend: ['jhumka', 'bangle', 'necklace', 'earring', 'maang', 'pendant', 'blouse', 'clutch', 'stole'],
    label: 'Pairs beautifully with',
  },
  {
    seeds: ['kurta', 'kurti', 'lehenga', 'sherwani'],
    recommend: ['jhumka', 'jutti', 'mojari', 'pocket square', 'stole', 'dupatta', 'pagri', 'necklace'],
    label: 'To wear with this',
  },
  {
    seeds: ['necklace', 'jhumka', 'earring', 'bangle', 'pendant', 'choker'],
    recommend: ['saree', 'kurta', 'lehenga', 'maang tikka', 'anklet', 'ring'],
    label: 'Wear it with',
  },
  {
    seeds: ['console', 'table', 'desk'],
    recommend: ['vase', 'lamp', 'tray', 'planter', 'mirror', 'art', 'incense'],
    label: 'For your console',
  },
  {
    seeds: ['sofa', 'lounge', 'chair', 'armchair', 'bench'],
    recommend: ['cushion', 'throw', 'rug', 'dhurrie', 'side table', 'lamp'],
    label: 'Soften your seating',
  },
  {
    seeds: ['cushion', 'throw', 'rug', 'dhurrie'],
    recommend: ['vase', 'lamp', 'cushion', 'wall', 'art'],
    label: 'Lives well with',
  },
  {
    seeds: ['lamp', 'lantern', 'candle'],
    recommend: ['vase', 'tray', 'incense', 'art', 'mirror'],
    label: 'For warm corners',
  },
  {
    seeds: ['attar', 'perfume', 'incense', 'agarbatti'],
    recommend: ['attar', 'incense', 'pouch', 'gift'],
    label: 'A complete sensory ritual',
  },
];

function pickPairing(haystack: string): { recommend: string[]; label: string } | null {
  const h = haystack.toLowerCase();
  for (const p of PAIRINGS) {
    if (p.seeds.some(s => h.includes(s))) {
      return { recommend: p.recommend, label: p.label };
    }
  }
  return null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const productId = url.searchParams.get('productId');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '6'), 12);

  if (!productId) return NextResponse.json({ products: [], label: null });

  try {
    const seed = await prisma.product.findUnique({
      where: { id: productId },
      select: { name: true, craft: true, material: true, category: { select: { name: true, slug: true } } },
    });
    if (!seed) return NextResponse.json({ products: [], label: null });

    const haystack = [seed.name, seed.craft, seed.material, seed.category?.name].filter(Boolean).join(' ');
    const pairing = pickPairing(haystack);
    if (!pairing) {
      // Fallback: same category, different product
      const fallback = await prisma.product.findMany({
        where: {
          status: 'ACTIVE',
          NOT: { id: productId },
          category: { slug: seed.category?.slug },
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { variants: { select: { inventory: true } } },
      });
      return NextResponse.json({
        label: 'You may also like',
        products: shape(fallback),
      });
    }

    // Build OR query across the paired keywords
    const orClauses = pairing.recommend.flatMap(kw => [
      { name: { contains: kw, mode: 'insensitive' as const } },
      { craft: { contains: kw, mode: 'insensitive' as const } },
      { material: { contains: kw, mode: 'insensitive' as const } },
    ]);

    const matches = await prisma.product.findMany({
      where: {
        status: 'ACTIVE',
        NOT: { id: productId },
        OR: orClauses,
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { variants: { select: { inventory: true } } },
    });

    return NextResponse.json({
      label: pairing.label,
      products: shape(matches),
    });
  } catch (e: any) {
    return NextResponse.json({ products: [], label: null, error: e.message }, { status: 500 });
  }
}

function shape(arr: any[]) {
  return arr.map(p => ({
    id: p.id, slug: p.slug, name: p.name,
    poeticLine: p.poeticLine, craft: p.craft, region: p.region,
    mrp: p.mrp, sellingPrice: p.sellingPrice, salePrice: p.salePrice,
    saleStartsAt: p.saleStartsAt, saleEndsAt: p.saleEndsAt,
    images: Array.isArray(p.images) ? p.images : [],
    badges: Array.isArray(p.badges) ? p.badges : [],
    inventory: (p.variants || []).reduce((s: number, v: any) => s + (v.inventory || 0), 0),
  }));
}
