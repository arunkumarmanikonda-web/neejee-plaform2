import crypto from 'node:crypto';
import { NextResponse } from 'next/server';

import { getSession, requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { slugify } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const WRITE_ROLES = ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'] as const;

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

async function ensureUniqueSlug(baseSlug: string): Promise<string> {
  let finalSlug = baseSlug;

  const existing = await prisma.editorialBlock.findUnique({
    where: { slug: finalSlug },
    select: { id: true },
  });

  if (!existing) return finalSlug;

  for (let i = 2; i <= 100; i += 1) {
    const candidate = `${baseSlug}-${i}`;
    const collision = await prisma.editorialBlock.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!collision) return candidate;
  }

  return `${baseSlug}-${Date.now()}`;
}

export async function GET() {
  const user = await getSession();
  if (!requireRole(user, [...WRITE_ROLES])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const blocks = await prisma.editorialBlock.findMany({
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({ blocks });
  } catch (error: any) {
    return NextResponse.json(
      { blocks: [], error: error?.message ?? 'Failed to load editorial blocks' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const user = await getSession();
  if (!requireRole(user, [...WRITE_ROLES])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();

    const title = asOptionalString(body.title);
    if (!title) {
      return NextResponse.json({ error: 'Title required' }, { status: 400 });
    }

    const blockType = asOptionalString(body.blockType) ?? 'RICH_TEXT';
    const baseSlug = slugify(asOptionalString(body.slug) ?? title);
    const finalSlug = await ensureUniqueSlug(baseSlug);

    const block = await prisma.editorialBlock.create({
      data: {
        title,
        slug: finalSlug,
        blockType,
        body: asOptionalString(body.body) ?? '',
        subhead: asOptionalString(body.subhead),
        kicker: asOptionalString(body.kicker),
        audienceTag: asOptionalString(body.audienceTag),
        ctaLabel: asOptionalString(body.ctaLabel),
        ctaHref: asOptionalString(body.ctaHref),
        coverImage: asOptionalString(body.coverImage),
        tags: normalizeTags(body.tags),
        placement: asOptionalString(body.placement),
        status: 'DRAFT',
        previewToken: crypto.randomUUID(),
        createdById: user?.id ?? null,
        updatedById: user?.id ?? null,
      },
    });

    return NextResponse.json({ block });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Failed to create editorial block' },
      { status: 500 }
    );
  }
}
