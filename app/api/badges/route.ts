// Public badge catalog endpoint.
// Returns all ACTIVE badges so the PDP, product cards, and admin product picker
// can render the live list (including AI-generated seal imageUrls).
import { NextResponse } from 'next/server';
import { loadActiveBadges } from '@/lib/badges-db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const badges = await loadActiveBadges();
  return NextResponse.json({ badges });
}
