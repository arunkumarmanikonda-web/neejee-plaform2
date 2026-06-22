// Waitlist signup endpoint — public, captures interest for sold-out / preorder pieces.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const productId = (body.productId || '').toString().trim();
    const email = (body.email || '').toString().trim().toLowerCase();
    const whatsapp = (body.whatsapp || '').toString().trim() || null;
    const name = (body.name || '').toString().trim() || null;
    const source = (body.source || 'pdp').toString().trim();

    if (!productId) return NextResponse.json({ error: 'Product is required' }, { status: 400 });
    if (!email || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email' }, { status: 400 });
    }

    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true },
    });
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    // Idempotent insert — unique on (productId, email)
    let alreadyOnList = false;
    try {
      await prisma.waitlist.create({
        data: { productId, email, whatsapp, name, source },
      });
    } catch (e: any) {
      if (e.code === 'P2002') {
        alreadyOnList = true;
      } else {
        throw e;
      }
    }

    // Get the current count for this product (used by admin alerts)
    const count = await prisma.waitlist.count({ where: { productId } });

    return NextResponse.json({
      ok: true,
      alreadyOnList,
      count,
      message: alreadyOnList
        ? `You are already on the waitlist for ${product.name}.`
        : `You are on the waitlist for ${product.name}. We will write when it is ready.`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unable to join waitlist' }, { status: 500 });
  }
}

// Anyone can see how many are on the waitlist for a product (social proof)
export async function GET(request: Request) {
  const url = new URL(request.url);
  const productId = url.searchParams.get('productId');
  if (!productId) return NextResponse.json({ error: 'productId required' }, { status: 400 });
  const count = await prisma.waitlist.count({ where: { productId } });
  return NextResponse.json({ count });
}

