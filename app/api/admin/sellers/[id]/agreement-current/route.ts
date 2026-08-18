import { NextResponse } from 'next/server';
import { getSession, requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { buildSellerAgreementMaster } from '@/lib/seller-agreement-master';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function asObject(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function meaningfulOverlay(base: Record<string, any>, overlay: Record<string, any>) {
  const next = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    if (value === null || value === undefined) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (typeof value === 'object' && !Array.isArray(value)) {
      next[key] = meaningfulOverlay(asObject(base[key]), asObject(value));
      continue;
    }
    next[key] = value;
  }
  return next;
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'QC_TEAM', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const seller = await prisma.seller.findUnique({
      where: { id: params.id },
      select: { id: true, autoKycSummary: true },
    });

    if (!seller) return NextResponse.json({ error: 'Seller not found' }, { status: 404 });

    const masterAgreement = await buildSellerAgreementMaster(params.id);
    const summary = asObject(seller.autoKycSummary);
    const workflow = asObject(summary.agreementWorkflow);
    const currentDocument = asObject(workflow.currentDocumentJson);

    if (Object.keys(currentDocument).length > 0) {
      const mergedDocument = meaningfulOverlay(asObject(masterAgreement), currentDocument);
      const meta = meaningfulOverlay(asObject((masterAgreement as any).meta), asObject(currentDocument.meta));
      const instrumentType = workflow.instrumentType || meta.instrumentType || 'INITIAL';
      const instrumentTitle = meta.instrumentTitle || (instrumentType === 'INITIAL' ? 'Marketplace Seller Agreement' : String(instrumentType).replace(/_/g, ' '));

      return NextResponse.json({
        agreement: {
          ...mergedDocument,
          title: currentDocument.title || instrumentTitle || masterAgreement.title,
          subtitle: currentDocument.subtitle || masterAgreement.subtitle,
          company: meaningfulOverlay(asObject(masterAgreement.company), asObject(currentDocument.company)),
          seller: meaningfulOverlay(asObject(masterAgreement.seller), asObject(currentDocument.seller)),
          clauses: Array.isArray(currentDocument.clauses) && currentDocument.clauses.length > 0
            ? currentDocument.clauses
            : masterAgreement.clauses,
          recitals: Array.isArray(currentDocument.recitals) && currentDocument.recitals.length > 0
            ? currentDocument.recitals
            : ((masterAgreement as any).recitals || []),
          commercialTerms: meaningfulOverlay(asObject(masterAgreement.commercialTerms), asObject(currentDocument.commercialTerms)),
          meta: {
            ...meta,
            agreementNumber: workflow.agreementNumber || meta.agreementNumber || '',
            instrumentId: workflow.instrumentId || meta.instrumentId || '',
            instrumentType,
            effectiveDate: workflow.effectiveDate || meta.effectiveDate || '',
            validFrom: workflow.validFrom || meta.validFrom || '',
            validTo: workflow.validTo || meta.validTo || '',
            parentAgreementId: workflow.parentAgreementId || meta.parentAgreementId || '',
            relationshipRootId: workflow.relationshipRootId || meta.relationshipRootId || '',
          },
          agreementNumber: workflow.agreementNumber || meta.agreementNumber || '',
          instrumentType,
          effectiveDate: workflow.effectiveDate || meta.effectiveDate || '',
          validFrom: workflow.validFrom || meta.validFrom || '',
          validTo: workflow.validTo || meta.validTo || '',
          status: workflow.status || 'DRAFT',
          lockedAt: workflow.lockedAt || '',
          sentForSignatureAt: workflow.sentForSignatureAt || '',
          sellerSignedAt: workflow.sellerSignedAt || '',
          companySignedAt: workflow.companySignedAt || '',
          closedAt: workflow.closedAt || '',
          generatedAt: meta.generatedAt || workflow.updatedAt || masterAgreement.generatedAt || new Date().toISOString(),
        },
        source: 'agreement_workflow_merged_with_NIAR_master',
      });
    }

    return NextResponse.json({ agreement: masterAgreement, source: 'NIAR_master' });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to load current seller agreement' }, { status: 500 });
  }
}
