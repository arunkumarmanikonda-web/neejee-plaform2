import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';
import {
  buildPremiumCatalogueEngine,
  buildPremiumCatalogueFileBaseName,
  renderPremiumCatalogueHtmlDocument,
  renderPremiumCataloguePdfBuffer,
  renderPremiumCatalogueTemplate,
  type PremiumCatalogueEngineBrief,
  type PremiumCatalogueExportFormat,
} from '@/lib/catalog-engine';
import {
  buildProductReadModel,
  type ProductReadSourceRow,
} from '@/lib/catalog/product-read';
import type { ProductReadModel as EngineProductReadModel } from '@/lib/catalog/contracts';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 180;

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => asString(item)).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function asPositiveInt(value: unknown, fallback = 24): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'premium-catalogue'
  );
}

function pickFormat(value: unknown): PremiumCatalogueExportFormat {
  const format = asString(value).toLowerCase();
  if (format === 'html' || format === 'pdf') return format;
  return 'json';
}

function isDevReadBypassAllowed(req: NextRequest): boolean {
  if (process.env.NODE_ENV === 'production') return false;

  const url = new URL(req.url);
  const queryBypass = url.searchParams.get('devBypass') === '1';
  const headerBypass = req.headers.get('x-dev-bypass') === '1';

  return queryBypass || headerBypass;
}

function buildProductSelect() {
  return {
    id: true,
    slug: true,
    sku: true,
    sellerId: true,
    status: true,
    name: true,
    shortName: true,
    poeticLine: true,
    description: true,
    craft: true,
    region: true,
    state: true,
    cluster: true,
    artisanName: true,
    material: true,
    technique: true,
    occasion: true,
    story: true,
    craftNote: true,
    careInstructions: true,
    sustainabilityNote: true,
    mrp: true,
    sellingPrice: true,
    salePrice: true,
    saleStartsAt: true,
    saleEndsAt: true,
    gstRate: true,
    hsnCode: true,
    images: true,
    video: true,
    badges: true,
    catalogueFeatured: true,
    catalogueBestseller: true,
    catalogueEditorial: true,
    cataloguePinHero: true,
    catalogueExclude: true,
    cataloguePreferredImage: true,
    catalogueAudienceTag: true,
    catalogueCtaMode: true,
    catalogueStoryBlock: true,
    catalogueImageApproved: true,
    catalogueImageQualityScore: true,
    catalogueStockVisibility: true,
    codEligible: true,
    returnEligible: true,
    returnPolicy: true,
    fulfilmentMode: true,
    depositPercent: true,
    releaseDate: true,
    editionSize: true,
    editionSold: true,
    aiTryOnEligible: true,
    aiRoomEligible: true,
    arTryOnEligible: true,
    createdAt: true,
    updatedAt: true,
    seoTitle: true,
    seoDesc: true,
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
    variants: {
      orderBy: { sku: 'asc' as const },
      select: {
        id: true,
        sku: true,
        size: true,
        color: true,
        colorHex: true,
        material: true,
        inventory: true,
        mrp: true,
        sellingPrice: true,
        lowStockThreshold: true,
        images: true,
      },
    },
    seller: {
      select: {
        businessName: true,
        contactName: true,
        region: true,
        craft: true,
      },
    },
  };
}

function matchesCategory(
  read: EngineProductReadModel,
  categorySlug: string,
  categoryPath: string
): boolean {
  if (categorySlug) {
    const lineage = Array.isArray((read as any)?.hierarchy?.lineage)
      ? (read as any).hierarchy.lineage
      : [];
    const matchedLineage = lineage.some((node: any) => node?.slug === categorySlug);
    return matchedLineage || (read as any)?.category?.slug === categorySlug;
  }

  if (categoryPath) {
    return (
      String((read as any)?.hierarchy?.path || (read as any)?.category?.path || '').toLowerCase() ===
      categoryPath.toLowerCase()
    );
  }

  return true;
}

function normalizeBrief(value: any, fallbackTitle: string): PremiumCatalogueEngineBrief {
  return {
    id: asString(value?.id) || null,
    slug: asString(value?.slug) || slugify(asString(value?.title) || fallbackTitle),
    title: asString(value?.title) || fallbackTitle,
    tone: asString(value?.tone) as any,
    featuredLimit: asPositiveInt(value?.featuredLimit, 4),
    includeProductIds: asStringArray(value?.includeProductIds),
    excludeProductIds: asStringArray(value?.excludeProductIds),
    audienceTags: asStringArray(value?.audienceTags),
    generatedAt: asString(value?.generatedAt) || null,
  };
}

async function handleExport(input: any) {
  const productIds = asStringArray(input.productIds);
  const categorySlug = asString(input.categorySlug);
  const categoryPath = asString(input.categoryPath);
  const format = pickFormat(input.format);
  const now = new Date();

  const rows = await prisma.product.findMany({
    where: {
      status: 'ACTIVE',
      catalogueExclude: false,
      ...(productIds.length > 0
        ? {
            OR: [
              { id: { in: productIds } },
              { slug: { in: productIds } },
              { sku: { in: productIds } },
            ],
          }
        : {}),
    },
    select: buildProductSelect(),
    take: asPositiveInt(input.limit, 100),
    orderBy: [
      { cataloguePinHero: 'desc' },
      { catalogueFeatured: 'desc' },
      { updatedAt: 'desc' },
    ],
  });

  const reads = rows
    .map((row) =>
      buildProductReadModel(
        row as unknown as ProductReadSourceRow,
        'catalogue_export',
        now
      ) as unknown as EngineProductReadModel
    )
    .filter((read) => matchesCategory(read, categorySlug, categoryPath));

  if (reads.length === 0) {
    return NextResponse.json(
      { error: 'No eligible products matched the export request' },
      { status: 404 }
    );
  }

  const fallbackTitle = categorySlug || categoryPath || 'Neejee Premium Catalogue';
  const brief = normalizeBrief(input.brief || input, fallbackTitle);
  const engineOutput = buildPremiumCatalogueEngine({ brief, products: reads });
  const template = renderPremiumCatalogueTemplate(
    engineOutput,
    (asString(input.templateKey) as any) || undefined
  );
  const baseName = buildPremiumCatalogueFileBaseName({ engineOutput, template });
  const html = renderPremiumCatalogueHtmlDocument({ engineOutput, template });
  const pdf = renderPremiumCataloguePdfBuffer({ engineOutput, template });

  const manifest = {
    version: 'phase2.catalogue-export.v1',
    generatedAt: engineOutput.generatedAt,
    title: template.title,
    slug: template.slug,
    templateKey: template.templateKey,
    selectionKey: template.selectionKey,
    productCount: engineOutput.products.length,
    sectionCount: template.blocks.length,
    htmlFileName: `${baseName}.html`,
    pdfFileName: `${baseName}.pdf`,
  };

  if (format === 'html') {
    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="${manifest.htmlFileName}"`,
      },
    });
  }

  if (format === 'pdf') {
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${manifest.pdfFileName}"`,
      },
    });
  }

  return NextResponse.json({
    ok: true,
    manifest,
    engine: engineOutput,
    template,
    html,
  });
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({} as any));
    return await handleExport(body);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Catalogue export failed' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const user = await getSession();
  const allowDevBypass = isDevReadBypassAllowed(req);

  if (!allowDevBypass && !requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const payload = {
      format: searchParams.get('format') || 'json',
      templateKey: searchParams.get('templateKey') || undefined,
      categorySlug: searchParams.get('categorySlug') || undefined,
      categoryPath: searchParams.get('categoryPath') || undefined,
      productIds: searchParams.getAll('productId'),
      limit: searchParams.get('limit') || undefined,
      brief: {
        title: searchParams.get('title') || undefined,
        slug: searchParams.get('slug') || undefined,
        tone: searchParams.get('tone') || undefined,
        featuredLimit: searchParams.get('featuredLimit') || undefined,
        audienceTags: searchParams.getAll('audienceTag'),
        includeProductIds: searchParams.getAll('includeProductId'),
        excludeProductIds: searchParams.getAll('excludeProductId'),
      },
    };

    return await handleExport(payload);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Catalogue export failed' },
      { status: 500 }
    );
  }
}
