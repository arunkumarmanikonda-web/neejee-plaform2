// Generate (or regenerate) the vintage thappa-seal PNG for a single badge.
// Calls fal-ai/flux/schnell with a NEEJEE-brand-tight prompt, downloads the
// generated PNG, re-uploads it to Supabase storage (permanent URL), and
// stores the durable URL on Badge.imageUrl.
import { NextResponse } from 'next/server';
import { getSession, requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateThappaSeal } from '@/lib/ai';
import { uploadFile, storageConfigured, makeUploadPath } from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 90;

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const badge = await prisma.badge.findUnique({ where: { id: params.id } });
  if (!badge) return NextResponse.json({ error: 'Badge not found' }, { status: 404 });

  // 1. Ask fal.ai to generate the seal
  const result = await generateThappaSeal(badge.label);
  if (!result.ok || !result.outputUrl) {
    return NextResponse.json(
      { error: result.error || 'Seal generation failed' },
      { status: 502 }
    );
  }

  // 2. Try to re-host on Supabase so the URL is permanent.
  let finalUrl = result.outputUrl;
  if (storageConfigured()) {
    try {
      const fetched = await fetch(result.outputUrl);
      if (fetched.ok) {
        const buf = Buffer.from(await fetched.arrayBuffer());
        const contentType = fetched.headers.get('content-type') || 'image/png';
        const ext = contentType.includes('jpeg') ? 'jpg' : 'png';
        const path = makeUploadPath('seals', `${badge.key.toLowerCase()}.${ext}`);
        const up = await uploadFile(path, buf, contentType);
        finalUrl = up.url;
      }
    } catch {
      // Fall back to fal URL (ephemeral, but works for testing)
    }
  }

  // 3. Persist
  const updated = await prisma.badge.update({
    where: { id: params.id },
    data: { imageUrl: finalUrl },
  });

  return NextResponse.json({ ok: true, badge: updated, generatedUrl: result.outputUrl });
}
