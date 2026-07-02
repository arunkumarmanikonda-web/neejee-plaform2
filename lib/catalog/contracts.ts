export const PRODUCT_READ_MODEL_VERSION = 'phase1.product-read.v1' as const;

export const CATALOGUE_STOCK_VISIBILITY = [
  'IN_STOCK_ONLY',
  'SHOW_ALL',
  'HIDE_STOCK',
] as const;

export type CatalogueStockVisibility =
  (typeof CATALOGUE_STOCK_VISIBILITY)[number];

export type ProductReadSource = 'catalogue' | 'public_api' | 'category_tree';

export interface ProductReadCategoryNode {
  id: string;
  name: string;
  slug: string;
  path: string | null;
  level: number | null;
  parentId: string | null;
}

export interface ProductReadPricing {
  currency: 'INR';
  mrp: number;
  sellingPrice: number;
  salePrice: number | null;
  effectivePrice: number;
  displayPrice: number;
  onSale: boolean;
  discountAmount: number;
  discountPercent: number;
  saleWindow: {
    startsAt: Date | null;
    endsAt: Date | null;
  };
  gstRate: number | null;
  hsnCode: string | null;
}

export interface ProductReadMedia {
  primaryImage: string | null;
  approvedPrimaryImage: string | null;
  preferredImage: string | null;
  gallery: string[];
  approvedGallery: string[];
  productImages: string[];
  variantImages: string[];
  video: string | null;
  imageApproved: boolean;
  imageQualityScore: number | null;
  selectionMode:
    | 'preferred_override'
    | 'product_gallery'
    | 'variant_fallback'
    | 'none';
  selectionSource:
    | 'gallery'
    | 'external_override'
    | 'product_images'
    | 'variant_images'
    | 'none';
  fallbackApplied: boolean;
  hasMedia: boolean;
  hasApprovedMedia: boolean;
}

export interface ProductReadStock {
  inStock: boolean;
  totalInventory: number;
  lowStock: boolean;
  stockVisibility: CatalogueStockVisibility;
  availableQuantity: number | null;
  showExactQuantity: boolean;
  label: string;
  purchasable: boolean;
}

export interface ProductReadHierarchy {
  lineage: ProductReadCategoryNode[];
  breadcrumb: string[];
  breadcrumbSlugs: string[];
  path: string | null;
  depth: number;
  mainCategory: ProductReadCategoryNode | null;
  subCategory: ProductReadCategoryNode | null;
  subSubCategory: ProductReadCategoryNode | null;
  leafCategory: ProductReadCategoryNode | null;
}

export interface ProductReadCatalogueFlags {
  featured: boolean;
  bestseller: boolean;
  editorial: boolean;
  pinHero: boolean;
  exclude: boolean;
  audienceTag: string | null;
  ctaMode: string | null;
  storyBlock: string | null;
}

export interface ProductReadCatalogueReadiness {
  readyForCatalogue: boolean;
  visibleInFeed: boolean;
  usesApprovedMedia: boolean;
  blockers: string[];
}

export interface ProductReadVariant {
  id: string;
  sku: string;
  size: string | null;
  color: string | null;
  colorHex: string | null;
  material: string | null;
  inventory: number;
  lowStockThreshold: number;
  mrp: number | null;
  sellingPrice: number | null;
  images: string[];
}

export interface ProductReadModel {
  version: typeof PRODUCT_READ_MODEL_VERSION;
  source: ProductReadSource;
  id: string;
  slug: string;
  sku: string;
  sellerId: string | null;
  status: string;
  identity: {
    name: string;
    shortName: string | null;
    poeticLine: string | null;
    description: string | null;
  };
  craft: {
    craft: string | null;
    region: string | null;
    state: string | null;
    cluster: string | null;
    artisanName: string | null;
    material: string | null;
    technique: string | null;
    occasion: string | null;
    story: string | null;
    craftNote: string | null;
    careInstructions: string | null;
    sustainabilityNote: string | null;
  };
  pricing: ProductReadPricing;
  media: ProductReadMedia;
  stock: ProductReadStock;
  hierarchy: ProductReadHierarchy;
  catalogue: ProductReadCatalogueFlags;
  catalogueReadiness: ProductReadCatalogueReadiness;
  badges: string[];
  fulfilment: {
    mode: string | null;
    depositPercent: number | null;
    releaseDate: Date | null;
    editionSize: number | null;
    editionSold: number | null;
  };
  ai: {
    tryOnEligible: boolean;
    roomEligible: boolean;
    arTryOnEligible: boolean;
  };
  policies: {
    codEligible: boolean;
    returnEligible: boolean;
    returnPolicy: string | null;
  };
  category: ProductReadCategoryNode | null;
  variants: ProductReadVariant[];
  timestamps: {
    createdAt: Date;
    updatedAt: Date;
  };
}

export interface ProductReadListEnvelope {
  version: typeof PRODUCT_READ_MODEL_VERSION;
  items: ProductReadModel[];
  meta: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

export const PRODUCT_READ_SAMPLE: ProductReadModel = {
  version: PRODUCT_READ_MODEL_VERSION,
  source: 'catalogue',
  id: 'prod_sample_banarasi_001',
  slug: 'handwoven-banarasi-kadwa-saree',
  sku: 'NJ-BAN-001',
  sellerId: null,
  status: 'ACTIVE',
  identity: {
    name: 'Handwoven Banarasi Kadwa Saree',
    shortName: 'Banarasi Kadwa Saree',
    poeticLine: 'A quiet heirloom in deep madder silk.',
    description: 'A story-first product payload snapshot for Phase 1 read-model work.',
  },
  craft: {
    craft: 'Banarasi',
    region: 'Varanasi',
    state: 'Uttar Pradesh',
    cluster: 'Madanpura',
    artisanName: 'Karim Ansari',
    material: 'Silk',
    technique: 'Kadwa weave',
    occasion: 'Festive',
    story: 'Woven slowly on a handloom, intended as the canonical sample payload for catalogue surfaces.',
    craftNote: 'Test payload only.',
    careInstructions: 'Dry clean only.',
    sustainabilityNote: 'Made in small batches.',
  },
  pricing: {
    currency: 'INR',
    mrp: 620000,
    sellingPrice: 509910,
    salePrice: null,
    effectivePrice: 509910,
    displayPrice: 509910,
    onSale: false,
    discountAmount: 110090,
    discountPercent: 18,
    saleWindow: { startsAt: null, endsAt: null },
    gstRate: 5,
    hsnCode: '5007',
  },
  media: {
    primaryImage: 'https://cdn.example.com/banarasi-primary.jpg',
    approvedPrimaryImage: 'https://cdn.example.com/banarasi-primary.jpg',
    preferredImage: null,
    gallery: [
      'https://cdn.example.com/banarasi-primary.jpg',
      'https://cdn.example.com/banarasi-detail.jpg',
    ],
    approvedGallery: [
      'https://cdn.example.com/banarasi-primary.jpg',
      'https://cdn.example.com/banarasi-detail.jpg',
    ],
    productImages: [
      'https://cdn.example.com/banarasi-primary.jpg',
      'https://cdn.example.com/banarasi-detail.jpg',
    ],
    variantImages: [],
    video: null,
    imageApproved: true,
    imageQualityScore: 92,
    selectionMode: 'product_gallery',
    selectionSource: 'product_images',
    fallbackApplied: false,
    hasMedia: true,
    hasApprovedMedia: true,
  },
  stock: {
    inStock: true,
    totalInventory: 3,
    lowStock: true,
    stockVisibility: 'IN_STOCK_ONLY',
    availableQuantity: null,
    showExactQuantity: false,
    label: 'Low stock',
    purchasable: true,
  },
  hierarchy: {
    lineage: [
      {
        id: 'cat_women',
        name: 'Women',
        slug: 'women',
        path: 'women',
        level: 1,
        parentId: null,
      },
      {
        id: 'cat_sarees',
        name: 'Sarees',
        slug: 'sarees',
        path: 'women/sarees',
        level: 2,
        parentId: 'cat_women',
      },
      {
        id: 'cat_banarasi',
        name: 'Banarasi Sarees',
        slug: 'banarasi-sarees',
        path: 'women/sarees/banarasi-sarees',
        level: 3,
        parentId: 'cat_sarees',
      },
    ],
    breadcrumb: ['Women', 'Sarees', 'Banarasi Sarees'],
    breadcrumbSlugs: ['women', 'sarees', 'banarasi-sarees'],
    path: 'women/sarees/banarasi-sarees',
    depth: 3,
    mainCategory: {
      id: 'cat_women',
      name: 'Women',
      slug: 'women',
      path: 'women',
      level: 1,
      parentId: null,
    },
    subCategory: {
      id: 'cat_sarees',
      name: 'Sarees',
      slug: 'sarees',
      path: 'women/sarees',
      level: 2,
      parentId: 'cat_women',
    },
    subSubCategory: {
      id: 'cat_banarasi',
      name: 'Banarasi Sarees',
      slug: 'banarasi-sarees',
      path: 'women/sarees/banarasi-sarees',
      level: 3,
      parentId: 'cat_sarees',
    },
    leafCategory: {
      id: 'cat_banarasi',
      name: 'Banarasi Sarees',
      slug: 'banarasi-sarees',
      path: 'women/sarees/banarasi-sarees',
      level: 3,
      parentId: 'cat_sarees',
    },
  },
  catalogue: {
    featured: true,
    bestseller: false,
    editorial: true,
    pinHero: false,
    exclude: false,
    audienceTag: 'festive',
    ctaMode: 'SHOP_NOW',
    storyBlock: 'heritage',
  },
  catalogueReadiness: {
    readyForCatalogue: true,
    visibleInFeed: true,
    usesApprovedMedia: true,
    blockers: [],
  },
  badges: ['FOUNDERS_EDIT', 'ARTISAN_MADE'],
  fulfilment: {
    mode: 'IN_STOCK',
    depositPercent: null,
    releaseDate: null,
    editionSize: null,
    editionSold: 0,
  },
  ai: {
    tryOnEligible: false,
    roomEligible: false,
    arTryOnEligible: false,
  },
  policies: {
    codEligible: true,
    returnEligible: true,
    returnPolicy: null,
  },
  category: {
    id: 'cat_banarasi',
    name: 'Banarasi Sarees',
    slug: 'banarasi-sarees',
    path: 'women/sarees/banarasi-sarees',
    level: 3,
    parentId: 'cat_sarees',
  },
  variants: [
    {
      id: 'var_sample_001',
      sku: 'NJ-BAN-001-FS',
      size: 'Free Size',
      color: 'Madder Red',
      colorHex: '#8B2E2A',
      material: 'Silk',
      inventory: 3,
      lowStockThreshold: 3,
      mrp: null,
      sellingPrice: null,
      images: [],
    },
  ],
  timestamps: {
    createdAt: new Date('2026-07-02T00:00:00.000Z'),
    updatedAt: new Date('2026-07-02T00:00:00.000Z'),
  },
};
