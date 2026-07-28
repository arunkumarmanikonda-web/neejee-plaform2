import { NextRequest, NextResponse } from 'next/server';
import { searchCommandCenter } from '../../../../admin/command-center/_lib';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q') ?? '';
  const limitParam = Number(request.nextUrl.searchParams.get('limit') ?? '24');
  const limit = Number.isFinite(limitParam)
    ? Math.max(1, Math.min(50, limitParam))
    : 24;

  const results = searchCommandCenter(query, limit);

  return NextResponse.json({
    ok: true,
    query: results.query,
    total: results.total,
    grouped: results.grouped,
    results: results.results,
  });
}
