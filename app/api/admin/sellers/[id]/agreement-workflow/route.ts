import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';

const DEFAULT_STATUS = 'DRAFT';
const REGISTRY_SLUG = 'admin-legal-signatories';

const isObject = (value: unknown): value is Record<string, any> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const asString = (value: unknown, fallback = '') =>
  typeof value === 'string' ? value : fallback;

const nowIso = () => new Date().toISOString();

function toJsonObject(value: unknown): Record<string, any> {
  return isObject(value) ? value : {};
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? null));
}

function normalizeAction(value: unknown) {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
}

function maskBankAccount(value: unknown) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const tail = raw.slice(-4);
  return tail ? `****${tail}` : '';
}

function normalizeSignatory(item: any, index: number) {
  return {
    id: asString(item?.id, `signatory_${index + 1}`),
    name: asString(item?.name, ''),
    title: asString(item?.title, ''),
    email: asString(item?.email, ''),
    phone: asString(item?.phone, ''),
    signatureUrl: asString(item?.signatureUrl, ''),
    validFrom: asString(item?.validFrom, ''),
    validTo: asString(item?.validTo, ''),
    notes: asString(item?.notes, ''),
    active: item?.active !== false,
    isDefault: !!item?.isDefault,
  };
}

function dedupeSignatories(signatories: any[]) {
  const map = new Map<string, any>();

  signatories.forEach((item, index) => {
    const normalized = normalizeSignatory(item, index);
    if (
      !normalized.name &&
      !normalized.title &&
      !normalized.signatureUrl &&
      !normalized.email &&
      !normalized.phone
    ) {
      return;
    }
    const current = map.get(normalized.id) || {};
    map.set(normalized.id, { ...current, ...normalized });
  });

  let next = Array.from(map.values());
  if (!next.length) return [];

  const firstDefault = next.findIndex((item) => item.isDefault);
  next = next.map((item, index) => ({
    ...item,
    isDefault: firstDefault === -1 ? index === 0 : index === firstDefault,
  }));

  return next;
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
    email: asString(company.contactEmail, ''),
    phone: asString(company.contactPhone, ''),
    signatureUrl: asString(company.signatureUrl, ''),
    validFrom: '',
    validTo: '',
    notes: '',
    isDefault: true,
    active: true,
  };
}

async function loadCentralSignatories(documentJson: any) {
  try {
    const page = await prisma.cmsPage.findUnique({
      where: { slug: REGISTRY_SLUG },
      select: { sections: true },
    });

    const sections: any = page?.sections;
    const raw =
      isObject(sections) && Array.isArray(sections.items)
        ? sections.items
        : Array.isArray(sections)
          ? sections
          : [];

    const items = dedupeSignatories(raw as any[]);
    if (items.length) return items;
  } catch {}

  try {
    const entity = await prisma.legalEntity.findUnique({ where: { key: 'default' } });
    if (entity) {
      const item = dedupeSignatories([
        {
          id: 'default-company-signatory',
          name: entity.authorisedSignatory || 'Authorised Signatory',
          title: entity.signatoryTitle || '',
          email: entity.contactEmail || '',
          phone: entity.contactPhone || '',
          signatureUrl: entity.signatureUrl || '',
          active: true,
          isDefault: true,
        },
      ]);
      if (item.length) return item;
    }
  } catch {}

  return [deriveDefaultSignatory(documentJson)];
}

function mergeSignatories(registryItems: any[], workflowState: Record<string, any>, documentJson: any) {
  const workflowItems = Array.isArray(workflowState.signatories) ? workflowState.signatories : [];
  const merged = dedupeSignatories([...(registryItems || []), ...(workflowItems || [])]);
  return merged.length ? merged : [deriveDefaultSignatory(documentJson)];
}

function syncDocumentMeta(documentJson: any, workflowState: Record<string, any>, signatories: any[]) {
  const doc = deepClone(documentJson || {});
  doc.meta = isObject(doc.meta) ? doc.meta : {};
  doc.company = isObject(doc.company) ? doc.company : {};
  doc.seller = isObject(doc.seller) ? doc.seller : {};
  doc.commercialTerms = isObject(doc.commercialTerms) ? doc.commercialTerms : {};
  doc.recitals = Array.isArray(doc.recitals) ? doc.recitals : [];
  doc.annexure = Array.isArray(doc.annexure) ? doc.annexure : [];
  doc.clauses = Array.isArray(doc.clauses) ? doc.clauses : [];

  const selectedSignatory =
    signatories.find((item) => item.id === asString(workflowState.companySignatoryId)) ||
    signatories.find((item) => item.isDefault) ||
    signatories[0] ||
    deriveDefaultSignatory(doc);

  doc.meta.agreementNumber = asString(
    workflowState.agreementNumber,
    asString(doc.meta.agreementNumber, '')
  );
  doc.meta.templateVersion = asString(
    workflowState.templateVersion,
    asString(doc.meta.templateVersion, 'v1')
  );
  doc.meta.effectiveDate = asString(
    workflowState.effectiveDate,
    asString(doc.meta.effectiveDate, '')
  );
  doc.meta.validFrom = asString(
    workflowState.validFrom,
    asString(doc.meta.validFrom, '')
  );
  doc.meta.validTo = asString(
    workflowState.validTo,
    asString(doc.meta.validTo, '')
  );
  doc.meta.renewalMode = asString(
    workflowState.renewalMode,
    asString(doc.meta.renewalMode, 'MANUAL')
  );
  doc.meta.renewalNoticeDays = Number(
    workflowState.renewalNoticeDays ?? doc.meta.renewalNoticeDays ?? 30
  );
  doc.meta.expiryAction = asString(
    workflowState.expiryAction,
    asString(doc.meta.expiryAction, 'LOCK_STOCK_BARREL')
  );

  doc.company.authorisedSignatory = asString(
    selectedSignatory?.name,
    asString(doc.company.authorisedSignatory, 'Authorised Signatory')
  );
  doc.company.signatoryTitle = asString(
    selectedSignatory?.title,
    asString(doc.company.signatoryTitle, '')
  );
  doc.company.signatureUrl = asString(
    selectedSignatory?.signatureUrl,
    asString(doc.company.signatureUrl, '')
  );
  doc.company.contactEmail = asString(
    selectedSignatory?.email,
    asString(doc.company.contactEmail, '')
  );
  doc.company.contactPhone = asString(
    selectedSignatory?.phone,
    asString(doc.company.contactPhone, '')
  );

  return doc;
}

function buildAgreementBundle(documentJson: any, workflowState: Record<string, any>, signatories: any[]) {
  const selectedSignatory =
    signatories.find((item) => item.id === asString(workflowState.companySignatoryId)) ||
    signatories.find((item) => item.isDefault) ||
    signatories[0] ||
    deriveDefaultSignatory(documentJson);

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
    companySignatoryId: asString(
      workflowState.companySignatoryId,
      asString(selectedSignatory?.id, 'default-company-signatory')
    ),
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
  const currentWorkflow: Record<string, any> = toJsonObject(currentSummary.agreementWorkflow);

  const baseDocument =
    patch.currentDocumentJson !== undefined
      ? patch.currentDocumentJson
      : currentWorkflow.currentDocumentJson !== undefined
        ? currentWorkflow.currentDocumentJson
        : printable;

  const nextWorkflow: Record<string, any> = {
    ...currentWorkflow,
    ...patch,
    updatedAt: nowIso(),
  };

  const registryItems = await loadCentralSignatories(baseDocument);
  const signatories = mergeSignatories(registryItems, nextWorkflow, baseDocument);

  if (!nextWorkflow.companySignatoryId) {
    nextWorkflow.companySignatoryId =
      asString(signatories.find((item) => item.isDefault)?.id) ||
      asString(signatories[0]?.id);
  }

  const nextDocument = syncDocumentMeta(baseDocument, nextWorkflow, signatories);

  nextWorkflow.currentDocumentJson = nextDocument;
  nextWorkflow.signatories = signatories;

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

  return buildAgreementBundle(nextDocument, nextWorkflow, signatories);
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
    const currentWorkflow: Record<string, any> = toJsonObject(currentSummary.agreementWorkflow);

    const baseDocument =
      currentWorkflow.currentDocumentJson !== undefined
        ? currentWorkflow.currentDocumentJson
        : printable;

    const registryItems = await loadCentralSignatories(baseDocument);
    const signatories = mergeSignatories(registryItems, currentWorkflow, baseDocument);

    if (!currentWorkflow.companySignatoryId) {
      currentWorkflow.companySignatoryId =
        asString(signatories.find((item) => item.isDefault)?.id) ||
        asString(signatories[0]?.id);
    }

    const documentJson = syncDocumentMeta(baseDocument, currentWorkflow, signatories);
    const bundle = buildAgreementBundle(documentJson, currentWorkflow, signatories);
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
    const action = normalizeAction(body?.action);
    const patch: Record<string, any> = {};

    if (body?.document !== undefined) patch.currentDocumentJson = body.document;
    if (body?.currentDocumentJson !== undefined) patch.currentDocumentJson = body.currentDocumentJson;
    if (body?.companySignatoryId !== undefined) patch.companySignatoryId = String(body.companySignatoryId || '');
    if (body?.signatoryId !== undefined) patch.companySignatoryId = String(body.signatoryId || '');
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

    switch (action) {
      case 'SAVE_DRAFT':
        patch.status = String(body?.status || 'DRAFT');
        break;
      case 'APPLY_STATUS':
      case 'SET_STATUS':
        patch.status = String(body?.status || DEFAULT_STATUS);
        break;
      case 'SET_SIGNATORY':
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