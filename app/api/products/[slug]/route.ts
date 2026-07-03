import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  buildProductReadModel,
  type ProductReadSourceRow,
} from '@/lib/catalog/product-read';
import { mapPublicProductDetail } from '@/lib/catalog/public-product-detail';
import {
  CATALOGUE_STOCK_VISIBILITY,
  PRODUCT_READ_MODEL_VERSION,
} from '@/lib/catalog/contracts';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ROUTE_READ_MODEL_VERSION = 'phase1.public.product.v2';

export async function GET(
  _request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const row = await prisma.product.findFirst({
      where: {
        OR: [{ slug: params.slug }, { id: params.slug }, { sku: params.slug }],
        status: 'ACTIVE',
        catalogueExclude: false,
      },
      select: {
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
          orderBy: { sku: 'asc' },
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
      },
    });

    if (!row) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const now = new Date();
    const read = buildProductReadModel(
      row as unknown as ProductReadSourceRow,
      'public_api',
      now
    );

    const response = NextResponse.json({
      readModel: {
        version: ROUTE_READ_MODEL_VERSION,
        canonicalVersion: PRODUCT_READ_MODEL_VERSION,
        generatedAt: now.toISOString(),
        stockVisibility: CATALOGUE_STOCK_VISIBILITY,
      },
      product: mapPublicProductDetail(row as any, read),
    });

    response.headers.set('x-read-model-version', ROUTE_READ_MODEL_VERSION);
    response.headers.set('x-canonical-read-model-version', PRODUCT_READ_MODEL_VERSION);
    response.headers.set(
      'x-supported-stock-visibility',
      CATALOGUE_STOCK_VISIBILITY.join(',')
    );

    return response;
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to load product' },
      { status: 500 }
    );
  }
}
