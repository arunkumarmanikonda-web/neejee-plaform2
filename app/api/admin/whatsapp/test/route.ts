// Admin endpoint to send a test WhatsApp message
import { NextResponse } from 'next/server';
import { getSession, requireRole } from '@/lib/auth';
import { sendWhatsappText, whatsappConfigured } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { phone, message } = await request.json();
    if (!phone) return NextResponse.json({ error: 'phone required' }, { status: 400 });
    const result = await sendWhatsappText({
      to: phone,
      body: message || `Test message from NEEJEE. WhatsApp is connected. — ${new Date().toLocaleString('en-IN')}`,
    });
    return NextResponse.json({ ...result, configured: whatsappConfigured() });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
