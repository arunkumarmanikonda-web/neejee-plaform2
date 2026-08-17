import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';
import { normalizePhone } from '@/lib/otp';

const PENDING_DOCUMENT_TTL_HOURS = 48;

export function sellerApplicantHash(phone: string) {
  const normalized = normalizePhone(phone) || String(phone || '').trim();
  return createHash('sha256').update(normalized).digest('hex').slice(0, 24);
}

export async function registerPendingSellerDocument(phone: string, storageKey: string) {
  const applicantHash = sellerApplicantHash(phone);
  const expiresAt = new Date(Date.now() + PENDING_DOCUMENT_TTL_HOURS * 60 * 60 * 1000);
  const rows = await prisma.$queryRaw<Array<{ id: string; expiresAt: Date }>>`
    insert into private.seller_pending_document (applicant_hash, storage_key, expires_at)
    values (${applicantHash}, ${storageKey}, ${expiresAt})
    returning id::text as id, expires_at as "expiresAt"
  `;
  const row = rows[0];
  if (!row?.id) throw new Error('Unable to register pending seller document');
  return row;
}

export async function pendingSellerDocumentIsActive(input: {
  pendingId: string;
  phone: string;
  storageKey: string;
}) {
  const applicantHash = sellerApplicantHash(input.phone);
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    select id::text as id
    from private.seller_pending_document
    where id = ${input.pendingId}::uuid
      and applicant_hash = ${applicantHash}
      and storage_key = ${input.storageKey}
      and consumed_at is null
      and expires_at > now()
    limit 1
  `;
  return Boolean(rows[0]?.id);
}

export async function consumePendingSellerDocument(pendingId: string) {
  await prisma.$executeRaw`
    update private.seller_pending_document
    set consumed_at = now()
    where id = ${pendingId}::uuid
      and consumed_at is null
  `;
}

export async function listExpiredPendingSellerDocuments(limit = 100) {
  const safeLimit = Math.max(1, Math.min(500, Math.floor(limit)));
  return prisma.$queryRaw<Array<{
    id: string;
    storageKey: string;
    expiresAt: Date;
  }>>`
    select id::text as id,
           storage_key as "storageKey",
           expires_at as "expiresAt"
    from private.seller_pending_document
    where consumed_at is null
      and expires_at <= now()
    order by expires_at asc
    limit ${safeLimit}
  `;
}

export async function deletePendingSellerDocumentRecord(pendingId: string) {
  await prisma.$executeRaw`
    delete from private.seller_pending_document
    where id = ${pendingId}::uuid
  `;
}

export async function purgeConsumedPendingSellerDocumentRecords(days = 30) {
  const cutoff = new Date(Date.now() - Math.max(1, days) * 24 * 60 * 60 * 1000);
  const affected = await prisma.$executeRaw`
    delete from private.seller_pending_document
    where consumed_at is not null
      and consumed_at < ${cutoff}
  `;
  return Number(affected || 0);
}

export const PENDING_SELLER_DOCUMENT_TTL_HOURS = PENDING_DOCUMENT_TTL_HOURS;
