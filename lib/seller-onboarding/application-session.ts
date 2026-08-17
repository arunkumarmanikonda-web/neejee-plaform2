import { createHash } from 'crypto';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { normalizePhone } from '@/lib/otp';
import type {
  ApplicationDocType,
  ExtractedDocFields,
  UploadedApplicationDocument,
} from '@/lib/seller-onboarding/document-intel';

export const SELLER_ONBOARDING_COOKIE = 'neejee-seller-onboarding';
const ONBOARDING_TTL_SECONDS = 2 * 60 * 60;
const DOCUMENT_PROOF_TTL_SECONDS = 2 * 60 * 60;

const rawSecret = process.env.AUTH_SECRET || '';
if (process.env.NODE_ENV === 'production' && rawSecret.length < 32) {
  throw new Error('AUTH_SECRET is missing or too short for seller onboarding');
}
const secret = new TextEncoder().encode(
  rawSecret || 'neejee-dev-secret-change-in-production-please',
);

type SellerOnboardingClaims = {
  purpose: 'seller_onboarding';
  phone: string;
};

type SellerDocumentClaims = {
  purpose: 'seller_document';
  applicant: string;
  docType: ApplicationDocType;
  title: string | null;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storageKey: string;
  extractedTextPreview: string;
  extractedFields: ExtractedDocFields;
};

export function sellerApplicantScope(phone: string): string {
  const normalized = normalizePhone(phone) || phone;
  return createHash('sha256').update(normalized).digest('hex').slice(0, 24);
}

export async function createSellerOnboardingToken(phone: string): Promise<string> {
  const normalized = normalizePhone(phone);
  if (!normalized) throw new Error('Invalid mobile number');

  return new SignJWT({ purpose: 'seller_onboarding', phone: normalized } satisfies SellerOnboardingClaims)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${ONBOARDING_TTL_SECONDS}s`)
    .sign(secret);
}

export async function readSellerOnboardingSession(expectedPhone?: string | null) {
  const token = cookies().get(SELLER_ONBOARDING_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret);
    if (payload.purpose !== 'seller_onboarding') return null;
    const phone = normalizePhone(String(payload.phone || ''));
    if (!phone) return null;

    if (expectedPhone) {
      const expected = normalizePhone(expectedPhone);
      if (!expected || expected !== phone) return null;
    }

    return { phone };
  } catch {
    return null;
  }
}

export async function createSellerDocumentProof(
  phone: string,
  document: UploadedApplicationDocument,
): Promise<string> {
  const normalized = normalizePhone(phone);
  if (!normalized) throw new Error('Invalid mobile number');

  const claims: SellerDocumentClaims = {
    purpose: 'seller_document',
    applicant: sellerApplicantScope(normalized),
    docType: document.docType,
    title: document.title ?? null,
    fileUrl: document.fileUrl,
    fileName: document.fileName,
    fileSize: document.fileSize,
    mimeType: document.mimeType,
    storageKey: document.storageKey,
    extractedTextPreview: document.extractedTextPreview,
    extractedFields: document.extractedFields,
  };

  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${DOCUMENT_PROOF_TTL_SECONDS}s`)
    .sign(secret);
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 30)
    : [];
}

export async function verifySellerDocumentProof(
  proof: string,
  phone: string,
): Promise<UploadedApplicationDocument | null> {
  const normalized = normalizePhone(phone);
  if (!normalized || !proof) return null;

  try {
    const { payload } = await jwtVerify(proof, secret);
    if (payload.purpose !== 'seller_document') return null;
    if (String(payload.applicant || '') !== sellerApplicantScope(normalized)) return null;

    const docType = String(payload.docType || '') as ApplicationDocType;
    if (![
      'PAN_CARD',
      'GST_CERTIFICATE',
      'MSME_CERTIFICATE',
      'CANCELLED_CHEQUE',
      'BANK_STATEMENT',
      'CERTIFICATION',
      'OTHER',
    ].includes(docType)) return null;

    const fields = (payload.extractedFields || {}) as Record<string, unknown>;
    const document: UploadedApplicationDocument = {
      docType,
      title: payload.title == null ? null : String(payload.title),
      fileUrl: String(payload.fileUrl || ''),
      fileName: String(payload.fileName || ''),
      fileSize: Number(payload.fileSize || 0),
      mimeType: String(payload.mimeType || ''),
      storageKey: String(payload.storageKey || ''),
      extractedTextPreview: String(payload.extractedTextPreview || '').slice(0, 2000),
      extractedFields: {
        pans: asStringArray(fields.pans),
        gstins: asStringArray(fields.gstins),
        cins: asStringArray(fields.cins),
        ifscs: asStringArray(fields.ifscs),
        bankAccounts: asStringArray(fields.bankAccounts),
        msmeNumbers: asStringArray(fields.msmeNumbers),
      },
    };

    if (!document.fileUrl || !document.fileName || !document.storageKey || !document.mimeType) return null;
    if (!Number.isFinite(document.fileSize) || document.fileSize <= 0) return null;

    return document;
  } catch {
    return null;
  }
}

export function sellerOnboardingCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: ONBOARDING_TTL_SECONDS,
    path: '/',
  };
}
