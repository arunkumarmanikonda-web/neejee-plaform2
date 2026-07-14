import { NextResponse } from 'next/server';
import { getSession, requireRole } from '@/lib/auth';
import { deleteMerchLaunch, getMerchLaunch, updateMerchLaunch } from '@/lib/merchandising/storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function isAllowed(user: Awaited<ReturnType<typeof getSession>>) {
  return requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR']);
}

export async function GET(
  _request: Request,
  context: { params: { id: string } }
) {
  const user = await getSession();
  if (!isAllowed(user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const launch = await getMerchLaunch(context.params.id);
    if (!launch) {
      return NextResponse.json({ error: 'Launch not found' }, { status: 404 });
    }
    return NextResponse.json({ launch });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load launch' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: { id: string } }
) {
  const user = await getSession();
  if (!isAllowed(user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const launch = await updateMerchLaunch(context.params.id, body);
    if (!launch) {
      return NextResponse.json({ error: 'Launch not found' }, { status: 404 });
    }
    return NextResponse.json({ launch });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to save launch' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: { id: string } }
) {
  const user = await getSession();
  if (!isAllowed(user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await deleteMerchLaunch(context.params.id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to delete launch' }, { status: 500 });
  }
}