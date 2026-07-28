import { NextRequest, NextResponse } from 'next/server';
import {
  SEO_CONTROL_PLANE_ENTRIES,
  filterSeoEntries,
  summarizeSeoValidation,
} from '../../../../admin/seo-control/_lib/registry';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
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
