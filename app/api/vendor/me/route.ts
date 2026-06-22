// GET /api/vendor/me — vendor profile + stats + profile completion + pending counts.
// Powers the dashboard header and progress bar.
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { prismaErrorToHttp } from '@/lib/prisma-errors';
import { computeProfileCompletion, profileChecklist } from '@/lib/vendor-profile';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'VENDOR') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const vendor = await prisma.vendor.findUnique({
      where: { userId: session.id },
      include: {
        user: { select: { passwordHash: true } },
      },
    });
    if (!vendor) return NextResponse.json({ error: 'No vendor profile' }, { status: 404 });

    // Aggregate stats + outstanding balance
    const [poStats, docs, pendingChanges, receivedPos, paidPayouts] = await Promise.all([
      prisma.purchaseOrder.groupBy({
        by: ['status'],
        where: { vendorId: vendor.id, status: { notIn: ['DRAFT'] } },
        _count: { _all: true },
        _sum: { totalPaise: true },
      }),
      prisma.vendorDocument.findMany({
        where: { vendorId: vendor.id },
        select: { docType: true, status: true },
      }),
      prisma.vendorChangeRequest.count({
        where: { vendorId: vendor.id, status: 'PENDING' },
      }),
      prisma.purchaseOrder.findMany({
        where: { vendorId: vendor.id, status: { in: ['RECEIVED', 'CLOSED'] } },
        select: { id: true, totalPaise: true },
      }),
      prisma.vendorPayout.findMany({
        where: { vendorId: vendor.id, status: 'PAID' },
        select: { poIds: true },
      }),
    ]);

    const approvedDocTypes = new Set<string>(docs.filter(d => d.status === 'APPROVED').map(d => String(d.docType)));
    const completion = computeProfileCompletion(vendor, approvedDocTypes);
    const checklist = profileChecklist(vendor, approvedDocTypes);

    // Bucket PO stats
    const buckets = {
      pendingAction: 0,
      inProgress: 0,
      completed: 0,
      pendingValuePaise: 0,
      lifetimeValuePaise: 0,
    };
    for (const row of poStats) {
      const n = row._count._all;
      const v = row._sum.totalPaise || 0;
      buckets.lifetimeValuePaise += v;
      if (row.status === 'SENT')                          { buckets.pendingAction += n; buckets.pendingValuePaise += v; }
      else if (['CONFIRMED', 'DISPATCHED'].includes(row.status as string)) buckets.inProgress += n;
      else if (['RECEIVED', 'CLOSED'].includes(row.status as string))      buckets.completed  += n;
    }

    // Outstanding balance = sum of RECEIVED/CLOSED PO totals not in any PAID payout
    const paidPoIds = new Set<string>();
    for (const p of paidPayouts) for (const id of (p.poIds || [])) paidPoIds.add(id);
    let outstandingPaise = 0;
    let outstandingPoCount = 0;
    for (const po of receivedPos) {
      if (!paidPoIds.has(po.id)) {
        outstandingPaise += po.totalPaise;
        outstandingPoCount += 1;
      }
    }

    return NextResponse.json({
      vendor: {
        id: vendor.id,
        legalName: vendor.legalName,
        displayName: vendor.displayName,
        contactEmail: vendor.contactEmail,
        contactPhone: vendor.contactPhone,
        contactPerson: vendor.contactPerson,
        status: vendor.status,
        paymentTermsDays: vendor.paymentTermsDays,
        hasPassword: !!vendor.user?.passwordHash,
        createdAt: vendor.createdAt,
      },
      stats: buckets,
      outstanding: { totalPaise: outstandingPaise, poCount: outstandingPoCount },
      pendingChangeRequests: pendingChanges,
      profile: {
        completionPercent: completion,
        checklist,
      },
    });
  } catch (e: any) {
    console.error('[vendor/me GET]', e);
    const { status, message, code } = prismaErrorToHttp(e);
    return NextResponse.json({ error: message, code }, { status });
  }
}
