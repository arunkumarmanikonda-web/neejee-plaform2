import { NextResponse } from 'next/server';
import { getSession, requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { resolveVendorForSession } from '@/lib/vendor-auth-helpers';
import { vendorFilePrefix } from '@/lib/vendor-private-files';
import { privateSellerDownload } from '@/lib/seller-private-files';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Sign in to open this file' }, { status: 401 });
  const { id } = await params;
  const missing = () => NextResponse.json({ error: 'File unavailable' }, { status: 404 });
  if (!/^[a-f0-9-]{36}$/.test(id)) return missing();
  const admin = requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'FINANCE']);
  const scope = admin ? null : await resolveVendorForSession(user);
  if (!admin && !scope) return missing();
  const fileUrl = vendorFilePrefix + id;
  const doc = await prisma.vendorDocument.findFirst({ where: { fileUrl, ...(scope && { vendorId: scope.vendorId }) },
    select: { vendorId: true, fileName: true, docType: true } });
  if (!doc) return missing();
  if (scope && !scope.isOwner) {
    if (doc.docType !== 'INVOICE') return missing();
    const order = await prisma.purchaseOrder.findFirst({ where: { vendorId: scope.vendorId, vendorInvoiceUrl: fileUrl, status: { not: 'DRAFT' } }, select: { id: true } });
    if (!order) return missing();
  }
  return privateSellerDownload('vendor-docs/' + doc.vendorId + '/' + id, doc.fileName);
}
