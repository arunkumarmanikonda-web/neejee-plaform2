import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';
import { invalidateTemplateCache } from '@/lib/sms-registry';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function gate() {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN'])) return null;
  return user;
}

export async function GET() {
  if (!(await gate())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const rows = await prisma.smsTemplate.findMany({ orderBy: { event: 'asc' } });
  return NextResponse.json({ templates: rows });
}

export async function PATCH(req: NextRequest) {
  if (!(await gate())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { event, templateId, body, varOrder, active, label, category, notes } = await req.json();
  if (!event) return NextResponse.json({ error: 'event required' }, { status: 400 });

  const updated = await prisma.smsTemplate.update({
    where: { event },
    data: {
      ...(templateId !== undefined && { templateId }),
      ...(body !== undefined && { body }),
      ...(Array.isArray(varOrder) && { varOrder }),
      ...(active !== undefined && { active }),
      ...(label !== undefined && { label }),
      ...(category !== undefined && { category }),
      ...(notes !== undefined && { notes }),
    },
  });
  invalidateTemplateCache();
  return NextResponse.json({ ok: true, template: updated });
}
