import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import {
  deleteFile,
  storageConfigured,
  storagePathFromPublicUrl,
} from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function pathStillReferenced(previewId: string, url: string): Promise<boolean> {
  const count = await prisma.aiPreview.count({
    where: {
      id: { not: previewId },
      OR: [
        { sourceImage: url },
        { outputImage: url },
      ],
    },
  });
  return count > 0;
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const params = await Promise.resolve(context.params);
  const previewId = String(params?.id || '').trim();
  if (!previewId) {
    return NextResponse.json({ error: 'Preview id is required' }, { status: 400 });
  }

  const preview = await prisma.aiPreview.findUnique({
    where: { id: previewId },
    select: {
      id: true,
      userId: true,
      sourceImage: true,
      outputImage: true,
    },
  });

  // Do not disclose another customer's preview existence.
  if (!preview || preview.userId !== session.id) {
    return NextResponse.json({ error: 'Preview not found' }, { status: 404 });
  }

  const urls = Array.from(
    new Set([preview.sourceImage, preview.outputImage].filter(Boolean) as string[]),
  );

  try {
    if (storageConfigured()) {
      for (const url of urls) {
        const path = storagePathFromPublicUrl(url);
        if (!path) continue;
        if (await pathStillReferenced(preview.id, url)) continue;
        await deleteFile(path);
      }
    }

    await prisma.aiPreview.delete({ where: { id: preview.id } });
    return NextResponse.json({ ok: true, deleted: true });
  } catch (error: any) {
    console.error('[ai-preview-delete]', {
      previewId: preview.id,
      userId: session.id,
      message: error?.message,
    });
    return NextResponse.json(
      { error: 'Unable to delete this preview right now' },
      { status: 500 },
    );
  }
}
