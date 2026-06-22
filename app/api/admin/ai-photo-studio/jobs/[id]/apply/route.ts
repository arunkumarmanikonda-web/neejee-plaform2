// /api/admin/ai-photo-studio/jobs/[id]/apply
// POST - apply chosen variants to the product (auto-replace mode per locked spec).
// Body: { approvedVariantIds: string[] }

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { applyApprovedVariantsToProduct } from '@/lib/ai-photo-studio/generate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN'];

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ADMIN_ROLES.includes(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const body = await req.json();
    const ids: string[] = Array.isArray(body.approvedVariantIds) ? body.approvedVariantIds : [];
    if (ids.length === 0) {
      return NextResponse.json({ error: 'approvedVariantIds is required' }, { status: 400 });
    }
    const result = await applyApprovedVariantsToProduct(params.id, ids, session.id);
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
