import { prisma } from '@/lib/prisma';

type JsonRecord = Record<string, any>;

const BLOCKING_ACTIONS = new Set([
  'LOCK_STOCK_BARREL',
  'BLOCK_NEW_UPLOADS',
  'REQUIRE_RENEGOTIATION',
  'CLOSE_AGREEMENT',
]);

const isObject = (value: unknown): value is JsonRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const asString = (value: unknown, fallback = '') =>
  typeof value === 'string' ? value : fallback;

function parseDateOnly(value: string) {
  if (!value) return null;
  const raw = value.trim();
  const d = new Date(raw.length <= 10 ? `${raw}T00:00:00` : raw);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

export type SellerAgreementUploadGate = {
  blocked: boolean;
  code: string;
  message: string;
  status: string;
  validTo: string;
  expiryAction: string;
  daysPastExpiry: number | null;
};

export async function getSellerAgreementUploadGate(
  sellerId: string
): Promise<SellerAgreementUploadGate> {
  const seller = await prisma.seller.findUnique({
    where: { id: sellerId },
    select: { autoKycSummary: true },
  });

  const summary: JsonRecord = isObject(seller?.autoKycSummary) ? (seller!.autoKycSummary as JsonRecord) : {};
  const workflow: JsonRecord = isObject(summary['agreementWorkflow']) ? (summary['agreementWorkflow'] as JsonRecord) : {};
  const currentDocument: JsonRecord = isObject(workflow['currentDocumentJson']) ? (workflow['currentDocumentJson'] as JsonRecord) : {};
  const meta: JsonRecord = isObject(currentDocument['meta']) ? (currentDocument['meta'] as JsonRecord) : {};

  const status = asString(workflow.status, 'UNKNOWN');
  const validTo = asString(workflow.validTo, asString(meta.validTo, ''));
  const expiryAction = asString(workflow.expiryAction, asString(meta.expiryAction, ''));

  const allow = (): SellerAgreementUploadGate => ({
    blocked: false,
    code: '',
    message: '',
    status,
    validTo,
    expiryAction,
    daysPastExpiry: null,
  });

  if (!validTo) return allow();

  const expiryDate = parseDateOnly(validTo);
  if (!expiryDate) return allow();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (expiryDate.getTime() >= today.getTime()) return allow();

  const resolvedAction = expiryAction || 'LOCK_STOCK_BARREL';
  if (!BLOCKING_ACTIONS.has(resolvedAction)) return allow();

  const daysPastExpiry = Math.round((today.getTime() - expiryDate.getTime()) / 86400000);

  let message = `Agreement expired on ${validTo}. New product uploads are blocked until the agreement is renewed.`;

  if (resolvedAction === 'BLOCK_NEW_UPLOADS') {
    message = `Agreement expired on ${validTo}. New product uploads are blocked.`;
  } else if (resolvedAction === 'REQUIRE_RENEGOTIATION') {
    message = `Agreement expired on ${validTo}. Renegotiation is required before new product uploads can continue.`;
  } else if (resolvedAction === 'CLOSE_AGREEMENT') {
    message = `Agreement expired on ${validTo}. Agreement is closed for further product uploads.`;
  } else if (resolvedAction === 'LOCK_STOCK_BARREL') {
    message = `Agreement expired on ${validTo}. Uploads are locked until the agreement is renewed.`;
  }

  return {
    blocked: true,
    code: 'AGREEMENT_UPLOAD_BLOCKED',
    message,
    status,
    validTo,
    expiryAction: resolvedAction,
    daysPastExpiry,
  };
}