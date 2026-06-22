// v23.40.11 — Customer find-or-create helper.
// Mirrors lib/finance/auto-vendor.ts but for the AR side.
//
// Used by:
//   - POST /api/admin/finance/sales-invoices  (when creating a manual invoice)
//   - POST /api/admin/finance/sales-invoices/post-order  (when posting an order)
//   - Customer-link backfill
//
// Match priority: customerId (explicit) → primaryPhone → primaryEmail → displayName (case-insensitive).
// If no match, creates a new Customer row with status=ACTIVE.

import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';

export type CustomerResolution =
  | { vendorId?: never; customerId: string; matchedExisting: true;  matchedBy: 'id' | 'phone' | 'email' | 'name' }
  | { vendorId?: never; customerId: string; matchedExisting: false; matchedBy: 'created' };

export interface FindOrCreateCustomerInput {
  customerId?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  gstin?: string | null;
  userId?: string | null;
  channel?: string | null;       // POS | WEBSITE | BULK | WHATSAPP
  customerType?: string | null;  // INDIVIDUAL | B2B | WHOLESALE
  source?: string;               // MANUAL | AUTO_POS | AUTO_ORDER | IMPORT
  createdByUserId?: string | null;
}

export async function findOrCreateCustomer(input: FindOrCreateCustomerInput): Promise<CustomerResolution | null> {
  const {
    customerId, name, email, phone, gstin, userId,
    channel, customerType, source, createdByUserId,
  } = input;

  // 1. Explicit customerId wins
  if (customerId) {
    const c = await prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } });
    if (c) return { customerId: c.id, matchedExisting: true, matchedBy: 'id' };
  }

  // Without at least a name or phone or email, we can't responsibly create a customer.
  if (!name?.trim() && !phone?.trim() && !email?.trim() && !userId) return null;

  // 2. Phone match (most reliable in India)
  if (phone?.trim()) {
    const c = await prisma.customer.findUnique({ where: { primaryPhone: phone.trim() }, select: { id: true } });
    if (c) return { customerId: c.id, matchedExisting: true, matchedBy: 'phone' };
  }

  // 3. Email match
  if (email?.trim()) {
    const c = await prisma.customer.findUnique({ where: { primaryEmail: email.trim().toLowerCase() }, select: { id: true } });
    if (c) return { customerId: c.id, matchedExisting: true, matchedBy: 'email' };
  }

  // 4. userId match (if user signed up after first purchase)
  if (userId) {
    const c = await prisma.customer.findUnique({ where: { userId }, select: { id: true } });
    if (c) return { customerId: c.id, matchedExisting: true, matchedBy: 'id' };
  }

  // 5. Name match (case-insensitive)
  if (name?.trim()) {
    const c = await prisma.customer.findFirst({
      where: { displayName: { equals: name.trim(), mode: 'insensitive' } },
      select: { id: true },
    });
    if (c) return { customerId: c.id, matchedExisting: true, matchedBy: 'name' };
  }

  // 6. Create new
  const displayName = name?.trim() || phone?.trim() || email?.trim() || 'Unknown customer';
  const id = 'cust_' + randomBytes(10).toString('hex');

  const created = await prisma.customer.create({
    data: {
      id,
      displayName,
      primaryEmail: email?.trim().toLowerCase() || null,
      primaryPhone: phone?.trim() || null,
      gstin: gstin?.trim() || null,
      userId: userId || null,
      channel: channel || (gstin ? 'BULK' : 'POS'),
      customerType: customerType || (gstin ? 'B2B' : 'INDIVIDUAL'),
      source: source || 'AUTO_POS',
      createdByUserId: createdByUserId || null,
      notes: '[Auto-created from finance booking]',
    },
  });

  return { customerId: created.id, matchedExisting: false, matchedBy: 'created' };
}
