// v23.40.25.2 — Public-facing contact info, sourced from the LegalEntity's
// PUBLIC fields ONLY. The authorised signatory's contactEmail / contactPhone
// are NEVER exposed on the website — those live on invoices and finance
// documents only.
//
// Source priority for each field:
//   1. LegalEntity.publicEmail / publicPhone / publicWhatsapp / publicAddressLine / socialInstagram
//   2. NEXT_PUBLIC_NEEJEE_PUBLIC_EMAIL / _PHONE env vars (optional override)
//   3. Hard-coded fallback so the UI never breaks
//
// Used by Footer, Contact page, About page.

import { prisma } from '@/lib/prisma';

export interface PublicContact {
  email: string;
  phone: string;        // display format e.g. "+91 98765 12345"
  phoneE164: string;    // "919876512345" for tel/wa links
  whatsappUrl: string;  // wa.me URL
  telUrl: string;
  mailUrl: string;
  brandName: string;
  legalName: string;
  tagline: string;
  address: string;     // public display address (optional, separate from registered office)
  socialInstagram: string;
}

const FALLBACK_EMAIL = 'hello@neejee.com';
const FALLBACK_PHONE = '+91 98765 12345';
const FALLBACK_E164  = '919876512345';

function toE164(phone: string | null | undefined): string {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  return digits;
}

function formatIndianPhone(e164: string, raw: string): string {
  if (!e164) return raw || '';
  if (e164.length === 12 && e164.startsWith('91')) {
    return `+91 ${e164.slice(2, 7)} ${e164.slice(7)}`;
  }
  return raw || `+${e164}`;
}

export async function getPublicContact(): Promise<PublicContact> {
  let entity: any = null;
  try {
    entity = await prisma.legalEntity.findUnique({ where: { key: 'default' } });
  } catch { /* fresh install — fallbacks below */ }

  const env = process.env;

  const email =
       entity?.publicEmail
    || env.NEXT_PUBLIC_NEEJEE_PUBLIC_EMAIL
    || FALLBACK_EMAIL;

  const phoneRaw =
       entity?.publicPhone
    || env.NEXT_PUBLIC_NEEJEE_PUBLIC_PHONE
    || FALLBACK_PHONE;

  const whatsappRaw =
       entity?.publicWhatsapp
    || entity?.publicPhone
    || env.NEXT_PUBLIC_NEEJEE_PUBLIC_WHATSAPP
    || env.NEXT_PUBLIC_NEEJEE_PUBLIC_PHONE
    || FALLBACK_PHONE;

  const phoneE164    = toE164(phoneRaw) || FALLBACK_E164;
  const whatsappE164 = toE164(whatsappRaw) || phoneE164;

  const phoneDisplay = formatIndianPhone(phoneE164, phoneRaw);

  const brandName = entity?.brandName || 'NEEJEE';
  const legalName = entity?.legalName || 'NEEJEE';
  const tagline   = 'Found. Personal.';

  const address = entity?.publicAddressLine || '';

  const socialInstagram =
       entity?.socialInstagram
    || env.NEXT_PUBLIC_INSTAGRAM_URL
    || 'https://instagram.com/neejee';

  return {
    email,
    phone: phoneDisplay,
    phoneE164,
    whatsappUrl: `https://wa.me/${whatsappE164}`,
    telUrl: `tel:+${phoneE164}`,
    mailUrl: `mailto:${email}`,
    brandName,
    legalName,
    tagline,
    address,
    socialInstagram,
  };
}
