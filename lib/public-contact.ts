// Public-facing contact info sourced only from approved public LegalEntity fields
// or explicit NEXT_PUBLIC_NEEJEE_PUBLIC_* overrides. Private signatory contacts
// are never exposed. Missing phone/social fields stay empty rather than falling
// back to invented customer-facing details.
import { prisma } from '@/lib/prisma';

export interface PublicContact {
  email: string;
  phone: string;
  phoneE164: string;
  whatsappUrl: string;
  telUrl: string;
  mailUrl: string;
  brandName: string;
  legalName: string;
  tagline: string;
  address: string;
  socialInstagram: string;
}

const FALLBACK_EMAIL = 'hello@neejee.com';

function toE164(phone: string | null | undefined): string {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  return digits;
}

function formatIndianPhone(e164: string, raw: string): string {
  if (!e164) return '';
  if (e164.length === 12 && e164.startsWith('91')) {
    return `+91 ${e164.slice(2, 7)} ${e164.slice(7)}`;
  }
  return raw || `+${e164}`;
}

export async function getPublicContact(): Promise<PublicContact> {
  let entity: any = null;
  try {
    entity = await prisma.legalEntity.findUnique({ where: { key: 'default' } });
  } catch {}

  const env = process.env;
  const email = String(
    entity?.publicEmail || env.NEXT_PUBLIC_NEEJEE_PUBLIC_EMAIL || FALLBACK_EMAIL,
  ).trim();

  const phoneRaw = String(
    entity?.publicPhone || env.NEXT_PUBLIC_NEEJEE_PUBLIC_PHONE || '',
  ).trim();
  const whatsappRaw = String(
    entity?.publicWhatsapp ||
    entity?.publicPhone ||
    env.NEXT_PUBLIC_NEEJEE_PUBLIC_WHATSAPP ||
    env.NEXT_PUBLIC_NEEJEE_PUBLIC_PHONE ||
    '',
  ).trim();

  const phoneE164 = toE164(phoneRaw);
  const whatsappE164 = toE164(whatsappRaw);
  const phoneDisplay = formatIndianPhone(phoneE164, phoneRaw);

  const brandName = entity?.brandName || 'NEEJEE';
  const legalName = entity?.legalName || 'NEEJEE';
  const tagline = 'Found. Personal.';
  const address = entity?.publicAddressLine || '';
  const socialInstagram = String(
    entity?.socialInstagram || env.NEXT_PUBLIC_INSTAGRAM_URL || '',
  ).trim();

  return {
    email,
    phone: phoneDisplay,
    phoneE164,
    whatsappUrl: whatsappE164 ? `https://wa.me/${whatsappE164}` : '',
    telUrl: phoneE164 ? `tel:+${phoneE164}` : '',
    mailUrl: email ? `mailto:${email}` : '',
    brandName,
    legalName,
    tagline,
    address,
    socialInstagram,
  };
}
