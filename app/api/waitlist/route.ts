// Waitlist signup endpoint — public, captures interest for sold-out / preorder pieces.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const EMAIL_RE = /^\S+@\S+\.\S+$/;

function cleanText(value: unknown, max: number): string | null {
  const text = String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
  return text || null;
}

function cleanSource(value: unknown): string {
  const source = String(value || 'pdp')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .slice(0, 64);
  return source || 'pdp';
}

function cleanWhatsapp(value: unknown): string | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const productId = String(body?.productId || '').trim();
    const email = String(body?.email || '').trim().toLowerCase();
    const name = cleanText(body?.name, 100);
    const source = cleanSource(body?.source);
    const whatsappInput = String(body?.whatsapp || '').trim();
    const whatsapp = cleanWhatsapp(whatsappInput);

    if (!productId || productId.length > 100) {
      return NextResponse.json({ error: 'Product is required' }, { status: 400 });
    }
    if (!email || email.length > 320 || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email' }, { status: 400 });
    }
    if (whatsappInput && !whatsapp) {
      return NextResponse.json({ error: 'Please enter a valid WhatsApp number' }, { status: 400 });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, status: true },
    });
    if (!product || product.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'This piece is not currently available for a waitlist.' }, { status: 404 });
    }

    let alreadyOnList = false;
    try {
      await prisma.waitlist.create({
        data: { productId, email, whatsapp, name, source },
      });
    } catch (error: any) {
      if (error?.code === 'P2002') alreadyOnList = true;
      else throw error;
    }

    const count = await prisma.waitlist.count({ where: { productId } });
    return NextResponse.json({
      ok: true,
      alreadyOnList,
      count,
      message: alreadyOnList
        ? `You are already on the waitlist for ${product.name}.`
        : `You are on the waitlist for ${product.name}. We will write when it is ready.`,
    });
  } catch (error: any) {
    console.error('[waitlist.post] failed', { message: error?.message });
    return NextResponse.json({ error: 'Unable to join the waitlist right now.' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const productId = String(new URL(request.url).searchParams.get('productId') || '').trim();
    if (!productId || productId.length > 100) {
      return NextResponse.json({ error: 'productId required' }, { status: 400 });
    }
    const count = await prisma.waitlist.count({ where: { productId } });
    const response = NextResponse.json({ count });
    response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    return response;
  } catch (error: any) {
    console.error('[waitlist.get] failed', { message: error?.message });
    return NextResponse.json({ error: 'Waitlist count unavailable' }, { status: 500 });
  }
}
