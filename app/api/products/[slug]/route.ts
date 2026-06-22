// Public single-product endpoint — used by PDP
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: { slug: string } }) {
  try {
    const p: any = await prisma.product.findFirst({
      where: { OR: [{ slug: params.slug }, { id: params.slug }, { sku: params.slug }], status: 'ACTIVE' },
      include: {
        category: { select: { slug: true, name: true } },
        variants: { orderBy: { sku: 'asc' } },
        seller: { select: { businessName: true, contactName: true, region: true, craft: true } },
      },
    });
    if (!p) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    return NextResponse.json({
      product: {
        id: p.id,
        slug: p.slug,
        sku: p.sku,
        name: p.name,
        shortName: p.shortName,
        poeticLine: p.poeticLine,
        description: p.description,
        craft: p.craft,
        region: p.region,
        state: p.state,
        cluster: p.cluster,
        artisanName: p.artisanName,
        material: p.material,
        technique: p.technique,
        occasion: p.occasion,
        category: p.category,
        mrp: p.mrp,
        sellingPrice: p.sellingPrice,
        salePrice: p.salePrice,
        saleStartsAt: p.saleStartsAt,
        saleEndsAt: p.saleEndsAt,
        gstRate: p.gstRate,
        // Thumbnail/hero fallback: when Product.images is empty, expose the
        // first variant gallery so the PDP hero and OG image still render.
        images: (() => {
          const base = Array.isArray(p.images) ? p.images.filter(Boolean) : [];
          if (base.length > 0) return base;
          for (const v of (p.variants || [])) {
            const vi = Array.isArray((v as any).images) ? (v as any).images.filter(Boolean) : [];
            if (vi.length > 0) return vi;
          }
          return [];
        })(),
        video: p.video,
        story: p.story,
        craftNote: p.craftNote,
        careInstructions: p.careInstructions,
        sustainabilityNote: p.sustainabilityNote,
        badges: Array.isArray(p.badges) ? p.badges : [],
        aiTryOnEligible: !!p.aiTryOnEligible,
        aiRoomEligible: !!p.aiRoomEligible,
        arTryOnEligible: !!p.arTryOnEligible,
        fulfilmentMode: p.fulfilmentMode || 'IN_STOCK',
        depositPercent: p.depositPercent ?? null,
        releaseDate: p.releaseDate ? p.releaseDate.toISOString() : null,
        editionSize: p.editionSize ?? null,
        editionSold: p.editionSold ?? 0,
        codEligible: p.codEligible !== false,
        returnEligible: p.returnEligible !== false,
        returnPolicy: p.returnPolicy || null,
        variants: p.variants.map((v: any) => ({
          id: v.id, sku: v.sku, size: v.size, color: v.color, colorHex: v.colorHex ?? null,
          material: v.material,
          images: Array.isArray(v.images) ? v.images : [],
          inventory: v.inventory, mrp: v.mrp, sellingPrice: v.sellingPrice,
          inStock: v.inventory > 0,
        })),
        totalInventory: p.variants.reduce((s: number, v: any) => s + (v.inventory || 0), 0),
        seller: p.seller,
        seoTitle: p.seoTitle,
        seoDesc: p.seoDesc,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
