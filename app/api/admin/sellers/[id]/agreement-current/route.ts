import { NextResponse } from 'next/server';
import { getSession, requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function asObject(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'QC_TEAM', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const seller = await prisma.seller.findUnique({
    where: { id: params.id },
    select: { id: true, autoKycSummary: true },
  });

  if (!seller) return NextResponse.json({ error: 'Seller not found' }, { status: 404 });

  const summary = asObject(seller.autoKycSummary);
  const workflow = asObject(summary.agreementWorkflow);
  const currentDocument = asObject(workflow.currentDocumentJson);

  if (Object.keys(currentDocument).length > 0) {
    const meta = asObject(currentDocument.meta);
    return NextResponse.json({
      agreement: {
        ...currentDocument,
        meta: {
          ...meta,
          agreementNumber: workflow.agreementNumber || meta.agreementNumber || '',
          instrumentId: workflow.instrumentId || meta.instrumentId || '',
          instrumentType: workflow.instrumentType || meta.instrumentType || 'INITIAL',
          effectiveDate: workflow.effectiveDate || meta.effectiveDate || '',
          validFrom: workflow.validFrom || meta.validFrom || '',
          validTo: workflow.validTo || meta.validTo || '',
          parentAgreementId: workflow.parentAgreementId || meta.parentAgreementId || '',
          relationshipRootId: workflow.relationshipRootId || meta.relationshipRootId || '',
        },
        agreementNumber: workflow.agreementNumber || meta.agreementNumber || '',
        instrumentType: workflow.instrumentType || meta.instrumentType || 'INITIAL',
        effectiveDate: workflow.effectiveDate || meta.effectiveDate || '',
        validFrom: workflow.validFrom || meta.validFrom || '',
        validTo: workflow.validTo || meta.validTo || '',
        status: workflow.status || 'DRAFT',
        lockedAt: workflow.lockedAt || '',
        sentForSignatureAt: workflow.sentForSignatureAt || '',
        sellerSignedAt: workflow.sellerSignedAt || '',
        companySignedAt: workflow.companySignedAt || '',
        closedAt: workflow.closedAt || '',
        generatedAt: meta.generatedAt || workflow.updatedAt || new Date().toISOString(),
      },
      source: 'agreement_workflow',
    });
  }

  const fallbackUrl = new URL(`/api/admin/sellers/${params.id}/agreement`, request.url);
  const response = await fetch(fallbackUrl, {
    method: 'GET',
    headers: { cookie: request.headers.get('cookie') || '' },
    cache: 'no-store',
  });
  const json = await response.json().catch(() => ({}));
  return NextResponse.json(json, { status: response.status });
}
