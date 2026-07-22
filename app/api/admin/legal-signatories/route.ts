import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SLUG = 'admin-legal-signatories';
const ALLOWED = ['ADMIN', 'SUPER_ADMIN', 'FINANCE'] as const;

const clean = (v: unknown, fallback = '') => typeof v === 'string' ? v.trim() : fallback;
const isObj = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);

async function requireAdmin() {
  const session = await getSession();
  if (!session || !ALLOWED.includes(session.role as any)) return null;
  return session;
}

function normalize(items: any[]) {
  let list = (Array.isArray(items) ? items : [])
    .map((item, i) => ({
      id: clean(item?.id, `signatory_${i + 1}`),
      name: clean(item?.name),
      title: clean(item?.title),
      email: clean(item?.email),
      phone: clean(item?.phone),
      signatureUrl: clean(item?.signatureUrl),
      validFrom: clean(item?.validFrom),
      validTo: clean(item?.validTo),
      active: item?.active !== false,
      isDefault: !!item?.isDefault,
    }))
    .filter(x => x.name || x.title || x.signatureUrl || x.email || x.phone);

  if (!list.length) return list;

  const firstDefault = list.findIndex(x => x.isDefault);
  list = list.map((x, i) => ({ ...x, isDefault: firstDefault === -1 ? i === 0 : i === firstDefault }));
  return list;
}

async function legalEntityFallback() {
  try {
    const entity = await prisma.legalEntity.findUnique({ where: { key: 'default' } });
    if (!entity) return [];
    const hasAny =
      clean(entity.authorisedSignatory) ||
      clean(entity.signatoryTitle) ||
      clean(entity.signatureUrl) ||
      clean(entity.contactEmail) ||
      clean(entity.contactPhone);
    if (!hasAny) return [];
    return [{
      id: 'default-company-signatory',
      name: clean(entity.authorisedSignatory, 'Authorised Signatory'),
      title: clean(entity.signatoryTitle),
      email: clean(entity.contactEmail),
      phone: clean(entity.contactPhone),
      signatureUrl: clean(entity.signatureUrl),
      validFrom: '',
      validTo: '',
      active: true,
      isDefault: true,
    }];
  } catch {
    return [];
  }
}

async function readItems() {
  const fallback = await legalEntityFallback();
  try {
    const page = await prisma.cmsPage.findUnique({
      where: { slug: SLUG },
      select: { sections: true },
    });

    const sections: any = page?.sections;
    const raw =
      isObj(sections) && Array.isArray(sections.items)
        ? sections.items
        : Array.isArray(sections)
          ? sections
          : [];

    const items = normalize(raw as any[]);
    return items.length ? items : fallback;
  } catch {
    return fallback;
  }
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const items = await readItems();
    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load signatories' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role === 'FINANCE') return NextResponse.json({ error: 'Read-only role' }, { status: 403 });

  try {
    const body = await request.json().catch(() => ({}));
    const items = normalize(Array.isArray(body?.items) ? body.items : []);

    await prisma.cmsPage.upsert({
      where: { slug: SLUG },
      update: {
        title: 'Admin Legal Signatories',
        template: 'SYSTEM_JSON',
        sections: { items, updatedAt: new Date().toISOString() } as any,
        status: 'DRAFT',
      },
      create: {
        slug: SLUG,
        title: 'Admin Legal Signatories',
        template: 'SYSTEM_JSON',
        sections: { items, updatedAt: new Date().toISOString() } as any,
        status: 'DRAFT',
      },
    });

    const defaultItem = items.find(x => x.isDefault) || items[0] || null;
    if (defaultItem) {
      const existing = await prisma.legalEntity.findUnique({ where: { key: 'default' } });
      await prisma.legalEntity.upsert({
        where: { key: 'default' },
        update: {
          authorisedSignatory: defaultItem.name || null,
          signatoryTitle: defaultItem.title || null,
          signatureUrl: defaultItem.signatureUrl || null,
          contactEmail: defaultItem.email || existing?.contactEmail || null,
          contactPhone: defaultItem.phone || existing?.contactPhone || null,
        },
        create: {
          key: 'default',
          legalName: existing?.legalName || 'M/s Oye Imagine',
          authorisedSignatory: defaultItem.name || null,
          signatoryTitle: defaultItem.title || null,
          signatureUrl: defaultItem.signatureUrl || null,
          contactEmail: defaultItem.email || null,
          contactPhone: defaultItem.phone || null,
        },
      });
    }

    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to save signatories' }, { status: 500 });
  }
}