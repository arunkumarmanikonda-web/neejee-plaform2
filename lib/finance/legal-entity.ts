// v23.40.16 — Single source of truth for the NEEJEE legal entity record.
//
// Every invoice, purchase order, e-way bill, dispatch label, TDS certificate,
// payslip, and email signature should pull its issuer block from this helper
// so updates to GSTIN / address / bank / signatory propagate everywhere.
//
// Usage:
//   const issuer = await getIssuerProfile();
//   issuer.legalName  → "NEEJEE Lifestyle Pvt. Ltd."
//   issuer.gstin      → "09AAECO6856D1Z8"
//   issuer.address    → formatted single-line address
//   issuer.signatory  → "Nidhi Chauhan"
//
// The LegalEntity model is a singleton (key="default"). Edit it at
// /admin/settings/legal-entity. If the record is missing, this falls back
// to NEXT_PUBLIC_* env vars (back-compat with the v23.40.13 hardcoded block).

import { prisma } from '@/lib/prisma';

export interface IssuerProfile {
  legalName: string;
  brandName: string;
  tagline: string;
  gstin: string;
  pan: string;
  cin: string | null;
  email: string;
  phone: string;
  website: string;
  // Address
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  /** Single-line formatted address for compact display */
  address: string;
  /** Multi-line formatted address for invoice "From" block */
  addressMultiline: string;
  // Banking
  bankName: string;
  bankBranch: string | null;
  bankAccountName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  // Authorised signatory
  signatory: string;
  signatoryTitle: string;
  signatureUrl: string | null;
  logoUrl: string | null;
}

let cached: { value: IssuerProfile; at: number } | null = null;
const CACHE_TTL_MS = 60 * 1000; // 1 min — invoices are read-heavy

export async function getIssuerProfile(): Promise<IssuerProfile> {
  // Short cache because legal entity rarely changes; reduces DB hits during
  // bulk invoice generation
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

  const entity = await prisma.legalEntity.findUnique({ where: { key: 'default' } }).catch(() => null);

  // Build the issuer profile, falling back to env vars then to literal defaults
  // so the invoice never breaks even on a brand-new install.
  const env = process.env;

  const addressLine1 = entity?.addressLine1 || '';
  const addressLine2 = entity?.addressLine2 || '';
  const city         = entity?.city         || '';
  const state        = entity?.state        || '';
  const pincode      = entity?.pincode      || '';
  const country      = entity?.country      || 'India';

  const addressParts = [addressLine1, addressLine2, city, state, pincode, country].filter(Boolean);
  const address          = addressParts.join(', ');
  const addressMultiline = [
    [addressLine1, addressLine2].filter(Boolean).join(', '),
    [city, state, pincode].filter(Boolean).join(', '),
    country,
  ].filter(Boolean).join('\n');

  const profile: IssuerProfile = {
    legalName:   entity?.legalName   || env.NEXT_PUBLIC_NEEJEE_LEGAL_NAME || 'NEEJEE Lifestyle Pvt. Ltd.',
    brandName:   entity?.brandName   || 'NEEJEE',
    tagline:     'Found. Personal.',
    gstin:       entity?.gstin       || env.NEXT_PUBLIC_NEEJEE_GSTIN || '',
    pan:         entity?.pan         || env.NEXT_PUBLIC_NEEJEE_PAN   || '',
    cin:         entity?.cinNumber   || null,
    email:       entity?.contactEmail || env.NEXT_PUBLIC_NEEJEE_EMAIL || 'finance@neejee.com',
    phone:       entity?.contactPhone || env.NEXT_PUBLIC_NEEJEE_PHONE || '',
    website:     env.NEXT_PUBLIC_NEEJEE_WEBSITE || 'neejee.com',
    addressLine1, addressLine2, city, state, pincode, country,
    address,
    addressMultiline: addressMultiline || 'India',
    bankName:          entity?.bankName          || env.NEXT_PUBLIC_NEEJEE_BANK_NAME || '',
    bankBranch:        entity?.bankBranch        || null,
    bankAccountName:   entity?.bankAccountName   || entity?.legalName || env.NEXT_PUBLIC_NEEJEE_LEGAL_NAME || '',
    bankAccountNumber: entity?.bankAccountNumber || env.NEXT_PUBLIC_NEEJEE_BANK_AC || '',
    bankIfsc:          entity?.bankIfsc          || env.NEXT_PUBLIC_NEEJEE_IFSC    || '',
    signatory:         entity?.authorisedSignatory || env.NEXT_PUBLIC_NEEJEE_SIGNATORY || 'Nidhi Chauhan',
    signatoryTitle:    entity?.signatoryTitle      || env.NEXT_PUBLIC_NEEJEE_SIGNATORY_TITLE || 'Founder',
    signatureUrl:      entity?.signatureUrl     || null,
    logoUrl:           entity?.logoUrl          || null,
  };

  cached = { value: profile, at: Date.now() };
  return profile;
}

/** Manually bust the cache after the legal entity is updated. */
export function invalidateIssuerCache() {
  cached = null;
}
