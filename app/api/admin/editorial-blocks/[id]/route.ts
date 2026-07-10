import crypto from 'node:crypto';
import { NextResponse } from 'next/server';

import { getSession, requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { slugify } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const WRITE_ROLES = ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'] as const;
const DELETE_ROLES = ['ADMIN', 'SUPER_ADMIN'] as const;

function asOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .map(item => (typeof item === 'string' ? item.trim() : ''))
          .filter(Boolean)
      )
    );
  }

  if (typeof value === 'string') {
    return Array.from(
      new Set(
        value
          .split(',')
          .map(item => item.trim())
          .filter(Boolean)
      )
    );
  }

  return [];
}

async function findBlock(idOrSlug: string) {
  return prisma.editorialBlock.findFirst({
    where: {
      OR: [{ id: idOrSlug }, { slug: idOrSlug }],
    },
  });
}

async function ensureUniqueSlug(
  baseSlug: string,
  currentId: string
): Promise<string> {
  const existing = await prisma.editorialBlock.findUnique({
    where: { slug: baseSlug },
    select: { id: true },
  });

  if (!existing || existing.id === currentId) {
    return baseSlug;
  }

  for (let i = 2; i <= 100; i += 1) {
    const candidate = `${baseSlug}-${i}`;
    const collision = await prisma.editorialBlock.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });

    if (!collision || collision.id === currentId) {
      return candidate;
    }
  }

  return `${baseSlug}-${Date.now()}`;
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getSession();
  if (!requireRole(user, [...WRITE_ROLES])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const block = await findBlock(params.id);

    if (!block) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ block });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Failed to load editorial block' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getSession();
  if (!requireRole(user, [...WRITE_ROLES])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();

    const existing = await prisma.editorialBlock.findFirst({
      where: {
        OR: [{ id: params.id }, { slug: params.id }],
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const data: Record<string, unknown> = {};

    if (body.title !== undefined) data.title = asOptionalString(body.title) ?? '';
    if (body.blockType !== undefined) data.blockType = asOptionalString(body.blockType) ?? 'RICH_TEXT';
    if (body.body !== undefined) data.body = asOptionalString(body.body) ?? '';
    if (body.subhead !== undefined) data.subhead = asOptionalString(body.subhead);
    if (body.kicker !== undefined) data.kicker = asOptionalString(body.kicker);
    if (body.audienceTag !== undefined) data.audienceTag = asOptionalString(body.audienceTag);
    if (body.ctaLabel !== undefined) data.ctaLabel = asOptionalString(body.ctaLabel);
    if (body.ctaHref !== undefined) data.ctaHref = asOptionalString(body.ctaHref);
    if (body.coverImage !== undefined) data.coverImage = asOptionalString(body.coverImage);
    if (body.tags !== undefined) data.tags = normalizeTags(body.tags);
    if (body.placement !== undefined) data.placement = asOptionalString(body.placement);

    if (body.slug !== undefined) {
      const rawSlug = asOptionalString(body.slug) ?? asOptionalString(body.title) ?? existing.id;
      const nextSlug = await ensureUniqueSlug(slugify(rawSlug), existing.id);
      data.slug = nextSlug;
    }

    if (body.regeneratePreviewToken === true) {
      data.previewToken = crypto.randomUUID();
    }

    if (body.status !== undefined) {
      data.status = body.status;

      if (body.status === 'PUBLISHED' && existing.status !== 'PUBLISHED') {
        data.publishedAt = new Date();
      }

      if (body.status === 'DRAFT' && !body.keepPublishedAt) {
        data.publishedAt = null;
      }
    }

    data.updatedById = user?.id ?? null;

    const block = await prisma.editorialBlock.update({
      where: { id: existing.id },
      data,
    });

    return NextResponse.json({ block });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Failed to update editorial block' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getSession();
  if (!requireRole(user, [...DELETE_ROLES])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const existing = await prisma.editorialBlock.findFirst({
      where: {
        OR: [{ id: params.id }, { slug: params.id }],
      },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await prisma.editorialBlock.delete({
      where: { id: existing.id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Failed to delete editorial block' },
      { status: 500 }
    );
  }
}
