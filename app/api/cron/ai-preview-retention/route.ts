import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  deleteFile,
  storageConfigured,
  storagePathFromPublicUrl,
} from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.warn('[ai-preview-retention] CRON_SECRET not set — refusing');
    return false;
  }
  return (req.headers.get('authorization') || '') === `Bearer ${expected}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return runRetention();
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return runRetention();
}

async function localPathStillNeeded(
  previewId: string,
  publicUrl: string,
  now: Date,
): Promise<boolean> {
  const count = await prisma.aiPreview.count({
    where: {
      id: { not: previewId },
      deleteAt: { gt: now },
      OR: [
        { sourceImage: publicUrl },
        { outputImage: publicUrl },
      ],
    },
  });
  return count > 0;
}

async function runRetention() {
  if (!storageConfigured()) {
    return NextResponse.json(
      { error: 'storage not configured' },
      { status: 503 },
    );
  }

  const now = new Date();
  const due = await prisma.aiPreview.findMany({
    where: { deleteAt: { lte: now } },
    orderBy: { deleteAt: 'asc' },
    take: 100,
    select: {
      id: true,
      sourceImage: true,
      outputImage: true,
      deleteAt: true,
    },
  });

  const results: Array<{
    id: string;
    deleted: boolean;
    localObjectsDeleted: number;
    error?: string;
  }> = [];

  for (const preview of due) {
    try {
      const urls = Array.from(
        new Set([preview.sourceImage, preview.outputImage].filter(Boolean) as string[]),
      );
      let localObjectsDeleted = 0;

      for (const url of urls) {
        const path = storagePathFromPublicUrl(url);
        if (!path) continue;

        const stillNeeded = await localPathStillNeeded(preview.id, url, now);
        if (stillNeeded) continue;

        await deleteFile(path);
        localObjectsDeleted++;
      }

      await prisma.aiPreview.delete({ where: { id: preview.id } });
      results.push({ id: preview.id, deleted: true, localObjectsDeleted });
    } catch (error: any) {
      console.error('[ai-preview-retention] failed', {
        previewId: preview.id,
        message: error?.message,
      });
      results.push({
        id: preview.id,
        deleted: false,
        localObjectsDeleted: 0,
        error: 'cleanup failed',
      });
    }
  }

  return NextResponse.json({
    ok: true,
    checked: due.length,
    deleted: results.filter((result) => result.deleted).length,
    failed: results.filter((result) => !result.deleted).length,
    results,
  });
}
