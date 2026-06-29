import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveCategoryWhere } from '@/lib/category-resolve';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type HierarchyNode = {
  id: string;
  slug: string;
  name: string;
  level: number;
  path: string | null;
};

function isSaleLive(p: any): boolean {
  if (!p.salePrice) return false;
  const now = Date.now();
  const start = p.saleStartsAt ? new Date(p.saleStartsAt).getTime() : null;
  const end = p.saleEndsAt ? new Date(p.saleEndsAt).getTime() : null;
  if (start && now < start) return false;
  if (end && now > end) return false;
  return true;
}

function allImagesForProduct(p: any): string[] {
  const base = Array.isArray(p.images) ? p.images.filter(Boolean) : [];
  if (base.length > 0) return [...new Set(base)];

  const fromVariants: string[] = [];
  for (const v of p.variants || []) {
    const vi = Array.isArray(v.images) ? v.images.filter(Boolean) : [];
    fromVariants.push(...vi);
  }
  return [...new Set(fromVariants)];
}

function choosePreferredImage(p: any): string | null {
  const images = allImagesForProduct(p);
  if (!images.length) return null;
  if (p.cataloguePreferredImage && images.includes(p.cataloguePreferredImage)) {
    return p.cataloguePreferredImage;
  }
  return images[0];
}

function deriveStock(p: any) {
  const totalInventory = (p.variants || []).reduce((sum: number, v: any) => sum + (v.inventory || 0), 0);
  const inStock = totalInventory > 0;
  const lowStock = (p.variants || []).some(
    (v: any) => v.inventory > 0 && v.inventory <= (v.lowStockThreshold || 3)
  );

  return { totalInventory, inStock, lowStock };
}

async function resolveHierarchy(category: any): Promise<{
  mainCategory: HierarchyNode | null;
  subCategory: HierarchyNode | null;
  subSubCategory: HierarchyNode | null;
}> {
  if (!category) {
    return { mainCategory: null, subCategory: null, subSubCategory: null };
  }

  const pathSlugs = (category.path || category.slug || '')
    .split('/')
    .map((s: string) => s.trim())
    .filter(Boolean);

  if (!pathSlugs.length) {
    const selfNode: HierarchyNode = {
      id: category.id,
      slug: category.slug,
      name: category.name,
      level: category.level || 1,
      path: category.path || null,
    };

    return {
      mainCategory: category.level === 1 ? selfNode : null,
      subCategory: category.level === 2 ? selfNode : null,
      subSubCategory: category.level === 3 ? selfNode : null,
    };
  }

  const nodes = await prisma.category.findMany({
    where: { slug: { in: pathSlugs } },
    select: { id: true, slug: true, name: true, level: true, path: true },
  });

  const ordered = pathSlugs
    .map((slug) => nodes.find((n) => n.slug === slug))
    .filter(Boolean) as HierarchyNode[];

  return {
    mainCategory: ordered[0] || null,
    subCategory: ordered[1] || null,
    subSubCategory: ordered[2] || null,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);

  const category = url.searchParams.get('category');
  const q = url.searchParams.get('q');
  const audience = url.searchParams.get('audience');
  const includeExcluded = url.searchParams.get('includeExcluded') === 'true';
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 250);

  try {
    let where: any;
    let matchedCategory: any = null;
    const and: any[] = [];

    if (category) {
      const r = await resolveCategoryWhere(category);
      where = r.where;
      matchedCategory = r.matchedCategory;
    } else {
      where = { status: 'ACTIVE' };
    }

    if (!includeExcluded) {
      and.push({ catalogueExclude: false });
    }

    if (audience) {
      and.push({ catalogueAudienceTag: { equals: audience, mode: 'insensitive' } });
    }

    if (q) {
      and.push({
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { shortName: { contains: q, mode: 'insensitive' } },
          { poeticLine: { contains: q, mode: 'insensitive' } },
          { craft: { contains: q, mode: 'insensitive' } },
          { region: { contains: q, mode: 'insensitive' } },
          { artisanName: { contains: q, mode: 'insensitive' } },
          { material: { contains: q, mode: 'insensitive' } },
          { technique: { contains: q, mode: 'insensitive' } },
          { occasion: { contains: q, mode: 'insensitive' } },
        ],
      });
    }

    if (and.length > 0) {
      where.AND = [...(where.AND || []), ...and];
    }

    const products = await prisma.product.findMany({
      where,
      take: limit,
      orderBy: [
        { cataloguePinHero: 'desc' },
        { catalogueFeatured: 'desc' },
        { catalogueBestseller: 'desc' },
        { createdAt: 'desc' },
      ],
      include: {
        category: {
          select: {
            id: true,
            slug: true,
            name: true,
            level: true,
            path: true,
            parentId: true,
            featured: true,
          },
        },
        variants: {
          select: {
            id: true,
            sku: true,
            size: true,
            color: true,
            material: true,
            images: true,
            inventory: true,
            lowStockThreshold: true,
            mrp: true,
            sellingPrice: true,
          },
          orderBy: { sku: 'asc' },
        },
        seller: {
          select: {
            businessName: true,
            contactName: true,
            region: true,
            craft: true,
          },
        },
      },
    });

    const items = await Promise.all(
      products.map(async (p: any) => {
        const hierarchy = await resolveHierarchy(p.category);
        const mediaGallery = allImagesForProduct(p);
        const preferredImage = choosePreferredImage(p);
        const fallbackImage = mediaGallery[0] || null;
        const stock = deriveStock(p);
        const liveSale = isSaleLive(p);
        const displayPrice = liveSale ? p.salePrice : p.sellingPrice;

        return {
          id: p.id,
          slug: p.slug,
          sku: p.sku,
          name: p.name,
          shortName: p.shortName || null,
          poeticLine: p.poeticLine || null,
          description: p.description || null,

          hierarchy: {
            mainCategory: hierarchy.mainCategory,
            subCategory: hierarchy.subCategory,
            subSubCategory: hierarchy.subSubCategory,
            currentCategory: p.category
              ? {
                  id: p.category.id,
                  slug: p.category.slug,
                  name: p.category.name,
                  level: p.category.level,
                  path: p.category.path,
                }
              : null,
          },

          editorialFlags: {
            featured: !!p.catalogueFeatured,
            bestseller: !!p.catalogueBestseller,
            editorial: !!p.catalogueEditorial,
            pinHero: !!p.cataloguePinHero,
            excluded: !!p.catalogueExclude,
          },

          curation: {
            audienceTag: p.catalogueAudienceTag || null,
            ctaMode: p.catalogueCtaMode || null,
            storyBlock: p.catalogueStoryBlock || null,
          },

          content: {
            story: p.story || null,
            craftNote: p.craftNote || null,
            careInstructions: p.careInstructions || null,
            sustainabilityNote: p.sustainabilityNote || null,
          },

          media: {
            preferredImage,
            fallbackImage,
            selectedImage: preferredImage || fallbackImage,
            gallery: mediaGallery,
            video: p.video || null,
            approved: !!p.catalogueImageApproved,
            qualityScore: p.catalogueImageQualityScore ?? null,
          },

          pricing: {
            mrp: p.mrp,
            sellingPrice: p.sellingPrice,
            salePrice: p.salePrice,
            liveSale,
            displayPrice,
            gstRate: p.gstRate,
            hsnCode: p.hsnCode || null,
            fulfilmentMode: p.fulfilmentMode || 'IN_STOCK',
            depositPercent: p.depositPercent ?? null,
            releaseDate: p.releaseDate ? p.releaseDate.toISOString() : null,
            editionSize: p.editionSize ?? null,
            editionSold: p.editionSold ?? 0,
          },

          stock: {
            visibilityMode: p.catalogueStockVisibility || 'IN_STOCK_ONLY',
            inStock: stock.inStock,
            totalInventory: stock.totalInventory,
            lowStock: stock.lowStock,
          },

          commerce: {
            codEligible: p.codEligible !== false,
            returnEligible: p.returnEligible !== false,
            returnPolicy: p.returnPolicy || null,
          },

          attributes: {
            craft: p.craft || null,
            region: p.region || null,
            state: p.state || null,
            cluster: p.cluster || null,
            artisanName: p.artisanName || null,
            material: p.material || null,
            technique: p.technique || null,
            occasion: p.occasion || null,
            badges: Array.isArray(p.badges) ? p.badges : [],
          },

          seller: p.seller || null,

          variants: (p.variants || []).map((v: any) => ({
            id: v.id,
            sku: v.sku,
            size: v.size || null,
            color: v.color || null,
            material: v.material || null,
            inventory: v.inventory || 0,
            inStock: (v.inventory || 0) > 0,
            mrp: v.mrp ?? null,
            sellingPrice: v.sellingPrice ?? null,
            images: Array.isArray(v.images) ? v.images.filter(Boolean) : [],
          })),
        };
      })
    );

    return NextResponse.json({
      matchedCategory,
      count: items.length,
      items,
    });
  } catch (e: any) {
    console.error('[catalog.products] error:', e?.message);
    return NextResponse.json(
      { error: e.message || 'Failed to build catalogue read model', items: [], count: 0 },
      { status: 500 }
    );
  }
}
