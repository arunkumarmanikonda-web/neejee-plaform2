// AI Mirror — virtual try-on (async submit pattern).
// POST submits to fal.ai and returns a request_id immediately (no waiting).
// Client polls /api/ai/mirror/status?id=<requestId>&previewId=<id> until done.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { aiMirrorConfigured, falSubmitTryOn } from '@/lib/ai';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;  // submit-only is fast (~3-5s)

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Please sign in to use AI Mirror' }, { status: 401 });
  }

  try {
    const { productId, personImageUrl, consent } = await request.json();
    if (!consent) return NextResponse.json({ error: 'Consent required for AI generation' }, { status: 400 });
    if (!personImageUrl) return NextResponse.json({ error: 'Selfie image required' }, { status: 400 });
    if (!productId) return NextResponse.json({ error: 'Product required' }, { status: 400 });

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, images: true, aiTryOnEligible: true, craft: true, category: { select: { name: true } } },
    });
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    if (!product.aiTryOnEligible) return NextResponse.json({ error: 'This piece is not eligible for AI Mirror' }, { status: 400 });

    const garmentImage = product.images?.[0];
    if (!garmentImage) return NextResponse.json({ error: 'Product image unavailable' }, { status: 400 });

    const lower = `${product.category?.name || ''} ${product.craft || ''} ${product.name}`.toLowerCase();
    const garmentType =
      lower.includes('saree') || lower.includes('sari') ? 'lower_body' :
      lower.includes('kurta') || lower.includes('kurti') || lower.includes('blouse') || lower.includes('lehenga') ? 'upper_body' :
      'upper_body';

    // If AI not configured, return a stub
    if (!aiMirrorConfigured()) {
      const stub = await prisma.aiPreview.create({
        data: {
          userId: session.id,
          type: 'MIRROR',
          sourceImage: personImageUrl,
          outputImage: garmentImage,
          productIds: [product.id],
          consentLogged: true,
          deleteAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
      return NextResponse.json({
        ok: true,
        done: true,
        configured: false,
        previewId: stub.id,
        outputUrl: garmentImage,
        message: 'AI Mirror is being prepared. Showing the piece for now.',
      });
    }

    // Submit-only to fal.ai (does not wait for completion)
    const submit = await falSubmitTryOn(personImageUrl, garmentImage, garmentType);
    if (!submit.ok || !submit.requestId || !submit.endpoint) {
      console.warn('[ai/mirror] submit failed:', submit.error);
      return NextResponse.json({
        error: submit.error || 'Could not start generation',
        hint: 'Check that FAL_KEY is set in Vercel env, the selfie shows a person clearly, and the product image is accessible.',
      }, { status: 500 });
    }
    const requestId: string = submit.requestId;
    const submitEndpoint: string = submit.endpoint;

    // Create a pending preview record. We persist outputImage=null and the
    // client polls /status until we update it with the final URL.
    const pending = await prisma.aiPreview.create({
      data: {
        userId: session.id,
        type: 'MIRROR',
        sourceImage: personImageUrl,
        outputImage: null,
        productIds: [product.id],
        consentLogged: true,
        deleteAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    // Log the URLs fal gave us so we can verify they're correct
    console.log('[ai/mirror] fal submit returned:', {
      requestId,
      statusUrl: submit.statusUrl,
      responseUrl: submit.responseUrl,
    });

    // Pass fal's own status_url and response_url through to the poll endpoint.
    // Encode them in the poll URL so the status endpoint uses fal's actual URLs.
    const params = new URLSearchParams({
      id: requestId,
      previewId: pending.id,
      endpoint: submitEndpoint,
    });
    if (submit.statusUrl) params.set('statusUrl', submit.statusUrl);
    if (submit.responseUrl) params.set('responseUrl', submit.responseUrl);

    return NextResponse.json({
      ok: true,
      done: false,
      configured: true,
      previewId: pending.id,
      requestId,
      endpoint: submitEndpoint,
      pollUrl: `/api/ai/mirror/status?${params.toString()}`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
