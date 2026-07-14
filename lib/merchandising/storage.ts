import type { DropStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { MerchLaunch, MerchLaunchStatus, MerchLaunchSummary, MerchandisingProduct } from '@/lib/merchandising/contracts';

const ALLOWED_STATUSES: MerchLaunchStatus[] = ['DRAFT', 'SCHEDULED', 'LIVE', 'CLOSED'];

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

function asNullableString(value: unknown): string | null {
  const next = asString(value);
  return next || null;
}

function asDate(value: unknown, fallback: Date): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || '').trim()).filter(Boolean);
}

function asStatus(value: unknown, fallback: MerchLaunchStatus = 'DRAFT'): MerchLaunchStatus {
  const next = String(value || '').toUpperCase() as MerchLaunchStatus;
  return ALLOWED_STATUSES.includes(next) ? next : fallback;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

async function ensureUniqueSlug(input: string): Promise<string> {
  const base = slugify(input) || `launch-${Date.now()}`;
  let candidate = base;
  let i = 1;

  while (await prisma.drop.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    candidate = `${base}-${i}`;
    i += 1;
  }

  return candidate;
}

function pickImage(product: any): string | null {
  return product.cataloguePreferredImage || product.images?.[0] || null;
}

async function loadSelectedProducts(productIds: string[]): Promise<MerchandisingProduct[]> {
  if (!productIds.length) return [];

  const rows = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      slug: true,
      sku: true,
      name: true,
      mrp: true,
      sellingPrice: true,
      salePrice: true,
      images: true,
      cataloguePreferredImage: true,
      catalogueFeatured: true,
      cataloguePinHero: true,
      catalogueExclude: true,
      catalogueAudienceTag: true,
      category: {
        select: {
          name: true,
          slug: true,
          path: true,
        },
      },
      variants: {
        select: {
          inventory: true,
        },
      },
    },
  });

  const mapped = rows.map((product) => ({
    id: product.id,
    slug: product.slug,
    sku: product.sku,
    name: product.name,
    categoryName: product.category?.name || null,
    categorySlug: product.category?.slug || null,
    categoryPath: product.category?.path || null,
    image: pickImage(product),
    images: product.images || [],
    mrp: product.mrp,
    sellingPrice: product.sellingPrice,
    salePrice: product.salePrice,
    totalInventory: (product.variants || []).reduce((sum, row) => sum + (row.inventory || 0), 0),
    catalogueFeatured: !!product.catalogueFeatured,
    cataloguePinHero: !!product.cataloguePinHero,
    catalogueExclude: !!product.catalogueExclude,
    catalogueAudienceTag: product.catalogueAudienceTag || null,
  }));

  const byId = new Map(mapped.map((item) => [item.id, item]));
  return productIds.map((id) => byId.get(id)).filter(Boolean) as MerchandisingProduct[];
}

function toSummary(drop: any): MerchLaunchSummary {
  return {
    id: drop.id,
    slug: drop.slug,
    title: drop.title,
    subtitle: drop.subtitle || null,
    status: drop.status,
    startsAt: drop.startsAt.toISOString(),
    endsAt: drop.endsAt ? drop.endsAt.toISOString() : null,
    productCount: Array.isArray(drop.productIds) ? drop.productIds.length : 0,
    updatedAt: drop.updatedAt.toISOString(),
  };
}

async function findDrop(idOrSlug: string) {
  return prisma.drop.findFirst({
    where: {
      OR: [{ id: idOrSlug }, { slug: idOrSlug }],
    },
  });
}

export async function listMerchLaunches(): Promise<MerchLaunchSummary[]> {
  const rows = await prisma.drop.findMany({
    orderBy: [{ updatedAt: 'desc' }],
    select: {
      id: true,
      slug: true,
      title: true,
      subtitle: true,
      status: true,
      startsAt: true,
      endsAt: true,
      productIds: true,
      updatedAt: true,
    },
  });

  return rows.map(toSummary);
}

export async function getMerchLaunch(idOrSlug: string): Promise<MerchLaunch | null> {
  const drop = await findDrop(idOrSlug);
  if (!drop) return null;

  const selectedProducts = await loadSelectedProducts(drop.productIds || []);

  return {
    id: drop.id,
    slug: drop.slug,
    title: drop.title,
    subtitle: drop.subtitle || null,
    status: drop.status,
    startsAt: drop.startsAt.toISOString(),
    endsAt: drop.endsAt ? drop.endsAt.toISOString() : null,
    productCount: Array.isArray(drop.productIds) ? drop.productIds.length : 0,
    updatedAt: drop.updatedAt.toISOString(),
    createdAt: drop.createdAt.toISOString(),
    description: drop.description || null,
    coverImage: drop.coverImage || null,
    founderNote: drop.founderNote || null,
    seoTitle: drop.seoTitle || null,
    seoDesc: drop.seoDesc || null,
    productIds: drop.productIds || [],
    selectedProducts,
  };
}

export async function createMerchLaunch(input: {
  title: string;
  slug?: string;
  startsAt?: string | Date;
  status?: MerchLaunchStatus;
  productIds?: string[];
}) {
  const title = asString(input.title);
  if (!title) throw new Error('Title required');

  const slug = await ensureUniqueSlug(asString(input.slug, title));
  const startsAt = asDate(input.startsAt, new Date());
  const status = asStatus(input.status, 'DRAFT');
  const productIds = asStringArray(input.productIds);

  const created = await prisma.drop.create({
    data: {
      slug,
      title,
      startsAt,
      status: status as DropStatus,
      productIds,
    },
  });

  return getMerchLaunch(created.id);
}

export async function updateMerchLaunch(
  idOrSlug: string,
  body: {
    title?: string;
    slug?: string;
    subtitle?: string | null;
    description?: string | null;
    coverImage?: string | null;
    founderNote?: string | null;
    seoTitle?: string | null;
    seoDesc?: string | null;
    startsAt?: string | Date;
    endsAt?: string | Date | null;
    status?: MerchLaunchStatus;
    productIds?: string[];
  }
) {
  const existing = await findDrop(idOrSlug);
  if (!existing) throw new Error('Launch not found');

  const nextTitle = asString(body.title, existing.title);
  const requestedSlug = asString(body.slug, existing.slug);
  let nextSlug = existing.slug;

  if (requestedSlug && requestedSlug !== existing.slug) {
    nextSlug = await ensureUniqueSlug(requestedSlug);
  }

  const nextStartsAt = body.startsAt !== undefined ? asDate(body.startsAt, existing.startsAt) : existing.startsAt;
  const nextEndsAt =
    body.endsAt === undefined
      ? existing.endsAt
      : body.endsAt === null || body.endsAt === ''
        ? null
        : asDate(body.endsAt, existing.endsAt || nextStartsAt);

  const nextStatus = body.status ? asStatus(body.status, existing.status as MerchLaunchStatus) : (existing.status as MerchLaunchStatus);

  await prisma.drop.update({
    where: { id: existing.id },
    data: {
      title: nextTitle,
      slug: nextSlug,
      subtitle: body.subtitle !== undefined ? asNullableString(body.subtitle) : existing.subtitle,
      description: body.description !== undefined ? asNullableString(body.description) : existing.description,
      coverImage: body.coverImage !== undefined ? asNullableString(body.coverImage) : existing.coverImage,
      founderNote: body.founderNote !== undefined ? asNullableString(body.founderNote) : existing.founderNote,
      seoTitle: body.seoTitle !== undefined ? asNullableString(body.seoTitle) : existing.seoTitle,
      seoDesc: body.seoDesc !== undefined ? asNullableString(body.seoDesc) : existing.seoDesc,
      startsAt: nextStartsAt,
      endsAt: nextEndsAt,
      status: nextStatus as DropStatus,
      productIds: body.productIds !== undefined ? asStringArray(body.productIds) : existing.productIds,
    },
  });

  return getMerchLaunch(existing.id);
}

export async function deleteMerchLaunch(idOrSlug: string) {
  const existing = await findDrop(idOrSlug);
  if (!existing) return { ok: true };

  await prisma.drop.delete({
    where: { id: existing.id },
  });

  return { ok: true };
}