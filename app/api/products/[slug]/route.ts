// Public single-product endpoint — used by PDP
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CANONICAL_STOCK_VISIBILITY = [
  'IN_STOCK_ONLY',
  'SHOW_ALL',
  'HIDE_STOCK',
] as const;

type CanonicalStockVisibility =
  (typeof CANONICAL_STOCK_VISIBILITY)[number];

function normalizeText(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? '').trim())
    .filter(Boolean);
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizeStockVisibility(
  value: unknown
): CanonicalStockVisibility {
  const raw = normalizeText(value)?.toUpperCase();

  if (!raw) return 'IN_STOCK_ONLY';
  if (raw === 'SHOW_ALL' || raw === 'SHOW_EXACT') return 'SHOW_ALL';
  if (raw === 'HIDE_STOCK') return 'HIDE_STOCK';
  if (raw === 'LOW_STOCK_BADGE' || raw === 'IN_STOCK_ONLY') return 'IN_STOCK_ONLY';

  return 'IN_STOCK_ONLY';
}

function isSaleLive(product: any, now = new Date()): boolean {
  const salePrice =
    typeof product?.salePrice === 'number'
      ? product.salePrice
      : Number.parseInt(String(product?.salePrice ?? ''), 10);

  const sellingPrice =
    typeof product?.sellingPrice === 'number'
      ? product.sellingPrice
      : Number.parseInt(String(product?.sellingPrice ?? ''), 10);

  if (!Number.isFinite(salePrice) || salePrice <= 0) return false;
  if (!Number.isFinite(sellingPrice) || sellingPrice <= 0) return false;
  if (salePrice >= sellingPrice) return false;

  const startsAt = product?.saleStartsAt ? new Date(product.saleStartsAt) : null;
  const endsAt = product?.saleEndsAt ? new Date(product.saleEndsAt) : null;

  if (startsAt && Number.isNaN(startsAt.getTime())) return false;
  if (endsAt && Number.isNaN(endsAt.getTime())) return false;

  if (startsAt && now < startsAt) return false;
  if (endsAt && now > endsAt) return false;

  return true;
}

function buildPricing(product: any, now = new Date()) {
  const mrp =
    typeof product?.mrp === 'number'
      ? product.mrp
      : Number.parseInt(String(product?.mrp ?? 0), 10) || 0;

  const sellingPrice =
    typeof product?.sellingPrice === 'number'
      ? product.sellingPrice
      : Number.parseInt(String(product?.sellingPrice ?? 0), 10) || 0;

  const liveSale = isSaleLive(product, now);
  const parsedSalePrice =
    typeof product?.salePrice === 'number'
      ? product.salePrice
      : Number.parseInt(String(product?.salePrice ?? 0), 10) || 0;

  const salePrice = liveSale && parsedSalePrice > 0 ? parsedSalePrice : null;
  const effectivePrice = salePrice && salePrice > 0 ? salePrice : sellingPrice;

  const discountAmount =
    mrp > 0 && effectivePrice > 0 && mrp > effectivePrice
      ? mrp - effectivePrice
      : 0;

  const discountPercent =
    mrp > 0 && discountAmount > 0
      ? Math.round((discountAmount / mrp) * 100)
      : 0;

  return {
    mrp,
    sellingPrice,
    salePrice,
    effectivePrice,
    onSale: liveSale,
    discountAmount,
    discountPercent,
    saleStartsAt: product?.saleStartsAt ?? null,
    saleEndsAt: product?.saleEndsAt ?? null,
    gstRate: product?.gstRate ?? null,
    currency: 'INR',
  };
}

function buildMedia(product: any) {
  const preferredImage = normalizeText(product?.cataloguePreferredImage);
  const productImages = dedupeStrings(toStringArray(product?.images));
  const variantImages = dedupeStrings(
    (Array.isArray(product?.variants) ? product.variants : []).flatMap((variant: any) =>
      toStringArray(variant?.images)
    )
  );

  const gallery = dedupeStrings([...productImages, ...variantImages]);

  let primaryImage: string | null = null;
  let selectionMode = 'none';

  if (preferredImage) {
    primaryImage = preferredImage;
    selectionMode = 'preferred_override';
  } else if (productImages.length > 0) {
    primaryImage = productImages[0];
    selectionMode = 'product_gallery';
  } else if (variantImages.length > 0) {
    primaryImage = variantImages[0];
    selectionMode = 'variant_fallback';
  }

  return {
    primaryImage,
    preferredImage,
    gallery,
    productImages,
    variantImages,
    imageApproved: !!product?.catalogueImageApproved,
    imageQualityScore: product?.catalogueImageQualityScore ?? null,
    selectionMode,
    approvedPrimaryImage:
      !!product?.catalogueImageApproved && primaryImage ? primaryImage : null,
    approvedGallery: !!product?.catalogueImageApproved ? gallery : [],
    video: product?.video ?? null,
  };
}

function buildStock(product: any) {
  const variants = Array.isArray(product?.variants) ? product.variants : [];

  const totalInventory = variants.reduce((sum: number, variant: any) => {
    const qty =
      typeof variant?.inventory === 'number'
        ? variant.inventory
        : Number.parseInt(String(variant?.inventory ?? 0), 10) || 0;

    return sum + qty;
  }, 0);

  const lowStock = variants.some((variant: any) => {
    const qty =
      typeof variant?.inventory === 'number'
        ? variant.inventory
        : Number.parseInt(String(variant?.inventory ?? 0), 10) || 0;

    const threshold =
      typeof variant?.lowStockThreshold === 'number'
        ? variant.lowStockThreshold
        : Number.parseInt(String(variant?.lowStockThreshold ?? 3), 10) || 3;

    return qty > 0 && qty <= threshold;
  });

  const stockVisibility = normalizeStockVisibility(
    product?.catalogueStockVisibility
  );

  const inStock = totalInventory > 0;
  const availableQuantity = stockVisibility === 'SHOW_ALL' ? totalInventory : null;

  let label = 'Out of stock';

  if (stockVisibility === 'HIDE_STOCK') {
    label = inStock ? 'Available' : 'Unavailable';
  } else if (stockVisibility === 'SHOW_ALL') {
    label = inStock ? `${totalInventory} available` : 'Out of stock';
  } else {
    label = inStock ? (lowStock ? 'Low stock' : 'In stock') : 'Out of stock';
  }

  return {
    inStock,
    totalInventory,
    lowStock,
    stockVisibility,
    availableQuantity,
    label,
    purchasable: inStock,
  };
}

function buildHierarchy(category: any) {
  if (!category) {
    return {
      lineage: [],
      breadcrumb: [],
      breadcrumbSlugs: [],
      path: null,
      depth: 0,
      mainCategory: null,
      subCategory: null,
      subSubCategory: null,
      leafCategory: null,
    };
  }

  const lineage: Array<{
    id: string;
    name: string;
    slug: string;
    path: string | null;
    level: number | null;
    parentId: string | null;
  }> = [];

  let current: any = category;

  while (current) {
    lineage.push({
      id: current.id,
      name: current.name,
      slug: current.slug,
      path: current.path ?? null,
      level: typeof current.level === 'number' ? current.level : null,
      parentId: current.parentId ?? null,
    });
    current = current.parent ?? null;
  }

  lineage.reverse();

  return {
    lineage,
    breadcrumb: lineage.map((node) => node.name),
    breadcrumbSlugs: lineage.map((node) => node.slug),
    path:
      normalizeText(category.path) ||
      (lineage.length > 0 ? lineage.map((node) => node.slug).join('/') : null),
    depth: lineage.length,
    mainCategory: lineage[0] ?? null,
    subCategory: lineage[1] ?? null,
    subSubCategory: lineage[2] ?? null,
    leafCategory: lineage[lineage.length - 1] ?? null,
  };
}

export async function GET(
  _request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const p: any = await prisma.product.findFirst({
      where: {
        OR: [
          { slug: params.slug },
          { id: params.slug },
          { sku: params.slug },
        ],
        status: 'ACTIVE',
        catalogueExclude: false,
      },
      include: {
        category: {
          select: {
            id: true,
            slug: true,
            name: true,
            path: true,
            level: true,
            parentId: true,
            parent: {
              select: {
                id: true,
                slug: true,
                name: true,
                path: true,
                level: true,
                parentId: true,
                parent: {
                  select: {
                    id: true,
                    slug: true,
                    name: true,
                    path: true,
                    level: true,
                    parentId: true,
                  },
                },
              },
            },
          },
        },
        variants: { orderBy: { sku: 'asc' } },
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

    if (!p) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const now = new Date();
    const pricing = buildPricing(p, now);
    const media = buildMedia(p);
    const stock = buildStock(p);
    const hierarchy = buildHierarchy(p.category);

    return NextResponse.json({
      readModel: {
        version: 'phase1.public.product.v1',
        stockVisibility: CANONICAL_STOCK_VISIBILITY,
      },
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
        categorySlug: p.category?.slug ?? null,
        categoryName: p.category?.name ?? null,
        categoryPath: p.category?.path ?? null,
        categoryLevel: p.category?.level ?? null,
        hierarchy,

        mrp: pricing.mrp,
        sellingPrice: pricing.sellingPrice,
        salePrice: pricing.salePrice,
        saleStartsAt: pricing.saleStartsAt,
        saleEndsAt: pricing.saleEndsAt,
        gstRate: p.gstRate,
        pricing,

        images: media.gallery,
        image: media.primaryImage,
        primaryImage: media.primaryImage,
        preferredImage: media.preferredImage,
        productImages: media.productImages,
        variantImages: media.variantImages,
        video: p.video,
        media,

        story: p.story,
        craftNote: p.craftNote,
        careInstructions: p.careInstructions,
        sustainabilityNote: p.sustainabilityNote,

        badges: Array.isArray(p.badges) ? p.badges : [],

        aiTryOnEligible: !!p.aiTryOnEligible,
        aiRoomEligible: !!p.aiRoomEligible,
        arTryOnEligible: !!p.arTryOnEligible,

        catalogueFeatured: !!p.catalogueFeatured,
        catalogueBestseller: !!p.catalogueBestseller,
        catalogueEditorial: !!p.catalogueEditorial,
        cataloguePinHero: !!p.cataloguePinHero,
        cataloguePreferredImage: p.cataloguePreferredImage || null,
        catalogueAudienceTag: p.catalogueAudienceTag || null,
        catalogueCtaMode: p.catalogueCtaMode || null,
        catalogueStoryBlock: p.catalogueStoryBlock || null,
        catalogueImageApproved: !!p.catalogueImageApproved,
        catalogueImageQualityScore: p.catalogueImageQualityScore ?? null,
        catalogueStockVisibility: stock.stockVisibility,

        fulfilmentMode: p.fulfilmentMode || 'IN_STOCK',
        depositPercent: p.depositPercent ?? null,
        releaseDate: p.releaseDate ? p.releaseDate.toISOString() : null,
        editionSize: p.editionSize ?? null,
        editionSold: p.editionSold ?? 0,

        codEligible: p.codEligible !== false,
        returnEligible: p.returnEligible !== false,
        returnPolicy: p.returnPolicy || null,

        variants: p.variants.map((v: any) => ({
          id: v.id,
          sku: v.sku,
          size: v.size,
          color: v.color,
          colorHex: v.colorHex ?? null,
          material: v.material,
          images: Array.isArray(v.images) ? v.images : [],
          inventory: v.inventory,
          mrp: v.mrp,
          sellingPrice: v.sellingPrice,
          lowStockThreshold: v.lowStockThreshold ?? null,
          inStock: v.inventory > 0,
        })),

        totalInventory: stock.totalInventory,
        stock,

        seller: p.seller,

        seoTitle: p.seoTitle,
        seoDesc: p.seoDesc,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
