// Public facets endpoint — returns Craft/Region/Material counts for a category (flexible match)
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveCategoryWhere } from '@/lib/category-resolve';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const category = url.searchParams.get('category');

  try {
    let where: any = { status: 'ACTIVE' };
    let matched: any = null;
    if (category) {
      const r = await resolveCategoryWhere(category);
      where = r.where;
      matched = r.matchedCategory;
    }

    const products = await prisma.product.findMany({
      where,
      select: {
        craft: true, region: true, material: true, occasion: true,
        badges: true,
        sellingPrice: true, salePrice: true,
      },
    });

    // v23.40.25 — Sanitize tag-style facets:
    //   • trim whitespace
    //   • reject empty or null
    //   • reject anything that looks like a sentence (> 40 chars or contains '.' or '!') —
    //     those are descriptions accidentally typed into the tag field, NOT facet labels.
    //   • normalize case-insensitively (Banarasi == BANARASI == banarasi → "Banarasi")
    const isFacetLabel = (s: string) => {
      const t = s.trim();
      if (!t) return false;
      if (t.length > 40) return false;
      // Sentences usually contain a period or exclamation; tags don't
      if (/[.!]/.test(t)) return false;
      // Multi-clause descriptions usually have multiple commas
      const commas = (t.match(/,/g) || []).length;
      if (commas > 1) return false;
      return true;
    };
    const titleCase = (s: string) =>
      s.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

    const tally = (arr: (string | null)[]) => {
      const map: Record<string, { display: string; count: number }> = {};
      for (const v of arr) {
        if (!v || !isFacetLabel(v)) continue;
        const key = v.trim().toLowerCase();
        const display = titleCase(v);
        if (!map[key]) map[key] = { display, count: 0 };
        map[key].count += 1;
      }
      return Object.values(map)
        .map(({ display, count }) => [display, count] as [string, number])
        .sort((a, b) => b[1] - a[1]);
    };

    // Badge facet — product.badges is a string[], so flatten then tally
    const allBadges: string[] = [];
    for (const p of products) {
      if (Array.isArray(p.badges)) {
        for (const b of p.badges) if (b && typeof b === 'string') allBadges.push(b);
      }
    }
    const tallyBadges = () => {
      const map: Record<string, { display: string; count: number }> = {};
      for (const v of allBadges) {
        const key = v.trim().toLowerCase();
        const display = v.trim();
        if (!map[key]) map[key] = { display, count: 0 };
        map[key].count += 1;
      }
      return Object.values(map)
        .map(({ display, count }) => [display, count] as [string, number])
        .sort((a, b) => b[1] - a[1]);
    };

    const prices = products.map((p: any) => p.sellingPrice).filter((n: any) => n > 0);

    return NextResponse.json({
      matchedCategory: matched,
      crafts: tally(products.map((p: any) => p.craft)),
      regions: tally(products.map((p: any) => p.region)),
      materials: tally(products.map((p: any) => p.material)),
      occasions: tally(products.map((p: any) => p.occasion)),
      badges: tallyBadges(),
      priceRange: {
        minPaise: prices.length ? Math.min(...prices) : 0,
        maxPaise: prices.length ? Math.max(...prices) : 0,
      },
      total: products.length,
    });
  } catch (e: any) {
    return NextResponse.json({
      crafts: [], regions: [], materials: [], occasions: [], badges: [], total: 0,
      priceRange: { minPaise: 0, maxPaise: 0 }, error: e.message,
    }, { status: 500 });
  }
}
