export type MerchLaunchStatus = 'DRAFT' | 'SCHEDULED' | 'LIVE' | 'CLOSED';

export type MerchandisingProduct = {
  id: string;
  slug: string | null;
  sku: string | null;
  name: string;
  categoryName: string | null;
  categorySlug: string | null;
  categoryPath: string | null;
  image: string | null;
  images: string[];
  mrp: number | null;
  sellingPrice: number | null;
  salePrice: number | null;
  totalInventory: number;
  catalogueFeatured: boolean;
  cataloguePinHero: boolean;
  catalogueExclude: boolean;
  catalogueAudienceTag: string | null;
};

export type MerchLaunchSummary = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  status: MerchLaunchStatus;
  startsAt: string;
  endsAt: string | null;
  productCount: number;
  updatedAt: string;
};

export type MerchLaunch = MerchLaunchSummary & {
  description: string | null;
  coverImage: string | null;
  founderNote: string | null;
  seoTitle: string | null;
  seoDesc: string | null;
  productIds: string[];
  selectedProducts: MerchandisingProduct[];
  createdAt: string;
};