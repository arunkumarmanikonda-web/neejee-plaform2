// Asset Library API — index of uploaded images for reuse across CMS
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
  try {
    const url = new URL(request.url);
    const folder = url.searchParams.get('folder');
    const search = url.searchParams.get('q');
    const limit = parseInt(url.searchParams.get('limit') || '100');

    const where: any = {};
    if (folder) where.folder = folder;
    if (search) {
      where.OR = [
        { filename: { contains: search, mode: 'insensitive' } },
        { alt: { contains: search, mode: 'insensitive' } },
        { caption: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [assets, folders] = await Promise.all([
      prisma.asset.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 500),
      }),
      // Distinct folders for filter sidebar
      prisma.asset.findMany({
        distinct: ['folder'],
        select: { folder: true },
        where: { folder: { not: null } },
      }),
    ]);

    return NextResponse.json({
      assets,
      folders: folders.map(f => f.folder).filter(Boolean).sort(),
    });
  } catch (e: any) {
    return NextResponse.json({ assets: [], folders: [], error: e.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { url, filename, folder, width, height, size, contentType, alt, caption, tags } = await request.json();
    if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 });

    // De-dupe by URL
    const existing = await prisma.asset.findFirst({ where: { url } });
    if (existing) return NextResponse.json({ asset: existing, duplicate: true });

    const asset = await prisma.asset.create({
      data: {
        url,
        filename: filename || null,
        folder: folder || null,
        width: width || null,
        height: height || null,
        size: size || null,
        contentType: contentType || null,
        alt: alt || null,
        caption: caption || null,
        tags: Array.isArray(tags) ? tags : [],
        uploadedBy: user!.id,
      },
    });

    return NextResponse.json({ asset });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id, ...updates } = await request.json();
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const data: any = {};
    const allowed = ['alt', 'caption', 'folder', 'tags'];
    for (const k of allowed) if (k in updates) data[k] = updates[k];

    const asset = await prisma.asset.update({ where: { id }, data });
    return NextResponse.json({ asset });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    await prisma.asset.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
