import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';

export type CommercialInstrumentType = 'INITIAL' | 'ADDENDUM' | 'RENEWAL' | 'TERMINATION';
export type CommercialInstrumentStatus =
  | 'DRAFT'
  | 'ISSUED'
  | 'SELLER_SIGNED'
  | 'COMPANY_SIGNED'
  | 'ACTIVE'
  | 'EXPIRED'
  | 'TERMINATED'
  | 'SUPERSEDED'
  | 'VOID';

export type CommercialTermsSnapshot = {
  commissionPct: number;
  qualityScore: number;
  payoutCycle: string;
  isNeejeeSelect: boolean;
  paymentTerms?: string;
  settlementBasis?: string;
  returnsCommercialTreatment?: string;
  marketingContribution?: string;
  logisticsCommercialTerms?: string;
  taxTreatment?: string;
  otherTerms?: Record<string, unknown>;
};

export type CommercialInstrument = {
  id: string;
  sellerId: string | null;
  sellerRef: string;
  sequence: number;
  instrumentType: CommercialInstrumentType;
  instrumentNumber: string;
  title: string;
  parentInstrumentId: string | null;
  rootInstrumentId: string | null;
  status: CommercialInstrumentStatus;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  commissionPct: number | null;
  qualityScore: number | null;
  payoutCycle: string | null;
  isNeejeeSelect: boolean | null;
  termsSnapshot: any;
  documentSnapshot: any;
  changeReason: string | null;
  createdByUserId: string | null;
  issuedAt: Date | null;
  sellerSignedAt: Date | null;
  companySignedAt: Date | null;
  closedAt: Date | null;
  supersededAt: Date | null;
  terminatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SellerRelationshipEvent = {
  id: string;
  sellerId: string | null;
  sellerRef: string;
  instrumentId: string | null;
  eventKey: string;
  eventType: string;
  title: string;
  details: any;
  actorUserId: string | null;
  occurredAt: Date;
  createdAt: Date;
};

function jsonObject(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function isoDateOnly(value: Date | string | null | undefined): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

export function parseCommercialDate(value: unknown, fieldName: string): Date {
  const raw = String(value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new Error(`${fieldName} must be a valid date.`);
  }
  const date = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error(`${fieldName} must be a valid date.`);
  return date;
}

export function normalizeTerms(input: Partial<CommercialTermsSnapshot>): CommercialTermsSnapshot {
  const commissionPct = Number(input.commissionPct ?? 20);
  const qualityScore = Number(input.qualityScore ?? 0);
  const payoutCycle = String(input.payoutCycle || 'MONTHLY').trim().toUpperCase();

  if (!Number.isFinite(commissionPct) || commissionPct < 0 || commissionPct > 100) {
    throw new Error('Commission must be between 0 and 100%.');
  }
  if (!Number.isFinite(qualityScore) || qualityScore < 0 || qualityScore > 5) {
    throw new Error('Quality score must be between 0 and 5.');
  }
  if (!['WEEKLY', 'FORTNIGHTLY', 'MONTHLY'].includes(payoutCycle)) {
    throw new Error('Unsupported payout cycle.');
  }

  return {
    commissionPct,
    qualityScore,
    payoutCycle,
    isNeejeeSelect: !!input.isNeejeeSelect,
    paymentTerms: String(input.paymentTerms || '').trim() || undefined,
    settlementBasis: String(input.settlementBasis || '').trim() || undefined,
    returnsCommercialTreatment: String(input.returnsCommercialTreatment || '').trim() || undefined,
    marketingContribution: String(input.marketingContribution || '').trim() || undefined,
    logisticsCommercialTerms: String(input.logisticsCommercialTerms || '').trim() || undefined,
    taxTreatment: String(input.taxTreatment || '').trim() || undefined,
    otherTerms: jsonObject(input.otherTerms),
  };
}

export async function listCommercialInstruments(sellerRef: string): Promise<CommercialInstrument[]> {
  return prisma.$queryRaw<CommercialInstrument[]>`
    SELECT *
    FROM "SellerCommercialInstrument"
    WHERE "sellerRef" = ${sellerRef}
    ORDER BY "sequence" DESC
  `;
}

export async function listRelationshipEvents(sellerRef: string): Promise<SellerRelationshipEvent[]> {
  return prisma.$queryRaw<SellerRelationshipEvent[]>`
    SELECT *
    FROM "SellerRelationshipEvent"
    WHERE "sellerRef" = ${sellerRef}
    ORDER BY "occurredAt" DESC, "createdAt" DESC
    LIMIT 1000
  `;
}

export async function getInstrument(instrumentId: string): Promise<CommercialInstrument | null> {
  const rows = await prisma.$queryRaw<CommercialInstrument[]>`
    SELECT * FROM "SellerCommercialInstrument" WHERE "id" = ${instrumentId} LIMIT 1
  `;
  return rows[0] || null;
}

export async function getCurrentEffectiveInstrument(sellerRef: string, at = new Date()): Promise<CommercialInstrument | null> {
  const rows = await prisma.$queryRaw<CommercialInstrument[]>`
    SELECT *
    FROM "SellerCommercialInstrument"
    WHERE "sellerRef" = ${sellerRef}
      AND "instrumentType" <> 'TERMINATION'
      AND "status" IN ('ACTIVE','COMPANY_SIGNED','SELLER_SIGNED','ISSUED')
      AND "effectiveFrom" <= ${at}
      AND ("effectiveTo" IS NULL OR "effectiveTo" >= ${at})
    ORDER BY "effectiveFrom" DESC, "sequence" DESC
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function getLatestRelationshipInstrument(sellerRef: string): Promise<CommercialInstrument | null> {
  const rows = await prisma.$queryRaw<CommercialInstrument[]>`
    SELECT *
    FROM "SellerCommercialInstrument"
    WHERE "sellerRef" = ${sellerRef}
    ORDER BY "sequence" DESC
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function appendRelationshipEvent(input: {
  sellerId?: string | null;
  sellerRef: string;
  instrumentId?: string | null;
  eventKey: string;
  eventType: string;
  title: string;
  details?: Record<string, unknown>;
  actorUserId?: string | null;
  occurredAt?: Date;
}) {
  const id = randomUUID();
  const occurredAt = input.occurredAt || new Date();
  const details = JSON.stringify(input.details || {});

  await prisma.$executeRaw`
    INSERT INTO "SellerRelationshipEvent" (
      "id", "sellerId", "sellerRef", "instrumentId", "eventKey", "eventType", "title", "details", "actorUserId", "occurredAt", "createdAt"
    ) VALUES (
      ${id}, ${input.sellerId || null}, ${input.sellerRef}, ${input.instrumentId || null}, ${input.eventKey},
      ${input.eventType}, ${input.title}, CAST(${details} AS jsonb), ${input.actorUserId || null}, ${occurredAt}, NOW()
    )
    ON CONFLICT ("eventKey") DO NOTHING
  `;

  return id;
}

function instrumentTypeCounter(instruments: CommercialInstrument[], type: CommercialInstrumentType) {
  return instruments.filter((item) => item.instrumentType === type).length + 1;
}

function relationshipCode(sellerRef: string) {
  return String(sellerRef || 'SELLER').replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase() || 'SELLER';
}

function buildInstrumentIdentity(
  sellerRef: string,
  type: CommercialInstrumentType,
  typeIndex: number,
  parent?: CommercialInstrument | null,
) {
  const code = relationshipCode(sellerRef);
  const serial = String(typeIndex).padStart(3, '0');

  if (type === 'INITIAL') {
    return {
      number: `NEEJEE-${code}-AGR-${serial}`,
      title: `Marketplace Seller Agreement ${serial}`,
    };
  }
  if (type === 'ADDENDUM') {
    return {
      number: `NEEJEE-${code}-ADD-${serial}`,
      title: `Addendum ${typeIndex}${parent?.instrumentNumber ? ` to ${parent.instrumentNumber}` : ''}`,
    };
  }
  if (type === 'RENEWAL') {
    return {
      number: `NEEJEE-${code}-REN-${serial}`,
      title: `Renewal Agreement ${typeIndex}${parent?.instrumentNumber ? ` referring to ${parent.instrumentNumber}` : ''}`,
    };
  }
  return {
    number: `NEEJEE-${code}-TER-${serial}`,
    title: `Termination Agreement ${typeIndex}${parent?.instrumentNumber ? ` referring to ${parent.instrumentNumber}` : ''}`,
  };
}

export function relationshipReferences(instruments: CommercialInstrument[]) {
  return [...instruments]
    .sort((a, b) => a.sequence - b.sequence)
    .map((item) => ({
      id: item.id,
      sequence: item.sequence,
      instrumentType: item.instrumentType,
      instrumentNumber: item.instrumentNumber,
      title: item.title,
      status: item.status,
      effectiveFrom: isoDateOnly(item.effectiveFrom),
      effectiveTo: isoDateOnly(item.effectiveTo),
      closedAt: item.closedAt ? item.closedAt.toISOString() : null,
    }));
}

export async function createCommercialInstrument(input: {
  seller: {
    id: string;
    businessName: string;
    contactName: string;
    email: string;
    phone: string;
    kycStatus: string;
    commissionPct: number;
    qualityScore: number;
    payoutCycle: string;
    isNeejeeSelect: boolean;
    autoKycSummary?: unknown;
  };
  type: CommercialInstrumentType;
  validFrom: Date;
  validTo?: Date | null;
  terms: CommercialTermsSnapshot;
  changeReason?: string;
  actorUserId?: string | null;
}) {
  const existing = await listCommercialInstruments(input.seller.id);
  const chronological = [...existing].sort((a, b) => a.sequence - b.sequence);
  const latest = existing[0] || null;
  const root = chronological.find((item) => item.instrumentType === 'INITIAL') || latest;

  if (input.validTo && input.validTo < input.validFrom) {
    throw new Error('Validity end date cannot be earlier than the start date.');
  }

  if (input.type === 'INITIAL' && existing.length > 0) {
    throw new Error('An initial agreement already exists for this relationship. Use Addendum or Renewal instead.');
  }

  if (input.type !== 'INITIAL' && !latest) {
    throw new Error('Create the initial seller agreement before creating an addendum, renewal or termination.');
  }

  if (input.type === 'ADDENDUM') {
    if (!latest?.effectiveTo) {
      throw new Error('The current agreement has no end date. Set its validity before creating an addendum.');
    }
    if (input.validFrom > new Date(latest.effectiveTo)) {
      throw new Error('An addendum must take effect during the current contractual term. Use Renewal for a later term.');
    }
  }

  if (input.type === 'RENEWAL' && latest?.effectiveTo) {
    const latestEnd = new Date(latest.effectiveTo);
    if (input.validFrom < latestEnd) {
      throw new Error('A renewal cannot start before the current term ends. Use an Addendum for an early change.');
    }
  }

  if (input.type === 'TERMINATION') {
    if (!String(input.changeReason || '').trim()) {
      throw new Error('A termination reason is required for the permanent relationship record.');
    }
  }

  const sequence = existing.length + 1;
  const typeIndex = instrumentTypeCounter(existing, input.type);
  const identity = buildInstrumentIdentity(input.seller.id, input.type, typeIndex, latest);
  const id = randomUUID();
  const references = relationshipReferences(chronological);
  const rootInstrumentId = input.type === 'INITIAL' ? id : root?.rootInstrumentId || root?.id || latest?.id || null;
  const parentInstrumentId = input.type === 'INITIAL' ? null : latest?.id || null;
  const reason = String(input.changeReason || '').trim() || null;
  const termsJson = JSON.stringify(input.terms);
  const documentSnapshot = {
    instrumentId: id,
    instrumentType: input.type,
    instrumentNumber: identity.number,
    title: identity.title,
    seller: {
      id: input.seller.id,
      businessName: input.seller.businessName,
      contactName: input.seller.contactName,
      email: input.seller.email,
      phone: input.seller.phone,
    },
    validity: {
      validFrom: isoDateOnly(input.validFrom),
      validTo: isoDateOnly(input.validTo || null),
    },
    commercialTerms: input.terms,
    changeReason: reason,
    parentInstrumentId,
    rootInstrumentId,
    priorRelationshipHistory: references,
    annexedPriorInstruments: references.map((item) => ({
      instrumentNumber: item.instrumentNumber,
      title: item.title,
      instrumentType: item.instrumentType,
      effectiveFrom: item.effectiveFrom,
      effectiveTo: item.effectiveTo,
    })),
    generatedAt: new Date().toISOString(),
  };

  await prisma.$executeRaw`
    INSERT INTO "SellerCommercialInstrument" (
      "id", "sellerId", "sellerRef", "sequence", "instrumentType", "instrumentNumber", "title",
      "parentInstrumentId", "rootInstrumentId", "status", "effectiveFrom", "effectiveTo",
      "commissionPct", "qualityScore", "payoutCycle", "isNeejeeSelect", "termsSnapshot", "documentSnapshot",
      "changeReason", "createdByUserId", "createdAt", "updatedAt"
    ) VALUES (
      ${id}, ${input.seller.id}, ${input.seller.id}, ${sequence}, ${input.type}, ${identity.number}, ${identity.title},
      ${parentInstrumentId}, ${rootInstrumentId}, 'DRAFT', ${input.validFrom}, ${input.validTo || null},
      ${input.terms.commissionPct}, ${input.terms.qualityScore}, ${input.terms.payoutCycle}, ${input.terms.isNeejeeSelect},
      CAST(${termsJson} AS jsonb), CAST(${JSON.stringify(documentSnapshot)} AS jsonb),
      ${reason}, ${input.actorUserId || null}, NOW(), NOW()
    )
  `;

  await appendRelationshipEvent({
    sellerId: input.seller.id,
    sellerRef: input.seller.id,
    instrumentId: id,
    eventKey: `instrument-created:${id}`,
    eventType: `${input.type}_CREATED`,
    title: `${identity.title} created`,
    actorUserId: input.actorUserId || null,
    details: {
      instrumentNumber: identity.number,
      validFrom: isoDateOnly(input.validFrom),
      validTo: isoDateOnly(input.validTo || null),
      changeReason: reason,
      commercialTerms: input.terms,
      priorInstrumentCount: references.length,
    },
  });

  return getInstrument(id);
}

export function buildWorkflowForInstrument(input: {
  sellerSummary: unknown;
  instrument: CommercialInstrument;
  terms: CommercialTermsSnapshot;
  references: ReturnType<typeof relationshipReferences>;
}) {
  const summary = jsonObject(input.sellerSummary);
  const current = jsonObject(summary.agreementWorkflow);
  const previousDocument = jsonObject(current.currentDocumentJson);
  const previousMeta = jsonObject(previousDocument.meta);
  const previousCommercial = jsonObject(previousDocument.commercialTerms);
  const previousAnnexure = Array.isArray(previousDocument.annexure) ? previousDocument.annexure : [];

  const referenceText = input.references.length
    ? input.references.map((item) => `${item.instrumentNumber} (${item.instrumentType}, ${item.effectiveFrom}${item.effectiveTo ? ` to ${item.effectiveTo}` : ''})`).join('; ')
    : 'No previous commercial instrument';

  const annexureWithoutLifecycle = previousAnnexure.filter((item: any) => {
    const label = String(item?.label || '').toLowerCase();
    return ![
      'instrument type',
      'instrument number',
      'valid from',
      'valid until',
      'relationship history',
      'change / termination reason',
    ].includes(label);
  });

  const currentDocumentJson = {
    ...previousDocument,
    meta: {
      ...previousMeta,
      agreementNumber: input.instrument.instrumentNumber,
      instrumentId: input.instrument.id,
      instrumentType: input.instrument.instrumentType,
      instrumentTitle: input.instrument.title,
      effectiveDate: isoDateOnly(input.instrument.effectiveFrom),
      validFrom: isoDateOnly(input.instrument.effectiveFrom),
      validTo: isoDateOnly(input.instrument.effectiveTo),
      parentAgreementId: input.instrument.parentInstrumentId || '',
      relationshipRootId: input.instrument.rootInstrumentId || input.instrument.id,
      referenceHistory: input.references,
    },
    commercialTerms: {
      ...previousCommercial,
      ...input.terms,
    },
    annexure: [
      ...annexureWithoutLifecycle,
      { label: 'Instrument type', value: input.instrument.instrumentType.replace(/_/g, ' ') },
      { label: 'Instrument number', value: input.instrument.instrumentNumber },
      { label: 'Valid from', value: isoDateOnly(input.instrument.effectiveFrom) },
      { label: 'Valid until', value: isoDateOnly(input.instrument.effectiveTo) || 'Until terminated / superseded' },
      { label: 'Relationship history', value: referenceText },
      ...(input.instrument.changeReason ? [{ label: 'Change / termination reason', value: input.instrument.changeReason }] : []),
    ],
  };

  return {
    ...summary,
    agreementWorkflow: {
      ...current,
      instrumentId: input.instrument.id,
      instrumentType: input.instrument.instrumentType,
      instrumentSequence: input.instrument.sequence,
      agreementNumber: input.instrument.instrumentNumber,
      parentAgreementId: input.instrument.parentInstrumentId || '',
      relationshipRootId: input.instrument.rootInstrumentId || input.instrument.id,
      effectiveDate: isoDateOnly(input.instrument.effectiveFrom),
      validFrom: isoDateOnly(input.instrument.effectiveFrom),
      validTo: isoDateOnly(input.instrument.effectiveTo),
      renegotiationReason: input.instrument.changeReason || '',
      status: 'DRAFT',
      lockedAt: '',
      sentForSignatureAt: '',
      sellerSignedAt: '',
      companySignedAt: '',
      closedAt: '',
      voidedAt: '',
      sellerSigningToken: '',
      sellerSigningUrl: '',
      sellerSignatureStatus: '',
      sellerSignatureImageUrl: '',
      sellerSignatureProcessedUrl: '',
      sellerSignatureOtpRequestedAt: '',
      sellerSignatureOtpVerifiedAt: '',
      sellerSignedDocumentUrl: '',
      currentDocumentJson,
      lifecycleReferences: input.references,
      updatedAt: new Date().toISOString(),
    },
  };
}

export async function markInstrumentIssued(instrumentId: string) {
  await prisma.$executeRaw`
    UPDATE "SellerCommercialInstrument"
    SET "status" = 'ISSUED', "issuedAt" = COALESCE("issuedAt", NOW()), "updatedAt" = NOW()
    WHERE "id" = ${instrumentId}
  `;
}

export async function synchronizeEffectiveCommercialTerms(sellerRef?: string | null) {
  const sellerFilter = sellerRef ? prisma.$queryRaw<any[]>`
    SELECT "id", "kycStatus" FROM "Seller" WHERE "id" = ${sellerRef}
  ` : prisma.$queryRaw<any[]>`
    SELECT DISTINCT s."id", s."kycStatus"
    FROM "Seller" s
    JOIN "SellerCommercialInstrument" i ON i."sellerRef" = s."id"
  `;
  const sellers = await sellerFilter;
  const now = new Date();
  const results: Array<{ sellerId: string; action: string; instrumentId?: string }> = [];

  for (const seller of sellers) {
    await prisma.$executeRaw`
      UPDATE "SellerCommercialInstrument"
      SET "status" = 'EXPIRED', "updatedAt" = NOW()
      WHERE "sellerRef" = ${seller.id}
        AND "instrumentType" <> 'TERMINATION'
        AND "status" = 'ACTIVE'
        AND "effectiveTo" IS NOT NULL
        AND "effectiveTo" < ${now}
    `;

    const terminationRows = await prisma.$queryRaw<CommercialInstrument[]>`
      SELECT * FROM "SellerCommercialInstrument"
      WHERE "sellerRef" = ${seller.id}
        AND "instrumentType" = 'TERMINATION'
        AND "status" = 'TERMINATED'
        AND "effectiveFrom" <= ${now}
      ORDER BY "effectiveFrom" DESC, "sequence" DESC
      LIMIT 1
    `;

    if (terminationRows[0]) {
      if (seller.kycStatus !== 'SUSPENDED') {
        await prisma.seller.update({ where: { id: seller.id }, data: { kycStatus: 'SUSPENDED' as any }, select: { id: true } });
      }
      results.push({ sellerId: seller.id, action: 'terminated', instrumentId: terminationRows[0].id });
      continue;
    }

    const current = await getCurrentEffectiveInstrument(seller.id, now);
    if (current && current.status === 'ACTIVE') {
      await prisma.seller.update({
        where: { id: seller.id },
        data: {
          commissionPct: current.commissionPct ?? undefined,
          qualityScore: current.qualityScore ?? undefined,
          payoutCycle: current.payoutCycle ?? undefined,
          isNeejeeSelect: current.isNeejeeSelect ?? undefined,
        },
        select: { id: true },
      });
      results.push({ sellerId: seller.id, action: 'terms_synced', instrumentId: current.id });
    }
  }

  return results;
}
