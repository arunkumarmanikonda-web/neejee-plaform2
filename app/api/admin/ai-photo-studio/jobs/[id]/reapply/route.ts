// /api/admin/ai-photo-studio/jobs/[id]/reapply
// POST - re-push the existing APPROVED variants of a job into Product.images.
// No new AI calls, no new variant decisions \u2014 just re-applies what was already approved.
//
// Use when:
//   1. An earlier apply succeeded server-side but Product.images was left empty
//      (race / network / partial failure)
//   2. Admin wants to revert to a previous approved set
//   3. Admin deleted Product.images by hand and wants the AI photos back

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { reapplyApprovedVariantsToProduct } from '@/lib/ai-photo-studio/generate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN'];

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ADMIN_ROLES.includes(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const result = await reapplyApprovedVariantsToProduct(params.id);
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
