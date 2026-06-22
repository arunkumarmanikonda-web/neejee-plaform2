// Download a blank inventory import template (.xlsx).
import { NextResponse } from 'next/server';
import { getSession, requireRole } from '@/lib/auth';
import { buildTemplateWorkbook } from '@/lib/inventory-io';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const buf = await buildTemplateWorkbook();
  return new NextResponse(buf as any, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="neejee-inventory-template.xlsx"',
      'Cache-Control': 'no-store',
    },
  });
}
