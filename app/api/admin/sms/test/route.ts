import { NextRequest, NextResponse } from 'next/server';
import { getSession, requireRole } from '@/lib/auth';
import { sendDltSms, fast2smsConfigured, fast2smsBalance } from '@/lib/sms';
import { getTemplate, markUsed, type SmsEvent } from '@/lib/sms-registry';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function gate() {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN'])) return null;
  return user;
}

export async function GET() {
  if (!(await gate())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const configured = fast2smsConfigured();
  const bal = configured ? await fast2smsBalance() : { ok: false, error: 'not configured' };
  return NextResponse.json({
    configured,
    senderId: process.env.FAST2SMS_SENDER_ID || 'NEEJEY',
    entityId: process.env.FAST2SMS_DLT_ENTITY_ID ? 'set' : 'missing',
    mode: process.env.FAST2SMS_MODE || 'live',
    balance: bal,
  });
}

export async function POST(req: NextRequest) {
  if (!(await gate())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { phone, event, vars } = await req.json();
  if (!phone || !event) return NextResponse.json({ error: 'phone and event required' }, { status: 400 });

  const tpl = await getTemplate(event as SmsEvent);
  if (!tpl) return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  if (!tpl.ready) return NextResponse.json({ error: `Template ${event} not ready — paste a real DLT ID first` }, { status: 400 });

  const varValues: string[] = tpl.varOrder.map(k => String(vars?.[k] ?? `<${k}>`));

  const result = await sendDltSms({
    phone,
    templateId: tpl.templateId,
    vars: varValues,
    rawMessage: tpl.body,
  });
  if (result.ok) await markUsed(event as SmsEvent);
  return NextResponse.json(result);
}
