// Marketing Studio — POST to generate 4 image variants + copy.
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { canDraftMarketing } from '@/lib/marketing/roles';
import { runMarketingStudio } from '@/lib/marketing/studio';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Image generation is slow: 4 parallel nano-banana-pro calls can take ~60-90s
export const maxDuration = 300;

export async function POST(req: Request) {
  const session = await getSession();
  if (!canDraftMarketing(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const result = await runMarketingStudio(body);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[marketing-studio.generate]', err);
    return NextResponse.json({ error: err?.message || 'Generation failed' }, { status: 500 });
  }
}
