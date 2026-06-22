// v23.40.4 — Auto find-or-create a Vendor row from finance flows.
// Called from Bill/Expense POST when the user types a vendor name but doesn't pick
// an existing vendor. Avoids hundreds of duplicate "Reliance Jio" rows by
// normalising the name (lowercase, collapsed whitespace) before matching.

import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';

function normaliseName(n: string): string {
  return n.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Returns the `vendorId` for the given vendor name.
 * - If `vendorId` is already provided, returns it as-is.
 * - Else if `name` matches an existing vendor (case-insensitive, trimmed), returns that vendor's id.
 * - Else creates a new Vendor (status ACTIVE) and returns its id.
 *
 * Pass `null` or empty name to skip (returns null).
 */
export async function findOrCreateVendor(
  vendorId: string | null | undefined,
  name: string | null | undefined,
  opts?: {
    contactEmail?: string | null;
    contactPhone?: string | null;
    gstin?: string | null;
    createdByUserId?: string | null;
    // v23.40.8 — category hint at creation time, e.g. derived from the ExpenseCategory.group
    serviceCategoryGroup?: string | null;
    defaultExpenseCategoryId?: string | null;
  }
): Promise<{ vendorId: string | null; created: boolean; matchedExisting: boolean }> {
  // Caller already linked an existing vendor — nothing to do.
  if (vendorId) return { vendorId, created: false, matchedExisting: true };

  const cleaned = (name || '').trim();
  if (!cleaned) return { vendorId: null, created: false, matchedExisting: false };

  const wanted = normaliseName(cleaned);

  // Try exact (case-insensitive) match on legalName or displayName.
  const candidates = await prisma.vendor.findMany({
    where: {
      OR: [
        { legalName:   { equals: cleaned, mode: 'insensitive' } },
        { displayName: { equals: cleaned, mode: 'insensitive' } },
      ],
    },
    select: { id: true, legalName: true, displayName: true },
    take: 5,
  });
  for (const c of candidates) {
    if (normaliseName(c.legalName) === wanted) return { vendorId: c.id, created: false, matchedExisting: true };
    if (c.displayName && normaliseName(c.displayName) === wanted) return { vendorId: c.id, created: false, matchedExisting: true };
  }

  // No match — auto-create a lightweight Vendor row.
  // contactEmail is unique + required, so synthesise one for unknown payees.
  let email = opts?.contactEmail?.trim() || '';
  if (!email) {
    const slug = wanted.replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'vendor';
    email = `unknown+${slug}-${Date.now()}@neejee.local`;
  } else {
    // If email collides, fall back to suffixing
    const exists = await prisma.vendor.findUnique({ where: { contactEmail: email.toLowerCase() }, select: { id: true } });
    if (exists) email = `${email.split('@')[0]}+${Date.now()}@${email.split('@')[1] || 'neejee.local'}`;
  }

  const created = await prisma.vendor.create({
    data: {
      id: 'vnd_' + randomBytes(8).toString('hex'),
      legalName: cleaned,
      displayName: cleaned,
      contactEmail: email.toLowerCase(),
      contactPhone: opts?.contactPhone || null,
      gstin: opts?.gstin || null,
      status: 'ACTIVE',
      paymentTermsDays: 30,
      serviceCategoryGroup:     opts?.serviceCategoryGroup || null,
      defaultExpenseCategoryId: opts?.defaultExpenseCategoryId || null,
      notes: 'Auto-created from finance booking (v23.40.4+).',
    },
  });

  return { vendorId: created.id, created: true, matchedExisting: false };
}
