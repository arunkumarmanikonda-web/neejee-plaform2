import { NextResponse } from 'next/server';
import { products } from '@/lib/data';

// PRODUCTION: integrate Replicate / fal.ai for AI try-on
//   const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
//   const output = await replicate.run("idm-vton-or-similar", {
//     input: { person_image: userPhoto, garment_image: product.images[0] }
//   });
// Store the result in DB with consent log + 30-day auto-delete.

export async function POST(request: Request) {
  const body = await request.json();
  const { productId, userPhoto, consent } = body;

  if (!consent) {
    return NextResponse.json({ error: 'Consent required for AI generation' }, { status: 400 });
  }
  if (!userPhoto) {
    return NextResponse.json({ error: 'User photo required' }, { status: 400 });
  }

  const product = products.find(p => p.id === productId);
  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }
  if (!product.aiTryOnEligible) {
    return NextResponse.json({ error: 'Product not eligible for AI try-on' }, { status: 400 });
  }

  // DEV STUB: return the product image. In prod, this is the Replicate output.
  const outputImage = product.images[0];

  // Log to DB (Prisma):
  //   await prisma.aiPreview.create({
  //     data: {
  //       userId: session.user.id,
  //       type: 'MIRROR',
  //       sourceImage: userPhotoStorageUrl,
  //       outputImage,
  //       productIds: [productId],
  //       deleteAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  //     }
  //   });

  return NextResponse.json({
    success: true,
    outputImage,
    previewId: 'preview_' + Math.random().toString(36).slice(2, 10),
    note: 'A guidance, not a guarantee. Fabric falls differently on every body.',
    expiresInDays: 30,
  });
}
