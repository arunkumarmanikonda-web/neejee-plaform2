import {
  buildProductReadModel,
  type ProductReadSourceRow,
} from './product-read';

export type PublicProductDetailRow = ProductReadSourceRow & {
  seoTitle?: string | null;
  seoDesc?: string | null;
  seller?: {
    businessName: string | null;
    contactName: string | null;
    region: string | null;
    craft: string | null;
  } | null;
};

export function mapPublicProductDetail(
  row: PublicProductDetailRow,
  read: ReturnType<typeof buildProductReadModel>
) {
  const rawRead = read as any;

  const identity = rawRead.identity ?? {};
  const craft = rawRead.craft ?? {};
  const category = rawRead.category ?? {};
  const hierarchy = rawRead.hierarchy ?? {};
  const pricing = rawRead.pricing ?? {};
  const saleWindow = pricing.saleWindow ?? {};
  const media = rawRead.media ?? {};
  const catalogue = rawRead.catalogue ?? {};
  const ai = rawRead.ai ?? {};
  const policies = rawRead.policies ?? rawRead.purchase ?? rawRead.commerce ?? {};
  const fulfilment = rawRead.fulfilment ?? {};
  const stock = rawRead.stock ?? {};
  const variants = Array.isArray(rawRead.variants) ? rawRead.variants : [];
  const lineage = Array.isArray(hierarchy.lineage) ? hierarchy.lineage : [];

  return {
    id: rawRead.id ?? null,
    slug: rawRead.slug ?? null,
    sku: rawRead.sku ?? null,

    name: identity.name ?? rawRead.name ?? null,
    shortName: identity.shortName ?? rawRead.shortName ?? null,
    poeticLine: identity.poeticLine ?? rawRead.poeticLine ?? null,
    description:
      identity.description ??
      rawRead.description ??
      rawRead.shortDescription ??
      null,

    craft: craft.craft ?? rawRead.craft ?? null,
    region: craft.region ?? rawRead.region ?? null,
    state: craft.state ?? rawRead.state ?? null,
    cluster: craft.cluster ?? rawRead.cluster ?? null,
    artisanName: craft.artisanName ?? rawRead.artisanName ?? null,
    material: craft.material ?? rawRead.material ?? null,
    technique: craft.technique ?? rawRead.technique ?? null,
    occasion: craft.occasion ?? rawRead.occasion ?? null,

    category: row.category ?? hierarchy.leafCategory ?? null,
    categorySlug: category.slug ?? hierarchy.leafCategory?.slug ?? null,
    categoryName: category.name ?? hierarchy.leafCategory?.name ?? null,
    categoryPath: category.path ?? rawRead.categoryPath ?? hierarchy.path ?? null,
    categoryLevel: category.level ?? rawRead.categoryLevel ?? hierarchy.depth ?? null,
    hierarchy,
    breadcrumbs: lineage.map((node: any) => ({
      name: node?.name ?? null,
      href:
        node?.path && String(node.path).trim().length > 0
          ? `/categories/${node.path}`
          : `/categories/${node?.slug ?? ''}`,
    })),

    mrp: pricing.mrp ?? null,
    sellingPrice: pricing.sellingPrice ?? null,
    salePrice: pricing.salePrice ?? null,
    saleStartsAt: saleWindow.startsAt ?? null,
    saleStartAt: saleWindow.startsAt ?? null,
    saleEndsAt: saleWindow.endsAt ?? null,
    saleEndAt: saleWindow.endsAt ?? null,
    gstRate: pricing.gstRate ?? null,
    pricing,

    images: media.gallery ?? [],
    image: media.primaryImage ?? null,
    primaryImage: media.primaryImage ?? null,
    approvedPrimaryImage: media.approvedPrimaryImage ?? null,
    preferredImage: media.preferredImage ?? null,
    productImages: media.productImages ?? [],
    variantImages: media.variantImages ?? [],
    video: media.video ?? null,
    media,

    story: craft.story ?? rawRead.story ?? null,
    craftStory: craft.story ?? rawRead.story ?? null,
    craftNote: craft.craftNote ?? rawRead.craftNote ?? null,
    craftNotes: craft.craftNote ?? rawRead.craftNote ?? null,
    artisanStory: null,
    careInstructions: craft.careInstructions ?? rawRead.careInstructions ?? null,
    deliveryInfo: null,
    storyTitle: catalogue.storyBlock ?? rawRead.catalogueStoryBlock ?? null,
    storyBody: craft.story ?? rawRead.story ?? null,
    sustainabilityNote:
      craft.sustainabilityNote ?? rawRead.sustainabilityNote ?? null,

    badges: rawRead.badges ?? [],

    aiTryOnEligible: ai.tryOnEligible ?? rawRead.aiTryOnEligible ?? false,
    aiRoomEligible: ai.roomEligible ?? rawRead.aiRoomEligible ?? false,
    arTryOnEligible: ai.arTryOnEligible ?? rawRead.arTryOnEligible ?? false,
    arEnabled: ai.arTryOnEligible ?? rawRead.arTryOnEligible ?? false,

    catalogueFeatured: catalogue.featured ?? rawRead.catalogueFeatured ?? false,
    catalogueBestseller: catalogue.bestseller ?? rawRead.catalogueBestseller ?? false,
    catalogueEditorial: catalogue.editorial ?? rawRead.catalogueEditorial ?? false,
    cataloguePinHero: catalogue.pinHero ?? rawRead.cataloguePinHero ?? false,
    cataloguePreferredImage: media.preferredImage ?? null,
    catalogueAudienceTag: catalogue.audienceTag ?? rawRead.catalogueAudienceTag ?? null,
    catalogueCtaMode: catalogue.ctaMode ?? rawRead.catalogueCtaMode ?? null,
    catalogueStoryBlock: catalogue.storyBlock ?? rawRead.catalogueStoryBlock ?? null,
    catalogueImageApproved: media.imageApproved ?? null,
    catalogueImageQualityScore: media.imageQualityScore ?? null,
    catalogueStockVisibility: stock.stockVisibility ?? null,
    catalogueReadiness: rawRead.catalogueReadiness ?? catalogue.readiness ?? null,

    fulfilmentMode: fulfilment.mode ?? rawRead.fulfilmentMode ?? 'IN_STOCK',
    depositPercent: fulfilment.depositPercent ?? rawRead.depositPercent ?? null,
    releaseDate: fulfilment.releaseDate ?? rawRead.releaseDate ?? null,
    editionSize: fulfilment.editionSize ?? rawRead.editionSize ?? null,
    editionSold: fulfilment.editionSold ?? rawRead.editionSold ?? 0,

    codEligible: policies.codEligible ?? rawRead.codEligible ?? false,
    returnEligible: policies.returnEligible ?? rawRead.returnEligible ?? false,
    returnPolicy: policies.returnPolicy ?? rawRead.returnPolicy ?? null,

    variants: variants.map((variant: any) => ({
      id: variant?.id ?? null,
      sku: variant?.sku ?? null,
      size: variant?.size ?? null,
      color: variant?.color ?? null,
      colorHex: variant?.colorHex ?? null,
      material: variant?.material ?? null,
      images: variant?.images ?? variant?.media?.gallery ?? [],
      inventory: variant?.inventory ?? variant?.stock?.totalInventory ?? 0,
      mrp: variant?.mrp ?? variant?.pricing?.mrp ?? null,
      sellingPrice: variant?.sellingPrice ?? variant?.pricing?.sellingPrice ?? null,
      salePrice:
        variant?.salePrice ?? variant?.pricing?.salePrice ?? pricing.salePrice ?? null,
      lowStockThreshold: variant?.lowStockThreshold ?? null,
      inStock:
        typeof variant?.inventory === 'number'
          ? variant.inventory > 0
          : (variant?.stock?.inStock ?? false),
    })),

    inventory: stock.totalInventory ?? 0,
    inventoryCount: stock.totalInventory ?? 0,
    visibleInventory:
      stock.stockVisibility === 'SHOW_ALL'
        ? (stock.availableQuantity ?? stock.totalInventory ?? 0)
        : (stock.totalInventory ?? 0),
    stockVisibleQuantity:
      stock.stockVisibility === 'SHOW_ALL'
        ? (stock.availableQuantity ?? stock.totalInventory ?? 0)
        : (stock.totalInventory ?? 0),
    isInStock: stock.inStock ?? false,
    inStock: stock.inStock ?? false,
    lowStock: stock.lowStock ?? false,
    isLowStock: stock.lowStock ?? false,
    stockLabel: stock.label ?? null,
    availabilityLabel: stock.label ?? null,
    stockVisibility: stock.stockVisibility ?? null,
    totalInventory: stock.totalInventory ?? 0,
    stock,

    seller: row.seller ?? null,

    seoTitle: row.seoTitle ?? null,
    seoDesc: row.seoDesc ?? null,

    source: rawRead.source ?? null,
    version: rawRead.version ?? null,
    timestamps: rawRead.timestamps ?? null,
  };
}
