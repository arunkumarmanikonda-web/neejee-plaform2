import { authorNewProduct, saveCreationFacts } from '@/lib/catalog/narrative-service';
// Seller's own products list + create
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireApprovedSeller } from '@/lib/seller-context';
import { slugify } from '@/lib/utils';
import { getSellerAgreementUploadGate } from '@/lib/agreement-upload-guard';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const ctx = await requireApprovedSeller('inventory');
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  if (!ctx.seller) return NextResponse.json({ products: [] });

  const products = await prisma.product.findMany({
    where: { sellerId: ctx.seller.id },
    orderBy: { createdAt: 'desc' },
    include: {
      category: { select: { slug: true, name: true } },
      variants: { select: { inventory: true } },
    },
  });
  return NextResponse.json({
    products: products.map((p: any) => ({
      id: p.id,
      slug: p.slug,
      sku: p.sku,
      name: p.name,
      craft: p.craft,
      region: p.region,
      mrp: p.mrp,
      sellingPrice: p.sellingPrice,
      salePrice: p.salePrice,
      images: p.images,
      status: p.status,
      categoryName: p.category?.name,
      inventory: p.variants.reduce((s: number, v: any) => s + (v.inventory || 0), 0),
      createdAt: p.createdAt,
    })),
  });
}

export async function POST(request: Request) {
  const ctx = await requireApprovedSeller('inventory');
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  if (!ctx.seller) return NextResponse.json({ error: 'No seller record' }, { status: 404 });

  const seller=ctx.seller;
  const agreementGate = await getSellerAgreementUploadGate(seller.id);
  if (agreementGate.blocked) {
    return NextResponse.json(
      { error: agreementGate.message, code: agreementGate.code, agreementGate },
      { status: 423 }
    );
  }

  try {
    const body = await request.json();
    const {
      name,
      categoryId,
      mrp,
      sellingPrice,
      sku,
      craft,
      region,
      material,
      technique,
      occasion,
      images = [],
    } = body;

    if (!name || !categoryId || !mrp || !sellingPrice) {
      return NextResponse.json(
        { error: 'name, categoryId, mrp, sellingPrice required' },
        { status: 400 }
      );
    }

    const {draft}=await authorNewProduct(body);
    const baseSlug = slugify(draft.name);
    let slug = baseSlug;
    for (let n = 2; n < 30; n++) {
      const clash = await prisma.product.findUnique({ where: { slug } });
      if (!clash) break;
      slug = `${baseSlug}-${n}`;
    }

    const finalSku =
      sku ||
      `NEE-${(seller.slug || 'STUDIO').toUpperCase().slice(0, 6)}-${Date.now()
        .toString()
        .slice(-6)}`;

    const product = await prisma.$transaction(async tx=>{
      const item=await tx.product.create({
        data: {
          slug,
          sku: finalSku,
          ...draft,
          sellerId: seller.id,
          categoryId,
          craft: craft || undefined,
          region: region || undefined,
          material,
          technique,
          occasion,
          mrp: parseInt(mrp),
          sellingPrice: parseInt(sellingPrice),
          images: Array.isArray(images) ? images : [],
          status: 'PENDING_QC',
          artisanName: typeof body.artisanName==='string' ? body.artisanName.trim() || undefined : undefined,
        },
      });
      await saveCreationFacts(tx,item.id,body.pieceFacts);
      return item;
    });

    return NextResponse.json({ success: true, product });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}