// app/api/admin/notification-templates/route.ts
// v26.3b — Admin endpoint for the template registry.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const templates = await prisma.notificationTemplate.findMany({
    orderBy: [{ channel: 'asc' }, { key: 'asc' }],
  });
  return NextResponse.json({ templates });
}

export async function PATCH(req: Request) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await req.json();
  const { id, providerTemplateId, approvalStatus, enabled } = body;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const data: any = {};
  if (providerTemplateId !== undefined) data.providerTemplateId = providerTemplateId;
  if (approvalStatus !== undefined) data.approvalStatus = approvalStatus;
  if (typeof enabled === 'boolean') data.enabled = enabled;

  const updated = await prisma.notificationTemplate.update({ where: { id }, data });
  return NextResponse.json({ template: updated });
}
