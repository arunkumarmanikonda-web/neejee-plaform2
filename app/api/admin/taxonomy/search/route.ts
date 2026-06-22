/**
 * GET /api/admin/taxonomy/search?q=...
 *
 * Returns up to 25 picker rows for autocomplete. Each row:
 *   { id, slug, name, level, path, label, breadcrumb }
 *
 * `label` is the full breadcrumb (e.g. "Women / Sarees / Banarasi") and is what
 * the picker should display in the dropdown.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession, requireRole } from '@/lib/auth';
import { searchCategories } from '@/lib/taxonomy/resolver';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!requireRole(session, ['ADMIN', 'SUPER_ADMIN', 'SELLER'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const q = req.nextUrl.searchParams.get('q') || '';
  const limit = Math.min(50, Number(req.nextUrl.searchParams.get('limit') || 25));
  const rows = await searchCategories(q, limit);
  return NextResponse.json({ ok: true, rows });
}
