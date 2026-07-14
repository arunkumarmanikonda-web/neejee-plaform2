import { prisma } from '@/lib/prisma';
import { slugify } from '@/lib/utils';
import {
  CatalogueBuilderProduct,
  CatalogueProject,
  CatalogueProjectCopy,
  CatalogueProjectSections,
  CatalogueProjectSelection,
  CatalogueProjectSummary,
  DEFAULT_CATALOGUE_PROJECT_CONFIG,
  DEFAULT_CATALOGUE_PROJECT_COPY,
} from '@/lib/catalogue-builder/contracts';

function asObject(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

function asString(value: unknown, fallback = ''): string {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function asNullableString(value: unknown): string | null {
  const text = asString(value).trim();
  return text ? text : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asString(item).trim()).filter(Boolean);
}

function asBoolean(value: unknown, fallback = false): boolean {
  if (value === true || value === false) return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

function asNumber(value: unknown, fallback: number | null = null): number | null {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeCopy(value: unknown, title: string, slug: string): CatalogueProjectCopy {
  const base = DEFAULT_CATALOGUE_PROJECT_COPY(title, slug);
  const raw = asObject(value);
  return {
    ...base,
    title: asString(raw.title, base.title),
    slug: slugify(asString(raw.slug, base.slug)) || base.slug,
    seoTitle: asNullableString(raw.seoTitle) ?? base.seoTitle ?? null,
    seoDesc: asNullableString(raw.seoDesc) ?? base.seoDesc ?? null,
    founderName: asString(raw.founderName, base.founderName),
    preNote: asString(raw.preNote, base.preNote),
    endingNote: asString(raw.endingNote, base.endingNote),
    heroHeading: asString(raw.heroHeading, base.heroHeading),
    heroSubheading: asString(raw.heroSubheading, base.heroSubheading),
    sectionIntro: asString(raw.sectionIntro, base.sectionIntro),
    productNarratives: asObject(raw.productNarratives),
    productPullQuotes: asObject(raw.productPullQuotes),
  };
}

function normalizeSections(page: any): CatalogueProjectSections {
  const raw = asObject(page.sections);
  const baseConfig = DEFAULT_CATALOGUE_PROJECT_CONFIG();
  const title = asString(page.title, 'Neejee Premium Catalogue');
  const slug = slugify(asString(page.slug, 'neejee-premium-catalogue')) || 'neejee-premium-catalogue';
  const configRaw = asObject(raw.config);
  const selectionRaw = asObject(raw.selection);

  return {
    version: 'catalogue-builder.v1',
    config: {
      ...baseConfig,
      brandName: asString(configRaw.brandName, baseConfig.brandName),
      templateKey: 'luxury_signature',
      includeFounderNotes: asBoolean(configRaw.includeFounderNotes, true),
      includeClosingPage: asBoolean(configRaw.includeClosingPage, true),
      coverImage: asNullableString(configRaw.coverImage),
    },
    selection: {
      productIds: asStringArray(selectionRaw.productIds),
      categorySlug: asNullableString(selectionRaw.categorySlug),
      categoryPath: asNullableString(selectionRaw.categoryPath),
      limit: asNumber(selectionRaw.limit, null),
    },
    copy: normalizeCopy(raw.copy, title, slug),
  };
}

function summarizePage(page: any): CatalogueProjectSummary {
  const sections = normalizeSections(page);
  return {
    id: page.id,
    slug: page.slug,
    title: page.title,
    status: page.status,
    createdAt: new Date(page.createdAt).toISOString(),
    updatedAt: new Date(page.updatedAt).toISOString(),
    productCount: sections.selection.productIds.length,
    founderName: sections.copy.founderName,
  };
}

function choosePrimaryImage(product: any): string | null {
  const images = Array.isArray(product.images) ? product.images.map((item: any) => asString(item)).filter(Boolean) : [];
  return asNullableString(product.cataloguePreferredImage) || asNullableString(product.image) || images[0] || null;
}

export async function listCatalogueProjects(): Promise<CatalogueProjectSummary[]> {
  const pages = await prisma.cmsPage.findMany({
    where: {
      pageType: 'catalogue',
    },
    orderBy: { updatedAt: 'desc' },
  });

  return pages.filter((page) => page.template === 'catalogue_builder').map(summarizePage);
}

export async function createCatalogueProject(input: {
  title: string;
  slug?: string;
  productIds?: string[];
}) {
  const title = input.title.trim() || 'Neejee Premium Catalogue';
  let finalSlug = slugify(input.slug || title) || 'neejee-premium-catalogue';

  for (let i = 0; i < 50; i += 1) {
    const candidate = i === 0 ? finalSlug : `${finalSlug}-${i + 1}`;
    const exists = await prisma.cmsPage.findUnique({ where: { slug: candidate } });
    if (!exists) {
      finalSlug = candidate;
      break;
    }
  }

  const sections: CatalogueProjectSections = {
    version: 'catalogue-builder.v1',
    config: DEFAULT_CATALOGUE_PROJECT_CONFIG(),
    selection: {
      productIds: (input.productIds || []).map((item) => asString(item)).filter(Boolean),
      categorySlug: null,
      categoryPath: null,
      limit: null,
    },
    copy: DEFAULT_CATALOGUE_PROJECT_COPY(title, finalSlug),
  };

  const page = await prisma.cmsPage.create({
    data: {
      title,
      slug: finalSlug,
      template: 'catalogue_builder',
      pageType: 'catalogue',
      sections: sections as any,
      seoTitle: sections.copy.seoTitle,
      seoDesc: sections.copy.seoDesc,
      status: 'DRAFT',
      excerpt: sections.copy.heroSubheading,
      author: sections.copy.founderName,
      featured: false,
    },
  });

  return summarizePage(page);
}

export async function getCatalogueProjectPage(idOrSlug: string) {
  return prisma.cmsPage.findFirst({
    where: {
      OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      pageType: 'catalogue',
      template: 'catalogue_builder',
    },
  });
}

export async function updateCatalogueProject(idOrSlug: string, body: any) {
  const existing = await getCatalogueProjectPage(idOrSlug);
  if (!existing) return null;

  const current = normalizeSections(existing);
  const nextTitle = asString(body.title, existing.title).trim() || existing.title;
  const nextSlug = slugify(asString(body.slug, existing.slug)) || existing.slug;

  const sections: CatalogueProjectSections = {
    version: 'catalogue-builder.v1',
    config: {
      ...current.config,
      ...(asObject(body.config) as any),
      templateKey: 'luxury_signature',
    },
    selection: {
      ...current.selection,
      ...asObject(body.selection),
      productIds: body.selection?.productIds ? asStringArray(body.selection.productIds) : current.selection.productIds,
      categorySlug: body.selection?.categorySlug !== undefined ? asNullableString(body.selection.categorySlug) : current.selection.categorySlug,
      categoryPath: body.selection?.categoryPath !== undefined ? asNullableString(body.selection.categoryPath) : current.selection.categoryPath,
      limit: body.selection?.limit !== undefined ? asNumber(body.selection.limit, null) : current.selection.limit,
    },
    copy: {
      ...current.copy,
      ...asObject(body.copy),
      title: nextTitle,
      slug: nextSlug,
      productNarratives: body.copy?.productNarratives ? asObject(body.copy.productNarratives) : current.copy.productNarratives,
      productPullQuotes: body.copy?.productPullQuotes ? asObject(body.copy.productPullQuotes) : current.copy.productPullQuotes,
    },
  };

  const page = await prisma.cmsPage.update({
    where: { id: existing.id },
    data: {
      title: nextTitle,
      slug: nextSlug,
      sections: sections as any,
      seoTitle: sections.copy.seoTitle || null,
      seoDesc: sections.copy.seoDesc || null,
      excerpt: sections.copy.heroSubheading || null,
      coverImage: sections.config.coverImage || null,
      author: sections.copy.founderName || null,
      status: body.status || existing.status,
    },
  });

  return summarizePage(page);
}

export async function deleteCatalogueProject(idOrSlug: string) {
  const existing = await getCatalogueProjectPage(idOrSlug);
  if (!existing) return false;
  await prisma.cmsPage.delete({ where: { id: existing.id } });
  return true;
}

export async function loadCatalogueProducts(productIds: string[]): Promise<CatalogueBuilderProduct[]> {
  if (!productIds.length) return [];

  const rows = await prisma.product.findMany({
    where: {
      status: 'ACTIVE',
      catalogueExclude: false,
      OR: [
        { id: { in: productIds } },
        { slug: { in: productIds } },
        { sku: { in: productIds } },
      ],
    },
    orderBy: [
      { cataloguePinHero: 'desc' },
      { catalogueFeatured: 'desc' },
      { updatedAt: 'desc' },
    ],
    select: {
      id: true,
      slug: true,
      sku: true,
      name: true,
      shortName: true,
      description: true,
      poeticLine: true,
      story: true,
      craft: true,
      region: true,
      material: true,
      technique: true,
      occasion: true,
      mrp: true,
      sellingPrice: true,
      salePrice: true,
      cataloguePreferredImage: true,
      images: true,
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

  const orderMap = new Map(productIds.map((id, index) => [id, index]));

  return rows
    .map((row: any) => ({
      id: row.id,
      slug: row.slug || null,
      sku: row.sku || null,
      name: row.name,
      shortName: row.shortName || null,
      description: row.description || null,
      poeticLine: row.poeticLine || null,
      story: row.story || null,
      craft: row.craft || null,
      region: row.region || null,
      material: row.material || null,
      technique: row.technique || null,
      occasion: row.occasion || null,
      categoryName: row.category?.name || null,
      categorySlug: row.category?.slug || null,
      categoryPath: row.category?.path || null,
      mrp: row.mrp ?? null,
      sellingPrice: row.sellingPrice ?? null,
      salePrice: row.salePrice ?? null,
      totalInventory: (row.variants || []).reduce((sum: number, variant: any) => sum + (variant.inventory || 0), 0),
      image: choosePrimaryImage(row),
      images: Array.isArray(row.images) ? row.images.map((item: any) => asString(item)).filter(Boolean) : [],
      catalogueFeatured: !!row.catalogueFeatured,
      cataloguePinHero: !!row.cataloguePinHero,
      catalogueExclude: !!row.catalogueExclude,
      catalogueAudienceTag: row.catalogueAudienceTag || null,
    }))
    .sort((a, b) => {
      const aPos = orderMap.get(a.id) ?? orderMap.get(a.slug || '') ?? orderMap.get(a.sku || '') ?? 9999;
      const bPos = orderMap.get(b.id) ?? orderMap.get(b.slug || '') ?? orderMap.get(b.sku || '') ?? 9999;
      return aPos - bPos;
    });
}

export async function getCatalogueProject(idOrSlug: string): Promise<CatalogueProject | null> {
  const page = await getCatalogueProjectPage(idOrSlug);
  if (!page) return null;
  const sections = normalizeSections(page);
  const products = await loadCatalogueProducts(sections.selection.productIds);

  return {
    ...summarizePage(page),
    pageType: page.pageType,
    template: page.template,
    sections,
    products,
  };
}


