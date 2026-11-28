// AI Jewellery Try-On — composites a jewellery piece onto a user portrait.
// Single-call synchronous endpoint (flux-pro/kontext completes in ~30-50s).
// Re-hosts the output to Supabase storage so the URL is permanent.
import { createPrivateAiMediaUrl, verifyPrivateAiMediaRequest } from '@/lib/ai/private-media';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { aiImageConfigured, jewelleryTryOn, detectJewelleryType, type JewelleryType } from '@/lib/ai';
import { privateStudioReadUrl, uploadPrivateAiFile, storageConfigured, makeUploadPath, deleteFile } from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 240; // flux kontext + safety check + rehost upload can take up to ~150s

const VALID_TYPES: JewelleryType[] = ['earrings', 'necklace', 'bangle', 'ring', 'auto'];

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Please sign in to use AR Try-On' }, { status: 401 });
  }

  try {
    const { productId, personImageUrl, consent, jewelleryType } = await request.json();
    if (consent !== true) return NextResponse.json({ error: 'Consent required for AI generation' }, { status: 400 });
    if (!personImageUrl) return NextResponse.json({ error: 'Portrait image required' }, { status: 400 });
    if (!productId) return NextResponse.json({ error: 'Product required' }, { status: 400 });

    let source: URL;
    try { source = new URL(personImageUrl); } catch { return NextResponse.json({ error: 'Choose your portrait again.' }, { status: 400 }); }
    const proof = verifyPrivateAiMediaRequest(source);
    if (source.pathname !== '/api/ai/media' || !proof.ok || !proof.path.startsWith('ai-tryon/' + session.id + '/')) {
      return NextResponse.json({ error: 'Choose your portrait again.' }, { status: 400 });
    }
    const canonicalSource = new URL(source.pathname + source.search, request.url).href;
    const product = await prisma.product.findFirst({
      where: { id: productId, status: 'ACTIVE', takedownAt: null, catalogueExclude: false, catalogueImageApproved: true },
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

    if (!aiImageConfigured() || !storageConfigured()) {
      return NextResponse.json({ error: 'Try-on is temporarily unavailable.' }, { status: 503 });
    }
    const portrait = await privateStudioReadUrl(proof.path);
    const result = await jewelleryTryOn(portrait, new URL(jewelleryImage, request.url).href, type, product.name);
    if (!result.ok) return NextResponse.json({ error: result.error || 'Try-on could not finish.' }, { status: 502 });
    let image = result.jpeg;
    let contentType = 'image/jpeg';
    if (!image && result.outputUrl) {
      const remote = new URL(result.outputUrl);
      if (remote.protocol !== 'https:' || !(remote.hostname === 'fal.media' || remote.hostname.endsWith('.fal.media'))) throw Error('Unrecognised output.');
      const response = await fetch(remote, { redirect: 'error', signal: AbortSignal.timeout(30000) });
      contentType = response.headers.get('content-type')?.split(';')[0] || '';
      if (!response.ok || !['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) throw Error('Invalid image.');
      image = Buffer.from(await response.arrayBuffer());
    }
    if (!image?.length || image.length > 16 * 1024 * 1024) throw Error('Invalid image.');
    const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
    const path = makeUploadPath('ai-tryon/' + session.id, 'preview.' + ext);
    const finalUrl = createPrivateAiMediaUrl(new URL(request.url).origin, path);
    await uploadPrivateAiFile(path, image, contentType);
    const preview = await prisma.aiPreview.create({
      data: { userId: session.id, type: 'MIRROR', sourceImage: canonicalSource, outputImage: finalUrl,
        productIds: [product.id], consentLogged: true, deleteAt: new Date(Date.now() + 30 * 86400000) },
    }).catch(async error => {
      await deleteFile('private-ai:' + path).catch(() => {});
      throw error;
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
    return NextResponse.json({ error: 'The photo service could not finish this preview.' }, { status: 502 });
  }
}
