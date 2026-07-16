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

function normalizeId(value: unknown): string {
  return String(value ?? '').trim();
}

async function validateTemplateId(templateId: unknown) {
  if (templateId === undefined) {
    return { ok: true as const, normalized: undefined, provider: null };
  }

  const normalized = normalizeId(templateId);

  if (!normalized) {
    return {
      ok: false as const,
      status: 400,
      error: 'templateId cannot be empty.',
    };
  }

  if (!/^\d{5,25}$/.test(normalized)) {
    return {
      ok: false as const,
      status: 400,
      error: 'templateId must be a numeric Fast2SMS message ID.',
    };
  }

  const provider = await prisma.fast2SmsProviderTemplate.findUnique({
    where: { messageId: normalized },
  });

  if (provider) {
    return { ok: true as const, normalized, provider };
  }

  const entityMatch = await prisma.fast2SmsProviderTemplate.findFirst({
    where: { entityId: normalized },
  });

  if (entityMatch) {
    return {
      ok: false as const,
      status: 400,
      error: `templateId ${normalized} matches Fast2SMS entityId, not messageId. Use approved message ID ${entityMatch.messageId} instead.`,
    };
  }

  return {
    ok: false as const,
    status: 400,
    error: `templateId ${normalized} is not present in the Fast2SMS approved provider catalog. Import or seed the approved catalog first.`,
  };
}

export async function GET() {
  if (!(await gate())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const rows = await prisma.smsTemplate.findMany({ orderBy: { event: 'asc' } });
  return NextResponse.json({ templates: rows });
}

export async function PATCH(req: NextRequest) {
  if (!(await gate())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = await req.json();
  let { event, templateId, body, varOrder, active, label, category, notes } = payload || {};

  if (!event) {
    return NextResponse.json({ error: 'event required' }, { status: 400 });
  }

  const validation = await validateTemplateId(templateId);
  if (!validation.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: validation.error,
      },
      { status: validation.status }
    );
  }

  if (templateId !== undefined) {
    templateId = validation.normalized;
  }

  if ((body === undefined || String(body).trim() === '') && validation.provider?.body) {
    body = validation.provider.body;
  }

  const updated = await prisma.smsTemplate.update({
    where: { event },
    data: {
      ...(templateId !== undefined && { templateId }),
      ...(body !== undefined && { body: String(body) }),
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