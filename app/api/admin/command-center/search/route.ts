import { getSession } from '@/lib/auth';
import { canOpenAdminPage } from '@/lib/admin/shop-access';
import { NextRequest, NextResponse } from 'next/server';
import { searchCommandCenter } from '../../../../admin/command-center/_lib';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user || !canOpenAdminPage(user.role, '/admin/command-center')) {
    return NextResponse.json({error: 'Staff access required'}, {status: user ? 403 : 401});
  }
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
