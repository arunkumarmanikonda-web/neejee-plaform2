import { NextResponse } from 'next/server';
import { getSession, requireRole } from '@/lib/auth';
import { createCatalogueProject, listCatalogueProjects } from '@/lib/catalogue-builder/storage';

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
    const projects = await listCatalogueProjects();
    return NextResponse.json({ projects });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load catalogue projects' }, { status: 500 });
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

    const project = await createCatalogueProject({
      title,
      slug: body?.slug,
      productIds: Array.isArray(body?.productIds) ? body.productIds : [],
    });

    return NextResponse.json({ project });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to create catalogue project' }, { status: 500 });
  }
}
