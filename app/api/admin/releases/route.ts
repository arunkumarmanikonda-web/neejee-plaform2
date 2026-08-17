import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const READ_ROLES = [
  'ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR', 'QC_TEAM', 'FINANCE',
  'FINANCE_OPERATOR', 'MARKETING_OPERATOR', 'MARKETING_MANAGER',
] as const;

const ReviewSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(['approve', 'reject', 'request_rollback']),
  note: z.string().max(2000).optional().default(''),
});

export async function GET() {
  const user = await getSession();
  if (!requireRole(user, READ_ROLES as any)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const proposals = await prisma.$queryRawUnsafe<any[]>(`
    select id, title, domain, risk_class as "riskClass", status, summary, rationale,
           evidence, proposed_change as "proposedChange", test_plan as "testPlan",
           rollback_plan as "rollbackPlan", metrics, source, model,
           created_by as "createdBy", reviewed_by as "reviewedBy", review_note as "reviewNote",
           created_at as "createdAt", updated_at as "updatedAt", reviewed_at as "reviewedAt",
           applied_at as "appliedAt", rolled_back_at as "rolledBackAt"
      from private.autonomy_proposal
     order by case status when 'PROPOSED' then 0 when 'APPROVED' then 1 else 2 end, created_at desc
     limit 100
  `);

  const policies = await prisma.$queryRawUnsafe<any[]>(`
    select enabled, web_research_enabled as "webResearchEnabled",
           max_proposals_per_run as "maxProposalsPerRun", code_auto_apply as "codeAutoApply",
           core_auto_apply as "coreAutoApply", approval_required as "approvalRequired",
           updated_at as "updatedAt"
      from private.autonomy_policy where id = 1
  `);

  return NextResponse.json(
    { canApprove: user?.role === 'SUPER_ADMIN', policy: policies[0] || null, proposals },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}

export async function POST(request: Request) {
  const user = await getSession();
  if (!requireRole(user, ['SUPER_ADMIN'] as any)) {
    return NextResponse.json({ error: 'Super Admin approval required' }, { status: 403 });
  }

  const parsed = ReviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid review request' }, { status: 400 });

  const { id, action, note } = parsed.data;
  const actor = String(user?.id || user?.email || 'super-admin');
  const nextStatus = action === 'approve' ? 'APPROVED' : action === 'reject' ? 'REJECTED' : 'ROLLBACK_REQUESTED';

  const rows = await prisma.$queryRawUnsafe<any[]>(`
    update private.autonomy_proposal
       set status = $2, reviewed_by = $3, review_note = $4,
           reviewed_at = now(), updated_at = now()
     where id = $1::uuid and status in ('PROPOSED','APPROVED','APPLIED')
     returning id, title, status, risk_class as "riskClass"
  `, id, nextStatus, actor, note);

  if (!rows[0]) return NextResponse.json({ error: 'Proposal not found or transition is no longer valid' }, { status: 409 });

  await prisma.$executeRawUnsafe(`
    insert into private.autonomy_event (proposal_id, action, actor_id, payload)
    values ($1::uuid, $2, $3, jsonb_build_object('note', $4, 'status', $5))
  `, id, action.toUpperCase(), actor, note, nextStatus);

  return NextResponse.json({
    ok: true,
    proposal: rows[0],
    execution: nextStatus === 'APPROVED'
      ? 'Approved for controlled execution. Core/code auto-application remains blocked by policy.'
      : null,
  });
}
