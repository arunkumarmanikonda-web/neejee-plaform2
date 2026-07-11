import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';
import {
  publishDraftToJournal,
  rejectDraft,
  generateJournalText,
  generateCoverFromPrompt,
  normalizeStoryImages,
} from '@/lib/journal/auto-curate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function gate() {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return { user };
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((t) => String(t || '').toLowerCase().trim())
    .filter(Boolean)
    .slice(0, 8);
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const g = await gate();
  if (g.error) return g.error;

  const draft = await prisma.journalDraft.findUnique({ where: { id: params.id } });
  if (!draft) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ draft });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await gate();
  if (g.error) return g.error;

  try {
    const body = await req.json();
    const allowed: any = {};

    for (const k of ['title', 'excerpt', 'body', 'coverImage', 'coverImagePrompt'] as const) {
      if (typeof body[k] === 'string') allowed[k] = body[k];
    }

    if (Array.isArray(body.tags)) {
      allowed.tags = normalizeTags(body.tags);
    }

    if (Array.isArray(body.storyImages)) {
      allowed.storyImages = normalizeStoryImages(body.storyImages) as any;
    }

    const draft = await prisma.journalDraft.update({
      where: { id: params.id },
      data: allowed,
    });

    return NextResponse.json({ ok: true, draft });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Update failed' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const g = await gate();
  if (g.error) return g.error;

  const draft = await prisma.journalDraft.findUnique({ where: { id: params.id } });
  if (!draft) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (draft.status === 'PUBLISHED') {
    return NextResponse.json(
      { error: 'Cannot delete a published draft. Archive the CmsPage instead.' },
      { status: 400 }
    );
  }

  await prisma.journalDraft.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await gate();
  if (g.error) return g.error;

  try {
    const body = await req.json().catch(() => ({} as any));
    const action = String(body.action || '').toLowerCase();
    const note = body.note ? String(body.note) : '';

    const draft = await prisma.journalDraft.findUnique({ where: { id: params.id } });
    if (!draft) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (action === 'publish') {
      const { pageId, slug } = await publishDraftToJournal(params.id, g.user?.id || null);
      return NextResponse.json({ ok: true, pageId, slug });
    }

    if (action === 'reject') {
      await rejectDraft(params.id, g.user?.id || null, note);
      return NextResponse.json({ ok: true });
    }

    if (action === 'regenerate_text') {
      const nextStoryImages = Array.isArray(body.storyImages)
        ? normalizeStoryImages(body.storyImages)
        : normalizeStoryImages(draft.storyImages);

      const next = await generateJournalText({
        forceTheme: (draft.seedTheme as any) || undefined,
        textPrompt: body.textPrompt || '',
        coverImagePrompt: body.coverImagePrompt || draft.coverImagePrompt || '',
        storyImages: nextStoryImages,
      });

      const updated = await prisma.journalDraft.update({
        where: { id: params.id },
        data: {
          title: next.title,
          excerpt: next.excerpt,
          body: next.body,
          tags: next.tags,
          coverImagePrompt: next.coverImagePrompt,
          storyImages: nextStoryImages as any,
        },
      });

      return NextResponse.json({ ok: true, draft: updated });
    }

    if (action === 'regenerate_cover') {
      const prompt = String(body.coverImagePrompt || draft.coverImagePrompt || '').trim();
      if (!prompt) {
        return NextResponse.json({ error: 'Cover image prompt is required' }, { status: 400 });
      }

      const imageUrl = await generateCoverFromPrompt(prompt);
      if (!imageUrl) {
        return NextResponse.json({ error: 'Cover generation failed' }, { status: 500 });
      }

      const updated = await prisma.journalDraft.update({
        where: { id: params.id },
        data: {
          coverImage: imageUrl,
          coverImagePrompt: prompt,
        },
      });

      return NextResponse.json({ ok: true, draft: updated });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Action failed' }, { status: 500 });
  }
}
