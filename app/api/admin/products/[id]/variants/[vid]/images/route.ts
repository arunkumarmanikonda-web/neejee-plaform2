import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Body = {
  images?: string[]
  mode?: 'append' | 'replace'
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; vid: string }> }
) {
  const { id, vid } = await params

  const variant = await prisma.variant.findFirst({
    where: {
      id: vid,
      productId: id,
    },
    select: {
      id: true,
      productId: true,
      images: true,
    },
  })

  if (!variant) {
    return NextResponse.json({ error: 'Variant not found' }, { status: 404 })
  }

  return NextResponse.json({
    ok: true,
    variantId: variant.id,
    productId: variant.productId,
    images: variant.images ?? [],
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; vid: string }> }
) {
  const { id, vid } = await params
  const body = (await req.json()) as Body

  const incoming = Array.isArray(body.images) ? body.images.filter(Boolean) : []
  const mode = body.mode === 'replace' ? 'replace' : 'append'

  const existing = await prisma.variant.findFirst({
    where: {
      id: vid,
      productId: id,
    },
    select: {
      id: true,
      productId: true,
      images: true,
    },
  })

  if (!existing) {
    return NextResponse.json({ error: 'Variant not found' }, { status: 404 })
  }

  const nextImages =
    mode === 'replace'
      ? [...new Set(incoming)]
      : [...new Set([...(existing.images ?? []), ...incoming])]

  const updated = await prisma.variant.update({
    where: { id: vid },
    data: { images: nextImages },
    select: {
      id: true,
      productId: true,
      images: true,
    },
  })

  return NextResponse.json({
    ok: true,
    variantId: updated.id,
    productId: updated.productId,
    images: updated.images ?? [],
  })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; vid: string }> }
) {
  const { id, vid } = await params
  const { image } = await req.json()

  const existing = await prisma.variant.findFirst({
    where: {
      id: vid,
      productId: id,
    },
    select: {
      id: true,
      productId: true,
      images: true,
    },
  })

  if (!existing) {
    return NextResponse.json({ error: 'Variant not found' }, { status: 404 })
  }

  const nextImages = (existing.images ?? []).filter((x) => x !== image)

  const updated = await prisma.variant.update({
    where: { id: vid },
    data: { images: nextImages },
    select: {
      id: true,
      productId: true,
      images: true,
    },
  })

  return NextResponse.json({
    ok: true,
    variantId: updated.id,
    productId: updated.productId,
    images: updated.images ?? [],
  })
}