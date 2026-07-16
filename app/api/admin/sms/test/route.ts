import { NextResponse } from 'next/server';
import { getSession, requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getHealth() {
  const configured = !!(
    process.env.FAST2SMS_API_KEY &&
    process.env.FAST2SMS_SENDER_ID &&
    process.env.FAST2SMS_ENTITY_ID
  );

  return {
    ok: true,
    configured,
    disabled: !configured,
    phase: configured ? 'configured' : 'phase0',
    provider: 'Fast2SMS',
    senderId: process.env.FAST2SMS_SENDER_ID || '',
    entityId: process.env.FAST2SMS_ENTITY_ID || '',
    mode: process.env.FAST2SMS_ROUTE || 'dlt',
    balance: null,
    message: configured
      ? 'Provider configuration is present. Ad-hoc test sending remains guarded at route level.'
      : 'SMS provider is not configured yet. Add Fast2SMS values in Settings to enable SMS.',
  };
}

async function gate() {
  const user = await getSession();
  return requireRole(user, ['ADMIN', 'SUPER_ADMIN'] as any);
}

export async function GET() {
  if (!(await gate())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json(getHealth());
}

export async function POST() {
  if (!(await gate())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const health = getHealth();
  return NextResponse.json(
    {
      ...health,
      ok: false,
      disabled: true,
      message: health.configured
        ? 'Provider is configured, but manual SMS test sending is disabled in this phase.'
        : health.message,
    },
    { status: 403 }
  );
}