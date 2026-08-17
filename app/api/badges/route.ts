// Public badge catalog endpoint.
import { NextResponse } from 'next/server';
import { loadActiveBadges } from '@/lib/badges-db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const badges = await loadActiveBadges();
    const response = NextResponse.json({ badges });
    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=900');
    return response;
  } catch (error: any) {
    console.error('[badges.public] failed', { message: error?.message });
    return NextResponse.json({ error: 'Badges are temporarily unavailable', badges: [] }, { status: 500 });
  }
}
