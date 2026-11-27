import { getSession } from '@/lib/auth';
import { canOpenAdminPage } from '@/lib/admin/shop-access';
import { NextRequest, NextResponse } from 'next/server';
import {
  SEO_CONTROL_PLANE_ENTRIES,
  filterSeoEntries,
  summarizeSeoValidation,
} from '../../../../admin/seo-control/_lib/registry';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user || !canOpenAdminPage(user.role, '/admin/seo-control')) {
    return NextResponse.json({error: 'Staff access required'}, {status: user ? 403 : 401});
  }
  const query = request.nextUrl.searchParams.get('q') ?? '';
  const entries = filterSeoEntries(query);
  const summary = summarizeSeoValidation(entries);

  return NextResponse.json({
    ok: true,
    query,
    total: entries.length,
    summary,
    allEntriesTotal: SEO_CONTROL_PLANE_ENTRIES.length,
    entries,
  });
}
