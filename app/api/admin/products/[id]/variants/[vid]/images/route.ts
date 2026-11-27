import { NextResponse } from 'next/server';
import { getSession, requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { applyGalleryChange, parseGalleryChange, retryGalleryWrite } from '@/lib/catalog/variant-gallery';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id:string; vid:string }> };
const select = {id:true, productId:true, images:true} as const;
const missing = () => NextResponse.json({error:'Variant not found'}, {status:404});

async function checkEditor() {
  const user = await getSession();
  if (requireRole(user,['ADMIN','SUPER_ADMIN','CONTENT_EDITOR'])) return null;
  return NextResponse.json({error:'Unauthorized'}, {status:user ? 403 : 401});
}

export async function GET(_request:Request, props:Context) {
  const params = await props.params;
  const denied = await checkEditor();
  if (denied) return denied;
  const variant = await prisma.variant.findFirst({where:{id:params.vid, productId:params.id}, select});
  return variant ? NextResponse.json({ok:true, variantId:variant.id, productId:variant.productId, images:variant.images || []}) : missing();
}

async function update(request:Request, context:Context, remove:boolean) {
  const params = await context.params;
  const denied = await checkEditor();
  if (denied) return denied;
  const change = parseGalleryChange(await request.json().catch(() => null), remove);
  if (!change) return NextResponse.json({error:'Invalid gallery change'}, {status:400});
  try {
    const variant = await retryGalleryWrite(() => prisma.$transaction(async tx => {
      const current = await tx.variant.findFirst({where:{id:params.vid, productId:params.id}, select});
      if (!current) return null;
      const images = applyGalleryChange(current.images || [], change);
      return tx.variant.update({where:{id:current.id}, data:{images}, select});
    }, {isolationLevel:'Serializable'}));
    return variant ? NextResponse.json({ok:true, variantId:variant.id, productId:variant.productId, images:variant.images}) : missing();
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2034')
      return NextResponse.json({error:'This gallery changed while saving. Please retry.'}, {status:409});
    throw error;
  }
}

export async function POST(request:Request, context:Context) { return update(request, context, false); }
export async function DELETE(request:Request, context:Context) { return update(request, context, true); }
