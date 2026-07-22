import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';

const DEFAULT_STATUS = 'DRAFT';

const isObject = (value: unknown): value is Record<string, any> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const asString = (value: unknown, fallback = '') =>
  typeof value === 'string' ? value : fallback;

const nowIso = () => new Date().toISOString();

function toJsonObject(value: unknown): Record<string, any> {
  return isObject(value) ? value : {};
}

function maskBankAccount(value: unknown) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const tail = raw.slice(-4);
  return tail ? `••••${tail}` : '';
}

function buildFallbackDocument(seller: any) {
  return {
    meta: {
      agreementNumber: `AGR-${String(seller.id || '').slice(-8).toUpperCase()}`,
      generatedAt: nowIso(),
      effectiveDate: '',
      validFrom: '',
      validTo: '',
      renewalMode: 'MANUAL',
      renewalNoticeDays: 30,
      expiryAction: 'LOCK_STOCK_BARREL',
      templateVersion: 'v1',
    },
    company: {
      legalName: 'M/s Oye Imagine',
      brandName: 'Oye Imagine',
      gstin: '',
      pan: '',
      cinNumber: '',
      msmeNumber: '',
      address: '',
      contactEmail: '',
      contactPhone: '',
      authorisedSignatory: 'Authorised Signatory',
      signatoryTitle: '',
      signatureUrl: '',
      logoUrl: '',
    },
    seller: {
      id: seller.id,
      businessName: seller.businessName || '',
      contactName: seller.contactName || '',
      email: seller.email || '',
      phone: seller.phone || '',
      craft: seller.craft || '',
      region: seller.region || '',
      pan: seller.pan || '',
      gstin: seller.gstin || '',
      bankAccountMasked: maskBankAccount(seller.bankAccount),
      ifsc: seller.ifsc || '',
      bankName: seller.bankName || '',
      story: seller.story || '',
    },
    commercialTerms: {},
    recitals: [],
    annexure: [],
    clauses: [],
  };
}

async function fetchPrintableAgreement(request: NextRequest, sellerId: string, seller: any) {
  try {
    const url = new URL(`/api/admin/sellers/${sellerId}/agreement`, request.url);
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        cookie: request.headers.get('cookie') || '',
      },
      cache: 'no-store',
    });

    if (!response.ok) return buildFallbackDocument(seller);

    const json = await response.json();
    return isObject(json) ? json : buildFallbackDocument(seller);
  } catch {
    return buildFallbackDocument(seller);
  }
}

function deriveDefaultSignatory(documentJson: any) {
  const company = isObject(documentJson?.company) ? documentJson.company : {};
  return {
    id: 'default-company-signatory',
    name: asString(company.authorisedSignatory, 'Authorised Signatory'),
    title: asString(company.signatoryTitle, ''),
    signatureUrl: asString(company.signatureUrl, ''),
    isDefault: true,
    active: true,
  };
}

function buildAgreementBundle(documentJson: any, workflowState: Record<string, any>) {
  const defaultSignatory = deriveDefaultSignatory(documentJson);

  const signatories =
    Array.isArray(workflowState.signatories) && workflowState.signatories.length > 0
      ? workflowState.signatories
      : [defaultSignatory];

  const companySignatoryId =
    asString(workflowState.companySignatoryId) ||
    asString(signatories.find((x: any) => x?.isDefault)?.id) ||
    defaultSignatory.id;

  const meta = isObject(documentJson?.meta) ? documentJson.meta : {};

  const agreement = {
    id: asString(workflowState.id, `seller-agreement-${asString(documentJson?.seller?.id, '') || 'unknown'}`),
    sellerId: asString(documentJson?.seller?.id, ''),
    agreementNumber:
      asString(workflowState.agreementNumber) ||
      asString(meta.agreementNumber) ||
      `AGR-${String(documentJson?.seller?.id || '').slice(-8).toUpperCase()}`,
    templateVersion: asString(workflowState.templateVersion, asString(meta.templateVersion, 'v1')),
    status: asString(workflowState.status, DEFAULT_STATUS),
    currentDocumentJson: documentJson,
    companySignatoryId,
    effectiveDate: asString(workflowState.effectiveDate, asString(meta.effectiveDate, '')),
    signedDate: asString(workflowState.signedDate, ''),
    validFrom: asString(workflowState.validFrom, asString(meta.validFrom, '')),
    validTo: asString(workflowState.validTo, asString(meta.validTo, '')),
    renewalMode: asString(workflowState.renewalMode, asString(meta.renewalMode, 'MANUAL')),
    renewalNoticeDays: Number(workflowState.renewalNoticeDays ?? meta.renewalNoticeDays ?? 30),
    expiryAction: asString(workflowState.expiryAction, asString(meta.expiryAction, 'LOCK_STOCK_BARREL')),
    renegotiationReason: asString(workflowState.renegotiationReason, ''),
    parentAgreementId: asString(workflowState.parentAgreementId, ''),
    lockedAt: asString(workflowState.lockedAt, ''),
    reopenedAt: asString(workflowState.reopenedAt, ''),
    sentForSignatureAt: asString(workflowState.sentForSignatureAt, ''),
    sellerSignedAt: asString(workflowState.sellerSignedAt, ''),
    companySignedAt: asString(workflowState.companySignedAt, ''),
    closedAt: asString(workflowState.closedAt, ''),
    voidedAt: asString(workflowState.voidedAt, ''),
    updatedAt: asString(workflowState.updatedAt, nowIso()),
  };

  const observations =
    Array.isArray(workflowState.observations) ? workflowState.observations : [];

  return { agreement, signatories, observations };
}

async function loadSellerOr401(id: string) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN'])) {
    return { unauthorized: true as const };
  }

  const seller = await prisma.seller.findUnique({
    where: { id },
    select: {
      id: true,
      businessName: true,
      contactName: true,
      email: true,
      phone: true,
      story: true,
      pan: true,
      gstin: true,
      bankAccount: true,
      ifsc: true,
      bankName: true,
      region: true,
      craft: true,
      autoKycSummary: true,
    },
  });

  if (!seller) {
    return { notFound: true as const };
  }

  return { seller };
}

async function saveWorkflowState(
  seller: any,
  request: NextRequest,
  patch: Record<string, any>,
) {
  const printable = await fetchPrintableAgreement(request, seller.id, seller);

  const currentSummary = toJsonObject(seller.autoKycSummary);
  const currentWorkflow = toJsonObject(currentSummary.agreementWorkflow);

  const nextDocument =
    patch.currentDocumentJson !== undefined
      ? patch.currentDocumentJson
      : currentWorkflow.currentDocumentJson !== undefined
        ? currentWorkflow.currentDocumentJson
        : printable;

  const nextWorkflow = {
    ...currentWorkflow,
    ...patch,
    currentDocumentJson: nextDocument,
    updatedAt: nowIso(),
  };

  const nextSummary = {
    ...currentSummary,
    agreementWorkflow: nextWorkflow,
  };

  await prisma.seller.update({
    where: { id: seller.id },
    data: {
      autoKycSummary: nextSummary as any,
    },
  });

  return buildAgreementBundle(nextDocument, nextWorkflow);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const loaded = await loadSellerOr401(id);

    if ('unauthorized' in loaded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ('notFound' in loaded) {
      return NextResponse.json({ error: 'Seller not found' }, { status: 404 });
    }

    const seller = loaded.seller;
    const printable = await fetchPrintableAgreement(request, id, seller);
    const currentSummary = toJsonObject(seller.autoKycSummary);
    const currentWorkflow = toJsonObject(currentSummary.agreementWorkflow);

    const documentJson =
      currentWorkflow.currentDocumentJson !== undefined
        ? currentWorkflow.currentDocumentJson
        : printable;

    const bundle = buildAgreementBundle(documentJson, currentWorkflow);
    return NextResponse.json(bundle);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to load agreement workflow' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const loaded = await loadSellerOr401(id);

    if ('unauthorized' in loaded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ('notFound' in loaded) {
      return NextResponse.json({ error: 'Seller not found' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const patch: Record<string, any> = {};

    if (body?.document !== undefined) patch.currentDocumentJson = body.document;
    if (body?.currentDocumentJson !== undefined) patch.currentDocumentJson = body.currentDocumentJson;
    if (body?.status !== undefined) patch.status = String(body.status || DEFAULT_STATUS);
    if (body?.companySignatoryId !== undefined) patch.companySignatoryId = String(body.companySignatoryId || '');
    if (body?.agreementNumber !== undefined) patch.agreementNumber = String(body.agreementNumber || '');
    if (body?.templateVersion !== undefined) patch.templateVersion = String(body.templateVersion || 'v1');
    if (body?.effectiveDate !== undefined) patch.effectiveDate = String(body.effectiveDate || '');
    if (body?.signedDate !== undefined) patch.signedDate = String(body.signedDate || '');
    if (body?.validFrom !== undefined) patch.validFrom = String(body.validFrom || '');
    if (body?.validTo !== undefined) patch.validTo = String(body.validTo || '');
    if (body?.renewalMode !== undefined) patch.renewalMode = String(body.renewalMode || 'MANUAL');
    if (body?.renewalNoticeDays !== undefined) patch.renewalNoticeDays = Number(body.renewalNoticeDays || 30);
    if (body?.expiryAction !== undefined) patch.expiryAction = String(body.expiryAction || 'LOCK_STOCK_BARREL');
    if (body?.renegotiationReason !== undefined) patch.renegotiationReason = String(body.renegotiationReason || '');
    if (Array.isArray(body?.signatories)) patch.signatories = body.signatories;
    if (Array.isArray(body?.observations)) patch.observations = body.observations;

    const bundle = await saveWorkflowState(loaded.seller, request, patch);
    return NextResponse.json(bundle);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to save agreement workflow' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const loaded = await loadSellerOr401(id);

    if ('unauthorized' in loaded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ('notFound' in loaded) {
      return NextResponse.json({ error: 'Seller not found' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || '').trim().toUpperCase().replace(/\s+/g, '_');
    const patch: Record<string, any> = {};

    if (body?.document !== undefined) patch.currentDocumentJson = body.document;
    if (body?.currentDocumentJson !== undefined) patch.currentDocumentJson = body.currentDocumentJson;
    if (body?.companySignatoryId !== undefined) patch.companySignatoryId = String(body.companySignatoryId || '');
    if (body?.agreementNumber !== undefined) patch.agreementNumber = String(body.agreementNumber || '');
    if (body?.effectiveDate !== undefined) patch.effectiveDate = String(body.effectiveDate || '');
    if (body?.signedDate !== undefined) patch.signedDate = String(body.signedDate || '');
    if (body?.validFrom !== undefined) patch.validFrom = String(body.validFrom || '');
    if (body?.validTo !== undefined) patch.validTo = String(body.validTo || '');
    if (body?.renewalMode !== undefined) patch.renewalMode = String(body.renewalMode || 'MANUAL');
    if (body?.renewalNoticeDays !== undefined) patch.renewalNoticeDays = Number(body.renewalNoticeDays || 30);
    if (body?.expiryAction !== undefined) patch.expiryAction = String(body.expiryAction || 'LOCK_STOCK_BARREL');
    if (body?.renegotiationReason !== undefined) patch.renegotiationReason = String(body.renegotiationReason || '');

    switch (action) {
      case 'SAVE_DRAFT':
        patch.status = String(body?.status || 'DRAFT');
        break;
      case 'APPLY_STATUS':
        patch.status = String(body?.status || DEFAULT_STATUS);
        break;
      case 'LOCK':
        patch.status = 'LOCKED';
        patch.lockedAt = nowIso();
        break;
      case 'REOPEN':
        patch.status = 'SELLER_REVIEW';
        patch.reopenedAt = nowIso();
        break;
      case 'SEND_FOR_SIGNATURE':
        patch.status = 'SENT_FOR_SIGNATURE';
        patch.sentForSignatureAt = nowIso();
        break;
      case 'COMPANY_SIGN':
        patch.status = 'COMPANY_SIGNED';
        patch.companySignedAt = nowIso();
        if (!patch.signedDate) patch.signedDate = new Date().toISOString().slice(0, 10);
        break;
      case 'CLOSE':
        patch.status = 'CLOSED';
        patch.closedAt = nowIso();
        break;
      case 'VOID':
        patch.status = 'VOID';
        patch.voidedAt = nowIso();
        break;
      default:
        if (body?.status !== undefined) {
          patch.status = String(body.status || DEFAULT_STATUS);
        }
        break;
    }

    const bundle = await saveWorkflowState(loaded.seller, request, patch);
    return NextResponse.json(bundle);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to apply agreement workflow action' },
      { status: 500 }
    );
  }
}