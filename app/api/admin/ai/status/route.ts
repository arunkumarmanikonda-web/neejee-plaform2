// v23.40.23 — AI configuration status check.
// Used by admin UI to show editors whether OpenAI / fal.ai / Supabase
// are actually configured. Helps diagnose "AI didn't generate the image"
// scenarios at a glance.
import { NextResponse } from 'next/server';
import { getSession, requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR', 'MARKETING_MANAGER', 'MARKETING_OPERATOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({
    text:    { configured: !!process.env.OPENAI_API_KEY,                  envVar: 'OPENAI_API_KEY' },
    image:   { configured: !!process.env.FAL_KEY,                          envVar: 'FAL_KEY' },
    storage: { configured: !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY), envVar: 'SUPABASE_URL + SUPABASE_SERVICE_KEY' },
  });
}
