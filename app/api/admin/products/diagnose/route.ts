// v23.40.20.2 — Product diagnostic endpoint.
// Helps debug "Product not found" issues without needing Vercel logs.
// Usage: /api/admin/products/diagnose?id=cmqf6sn1p0001tbdh290orgp3
//   or:  /api/admin/products/diagnose?id=NEE-THE-0001
//   or:  /api/admin/products/diagnose?id=turkish-mosaic-ottoman-lamp
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const url = new URL(request.url);
  const key = (url.searchParams.get('id') || '').trim();

  if (!key) {
    // List 5 recent products as samples to compare ID format.
    const samples = await prisma.product.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { id: true, slug: true, sku: true, name: true, status: true },
    });
    const totalCount = await prisma.product.count();
    return NextResponse.json({
      ok: true,
      message: 'Pass ?id=<value> to diagnose. Sample products below.',
      totalCount,
      samples,
    });
  }

  // Try every possible matcher. v23.40.25.7 — include images & badges to diagnose missing-image cases.
  const fullSelect = { id: true, slug: true, sku: true, name: true, status: true, images: true, badges: true, updatedAt: true, createdAt: true } as const;
  const checks = await Promise.all([
    prisma.product.findUnique({ where: { id: key }, select: fullSelect }).catch(() => null),
    prisma.product.findUnique({ where: { slug: key.toLowerCase() }, select: fullSelect }).catch(() => null),
    prisma.product.findUnique({ where: { sku: key }, select: fullSelect }).catch(() => null),
    prisma.product.findUnique({ where: { sku: key.toUpperCase() }, select: fullSelect }).catch(() => null),
  ]);

  const [byId, bySlug, bySkuRaw, bySkuUpper] = checks;
  const found = byId || bySlug || bySkuRaw || bySkuUpper;

  // Find similar products if nothing matched (catches typos / deletions)
  let similar: any[] = [];
  if (!found) {
    similar = await prisma.product.findMany({
      where: {
        OR: [
          { id: { startsWith: key.slice(0, 8) } },
          { slug: { contains: key.slice(0, 8), mode: 'insensitive' } },
          { sku: { contains: key.slice(0, 8), mode: 'insensitive' } },
          { name: { contains: key.slice(0, 6), mode: 'insensitive' } },
        ],
      },
      take: 5,
      select: { id: true, slug: true, sku: true, name: true, status: true },
    });
  }

  // v23.40.25.7 — image diagnostic. If product found, classify each image URL.
  let imageDiagnosis: any = null;
  if (found) {
    const imgs: string[] = Array.isArray((found as any).images) ? (found as any).images : [];
    imageDiagnosis = {
      imageCount: imgs.length,
      isEmpty: imgs.length === 0,
      firstImage: imgs[0] || null,
      images: imgs.map((u, i) => ({
        index: i,
        url: u,
        isEmpty: !u || u.trim() === '',
        isHttpUrl: /^https?:\/\//i.test(u || ''),
        isSupabase: /supabase\.co/.test(u || ''),
        isUnsplash: /unsplash\.com/.test(u || ''),
        isCloudinary: /cloudinary\.com/.test(u || ''),
      })),
      hint: imgs.length === 0
        ? 'IMAGES_ARRAY_EMPTY — the product has no images stored. Edit the product in /admin/products/[id] and upload an image.'
        : !imgs[0]
        ? 'IMAGES_FIRST_IS_NULL — first slot is empty. Reorder or fill it via admin.'
        : 'IMAGES_PRESENT — array has URLs. If "No image" still shows on site, the URL itself is returning 404 (delete on Supabase or external host).',
    };
  }

  return NextResponse.json({
    ok: !!found,
    searched: key,
    keyLength: key.length,
    keyFormat: /^cm[a-z0-9]{20,}$/i.test(key) ? 'cuid' : /^[0-9a-f]{24}$/i.test(key) ? 'mongodb-objectid' : 'other',
    matches: {
      byId: byId,
      bySlugLower: bySlug,
      bySkuRaw: bySkuRaw,
      bySkuUpper: bySkuUpper,
    },
    found,
    imageDiagnosis,
    similar,
  });
}

// v23.40.25.7 — POST endpoint to restore/set images from a list of URLs without needing the full admin form.
// Usage: POST /api/admin/products/diagnose?id=turkish-mosaic-ottoman-lamp
// Body: { "images": ["https://...", "https://..."] }
export async function POST(request: Request) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const url = new URL(request.url);
  const key = (url.searchParams.get('id') || '').trim();
  if (!key) return NextResponse.json({ error: 'Missing ?id=' }, { status: 400 });

  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  const images = Array.isArray(body?.images) ? body.images.filter((u: any) => typeof u === 'string' && u.trim()) : null;
  if (!images || images.length === 0) return NextResponse.json({ error: 'Body must be { images: ["https://..."] }' }, { status: 400 });

  // Find the product by id/slug/sku
  const prod =
    (await prisma.product.findUnique({ where: { id: key }, select: { id: true } }).catch(() => null)) ||
    (await prisma.product.findUnique({ where: { slug: key.toLowerCase() }, select: { id: true } }).catch(() => null)) ||
    (await prisma.product.findUnique({ where: { sku: key }, select: { id: true } }).catch(() => null)) ||
    (await prisma.product.findUnique({ where: { sku: key.toUpperCase() }, select: { id: true } }).catch(() => null));
  if (!prod) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

  const updated = await prisma.product.update({
    where: { id: prod.id },
    data: { images },
    select: { id: true, slug: true, name: true, images: true },
  });
  return NextResponse.json({ ok: true, updated });
}
