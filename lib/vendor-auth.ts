import { createHash, randomBytes } from 'node:crypto';
import { prisma } from './prisma';
import { z } from 'zod';

const binding = z.discriminatedUnion('type', [
  z.object({ type: z.literal('owner'), email: z.string().email() }),
  z.object({ type: z.literal('member'), email: z.string().email(), memberId: z.string(), userId: z.string() }),
]);
type Binding = z.infer<typeof binding>;
const digest = (token: string) => createHash('sha256').update(token).digest('hex');

export async function createMagicTokenForVendor(vendorId: string, recipient: Binding) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await prisma.vendorMagicToken.create({ data: { vendorId, purpose: JSON.stringify(recipient), tokenHash: digest(token), expiresAt } });
  return { token, expiresAt };
}

export async function consumeMagicToken(token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  return prisma.$transaction(async tx => {
    const where = { tokenHash: digest(token), consumedAt: null, expiresAt: { gt: new Date() } };
    const row = await tx.vendorMagicToken.findFirst({ where, include: { vendor: true } });
    if (!row || ['ARCHIVED', 'SUSPENDED'].includes(row.vendor.status)) return null;
    const parsed = binding.safeParse(JSON.parse(row.purpose));
    if (!parsed.success) return null;
    const recipient = parsed.data;
    const vendor = row.vendor;
    const claimed = await tx.vendorMagicToken.updateMany({ where: { ...where, id: row.id }, data: { consumedAt: new Date() } });
    if (claimed.count !== 1) return null;
    if (recipient.type === 'member') {
      const member = await tx.vendorTeamMember.findFirst({ where: {
        id: recipient.memberId, vendorId: vendor.id, email: recipient.email, userId: recipient.userId,
        status: 'ACTIVE', user: { role: 'VENDOR_STAFF', email: recipient.email },
      }, include: { user: true } });
      return member ? { user: member.user, vendorId: vendor.id } : null;
    }
    if (vendor.contactEmail.trim().toLowerCase() !== recipient.email) return null;
    const existing = await tx.user.findUnique({ where: { email: recipient.email }, include: { vendor: { select: { id: true } } } });
    if ((existing && !['CUSTOMER', 'VENDOR'].includes(existing.role)) || (existing?.vendor && existing.vendor.id !== vendor.id)
      || (vendor.userId && vendor.userId !== existing?.id)) return null;
    const user = existing
      ? await tx.user.update({ where: { id: existing.id, role: existing.role }, data: { role: 'VENDOR', emailVerified: existing.emailVerified || new Date() } })
      : await tx.user.create({ data: { email: recipient.email, name: vendor.contactPerson || vendor.legalName, role: 'VENDOR', emailVerified: new Date() } });
    const linked = await tx.vendor.updateMany({ where: { id: vendor.id, userId: vendor.userId, status: vendor.status, contactEmail: vendor.contactEmail },
      data: { userId: user.id, status: vendor.status === 'PENDING' ? 'ACTIVE' : vendor.status } });
    if (linked.count !== 1) throw new Error('Vendor contact changed during sign-in');
    return { user, vendorId: vendor.id };
  });
}
