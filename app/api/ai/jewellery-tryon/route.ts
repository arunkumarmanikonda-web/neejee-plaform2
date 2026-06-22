// AI Jewellery Try-On — composites a jewellery piece onto a user portrait.
// Single-call synchronous endpoint (flux-pro/kontext completes in ~30-50s).
// Re-hosts the output to Supabase storage so the URL is permanent.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { aiImageConfigured, jewelleryTryOn, detectJewelleryType, type JewelleryType } from '@/lib/ai';
import { uploadFile, storageConfigured, makeUploadPath } from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 180; // flux kontext + safety check + rehost upload can take up to ~150s

const VALID_TYPES: JewelleryType[] = ['earrings', 'necklace', 'bangle', 'ring', 'auto'];

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Please sign in to use AR Try-On' }, { status: 401 });
  }

  try {
    const { productId, personImageUrl, consent, jewelleryType } = await request.json();
    if (!consent) return NextResponse.json({ error: 'Consent required for AI generation' }, { status: 400 });
    if (!personImageUrl) return NextResponse.json({ error: 'Portrait image required' }, { status: 400 });
    if (!productId) return NextResponse.json({ error: 'Product required' }, { status: 400 });

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        images: true,
        arTryOnEligible: true,
        craft: true,
        category: { select: { name: true, slug: true } },
      },
    });
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    if (!product.arTryOnEligible) {
      return NextResponse.json({ error: 'This piece is not eligible for AR Try-On' }, { status: 400 });
    }

    const jewelleryImage = product.images?.[0];
    if (!jewelleryImage) return NextResponse.json({ error: 'Product image unavailable' }, { status: 400 });

    // Determine jewellery type — user override > auto-detect
    let type: JewelleryType = 'necklace';
    if (jewelleryType && VALID_TYPES.includes(jewelleryType as JewelleryType)) {
      type = jewelleryType as JewelleryType;
    } else {
      type = detectJewelleryType(product.category?.name || '', product.name, product.craft);
    }

    // If AI not configured, return a stub preview
    if (!aiImageConfigured()) {
      const stub = await prisma.aiPreview.create({
        data: {
          userId: session.id,
          type: 'MIRROR', // reusing the enum for now
          sourceImage: personImageUrl,
          outputImage: jewelleryImage,
          productIds: [product.id],
          consentLogged: true,
          deleteAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
      return NextResponse.json({
        ok: true,
        configured: false,
        previewId: stub.id,
        outputUrl: jewelleryImage,
        type,
        message: 'AR Try-On is being prepared. Showing the piece for now.',
      });
    }

    // Run the actual AI composition
    console.log('[jewellery-tryon] starting fal call', { productId: product.id, type, personImageUrl: personImageUrl.slice(0, 80), jewelleryImage: jewelleryImage.slice(0, 80) });
    const result = await jewelleryTryOn(personImageUrl, jewelleryImage, type, product.name);
    if (!result.ok || !result.outputUrl) {
      console.error('[jewellery-tryon] fal failure', { error: result.error, productId: product.id });
      return NextResponse.json({ error: result.error || 'AR Try-On generation failed' }, { status: 502 });
    }
    console.log('[jewellery-tryon] fal success, output URL host:', new URL(result.outputUrl).hostname);

    // Re-host on Supabase so the URL is permanent (fal CDN URLs are ephemeral)
    let finalUrl = result.outputUrl;
    if (storageConfigured()) {
      try {
        const fetched = await fetch(result.outputUrl);
        if (fetched.ok) {
          const buf = Buffer.from(await fetched.arrayBuffer());
          const ct = fetched.headers.get('content-type') || 'image/jpeg';
          const ext = ct.includes('png') ? 'png' : 'jpg';
          const path = makeUploadPath('jewellery-tryons', `${session.id}-${product.id}.${ext}`);
          const up = await uploadFile(path, buf, ct);
          finalUrl = up.url;
        }
      } catch {
        // Fall back to the ephemeral fal URL
      }
    }

    // Persist as an AiPreview record
    const preview = await prisma.aiPreview.create({
      data: {
        userId: session.id,
        type: 'MIRROR',
        sourceImage: personImageUrl,
        outputImage: finalUrl,
        productIds: [product.id],
        consentLogged: true,
        deleteAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    return NextResponse.json({
      ok: true,
      configured: true,
      previewId: preview.id,
      outputUrl: finalUrl,
      type,
      productName: product.name,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unknown error' }, { status: 500 });
  }
}
