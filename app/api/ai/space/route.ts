// AI Space — place a NEEJEE artefact (textile, lamp, planter) in a customer's room photo
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { aiMirrorConfigured, placeInRoom } from '@/lib/ai';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Please sign in to use AI Space' }, { status: 401 });
  }

  try {
    const { productId, roomImageUrl, consent } = await request.json();
    if (!consent) return NextResponse.json({ error: 'Consent required for AI generation' }, { status: 400 });
    if (!roomImageUrl) return NextResponse.json({ error: 'Room photo required' }, { status: 400 });
    if (!productId) return NextResponse.json({ error: 'Product required' }, { status: 400 });

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, images: true, aiRoomEligible: true, craft: true, material: true },
    });
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    if (!product.aiRoomEligible) return NextResponse.json({ error: 'This piece is not eligible for AI Space' }, { status: 400 });

    const productImage = product.images?.[0];
    if (!productImage) return NextResponse.json({ error: 'Product image unavailable' }, { status: 400 });

    const description = `${product.craft || ''} ${product.material || ''} ${product.name}`.trim();

    if (!aiMirrorConfigured()) {
      const stub = await prisma.aiPreview.create({
        data: {
          userId: session.id,
          type: 'SPACE',
          sourceImage: roomImageUrl,
          outputImage: roomImageUrl,
          productIds: [product.id],
          consentLogged: true,
          deleteAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
      return NextResponse.json({
        ok: true,
        configured: false,
        previewId: stub.id,
        outputUrl: roomImageUrl,
        message: 'AI Space is being prepared. Showing your room for now.',
      });
    }

    const result = await placeInRoom(roomImageUrl, productImage, description);
    if (!result.ok || !result.outputUrl) {
      console.warn('[ai/space] generation failed:', result.error);
      return NextResponse.json({
        error: result.error || 'Generation failed',
        hint: 'Check that FAL_KEY is set in Vercel env and that the room photo is well-lit.',
      }, { status: 500 });
    }

    const outputUrl = result.outputUrl;
    const saved = await prisma.aiPreview.create({
      data: {
        userId: session.id,
        type: 'SPACE',
        sourceImage: roomImageUrl,
        outputImage: outputUrl,
        productIds: [product.id],
        consentLogged: true,
        deleteAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    return NextResponse.json({ ok: true, configured: true, previewId: saved.id, outputUrl });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
