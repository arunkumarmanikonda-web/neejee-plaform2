// v23.40.23 — AI configuration status check.
// Used by admin UI to show editors whether OpenAI / fal.ai / Supabase
// are actually configured. Helps diagnose "AI didn't generate the image"
// scenarios at a glance.
import { NextResponse } from 'next/server';
import { getSession, requireRole } from '@/lib/auth';
import { creativeImagesConfigured } from '@/lib/ai/creative-images';
import { storageConfigured } from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR', 'MARKETING_MANAGER', 'MARKETING_OPERATOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({
    text:    { configured: Boolean(process.env.OPENAI_API_KEY?.trim()),                  envVar: 'OPENAI_API_KEY' },
    image:   { configured: creativeImagesConfigured(), envVar: 'FAL_KEY or OPENAI_API_KEY with media storage' },
    storage: { configured: storageConfigured(), envVar: 'SUPABASE_SERVICE_ROLE_KEY' },
  });
}
