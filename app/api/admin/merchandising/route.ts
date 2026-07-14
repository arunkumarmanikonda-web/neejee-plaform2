import { NextResponse } from 'next/server';
import { getSession, requireRole } from '@/lib/auth';
import { createMerchLaunch, listMerchLaunches } from '@/lib/merchandising/storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function isAllowed(user: Awaited<ReturnType<typeof getSession>>) {
  return requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR']);
}

export async function GET() {
  const user = await getSession();
  if (!isAllowed(user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const launches = await listMerchLaunches();
    return NextResponse.json({ launches });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load launches' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getSession();
  if (!isAllowed(user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const title = String(body?.title || '').trim();
    if (!title) {
      return NextResponse.json({ error: 'Title required' }, { status: 400 });
    }

    const launch = await createMerchLaunch({
      title,
      slug: body?.slug,
      startsAt: body?.startsAt,
      status: body?.status,
      productIds: Array.isArray(body?.productIds) ? body.productIds : [],
    });

    return NextResponse.json({ launch });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to create launch' }, { status: 500 });
  }
}