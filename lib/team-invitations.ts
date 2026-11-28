import { createHmac } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { z } from 'zod';
import { prisma } from './prisma';
import { hashPassword } from './auth';
import { sendEmail } from './email';
import { storeOrigin } from './store-origin';

const sellerLevels = z.enum(['FULL', 'FINANCE_ONLY', 'INVENTORY_ONLY']);
const vendorLevels = z.enum(['FULL', 'FINANCE_ONLY', 'OPERATIONS_ONLY']);
const claims = z.object({
  kind: z.enum(['seller', 'vendor']), studio: z.string(), member: z.string(),
  sub: z.string(), email: z.string().email(), invited: z.number().int(),
});
type Kind = 'seller' | 'vendor';
export class InvitationError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
function signingKey() {
  const key = process.env.AUTH_SECRET;
  if (!key || key.length < 32) throw new Error('Team invitations require AUTH_SECRET');
  return createHmac('sha256', key).update('neejee/team-invitations/v1').digest();
}
function unavailable() { return new InvitationError('This invitation has expired or changed. Ask the owner for a fresh invitation.', 410); }

export async function inviteMember(kind: Kind, studio: string, actor: string, body: Record<string, unknown>) {
  const email = String(body.email || '').trim().toLowerCase();
  const displayName = String(body.displayName || '').trim().slice(0, 100) || null;
  const level = String(body.accessLevel || (kind === 'seller' ? 'INVENTORY_ONLY' : 'FULL'));
  if (!z.string().email().safeParse(email).success) throw new InvitationError('Enter a valid email address.');
  if (!(kind === 'seller' ? sellerLevels : vendorLevels).safeParse(level).success) throw new InvitationError('Choose a valid access level.');
  const key = signingKey();
  const role = kind === 'seller' ? 'SELLER_STAFF' : 'VENDOR_STAFF';
  const member = await prisma.$transaction(async tx => {
    const user = await tx.user.upsert({ where: { email }, create: { email, name: displayName }, update: {} });
    if (user.role !== 'CUSTOMER' && user.role !== role) throw new InvitationError('This address belongs to a different account role.', 409);
    const where = { userId: user.id };
    const common = { email, displayName, invitedByUserId: actor, invitedAt: new Date(), acceptedAt: null, status: 'INVITED' as const };
    if (kind === 'seller') {
      const existing = await tx.sellerTeamMember.findUnique({ where });
      if (existing && (existing.sellerId !== studio || !['REMOVED', 'INVITED'].includes(existing.status))) throw new InvitationError('This person already has a team membership.', 409);
      const data = { ...common, accessLevel: sellerLevels.parse(level) };
      return tx.sellerTeamMember.upsert({ where, create: { ...data, sellerId: studio, userId: user.id }, update: data });
    }
    const existing = await tx.vendorTeamMember.findUnique({ where });
    if (existing && (existing.vendorId !== studio || !['REMOVED', 'INVITED'].includes(existing.status))) throw new InvitationError('This person already has a team membership.', 409);
    const data = { ...common, accessLevel: vendorLevels.parse(level) };
    return tx.vendorTeamMember.upsert({ where, create: { ...data, vendorId: studio, userId: user.id }, update: data });
  }, { isolationLevel: 'Serializable' });
  const token = await new SignJWT({ kind, studio, member: member.id, email, invited: member.invitedAt.getTime() })
    .setSubject(member.userId).setAudience('team-acceptance').setIssuer('neejee').setIssuedAt().setExpirationTime('7d')
    .setProtectedHeader({ alg: 'HS256' }).sign(key);
  const url = storeOrigin() + '/team-invitation#' + token;
  const sent = await sendEmail({ to: email, subject: 'Your NEEJEE ' + kind + ' team invitation',
    html: '<p>You have been invited to the NEEJEE ' + kind + ' team. This personal invitation is valid for seven days.</p><p><a href="' + url + '">Accept team invitation</a></p>' });
  if (!sent.ok || sent.dev) throw new InvitationError('The invitation is pending. Email delivery failed. Submit the address again to resend.', 503);
  return member;
}

export async function acceptInvitation(token: string, password: string) {
  const key = signingKey();
  const verified = await jwtVerify(token, key, { algorithms: ['HS256'], issuer: 'neejee', audience: 'team-acceptance' }).catch(() => null);
  const parsed = claims.safeParse(verified?.payload);
  if (!parsed.success) throw unavailable();
  const c = parsed.data;
  const role = c.kind === 'seller' ? 'SELLER_STAFF' : 'VENDOR_STAFF';
  const identity = { id: c.sub, email: c.email };
  const user = await prisma.user.findFirst({ where: identity });
  if (!user || (user.role !== 'CUSTOMER' && user.role !== role)) throw unavailable();
  const needsPassword = !user.passwordHash;
  if (needsPassword && (password.length < 8 || Buffer.byteLength(password) > 72)) {
    throw new InvitationError('Choose a password of at least eight characters and at most 72 bytes.', 422);
  }
  const passwordHash = needsPassword ? await hashPassword(password) : undefined;
  return prisma.$transaction(async tx => {
    const match = { id: c.member, userId: c.sub, email: c.email, invitedAt: new Date(c.invited), status: 'INVITED' as const };
    const data = { status: 'ACTIVE' as const, acceptedAt: new Date() };
    const changed = c.kind === 'seller'
      ? await tx.sellerTeamMember.updateMany({ where: { ...match, sellerId: c.studio, seller: { kycStatus: 'APPROVED' } }, data })
      : await tx.vendorTeamMember.updateMany({ where: { ...match, vendorId: c.studio, vendor: { status: { notIn: ['SUSPENDED','ARCHIVED'] } } }, data });
    if (changed.count !== 1) throw unavailable();
    const promoted = await tx.user.updateMany({ where: { ...identity, role: user.role, passwordHash: user.passwordHash },
      data: { role, passwordHash, emailVerified: user.emailVerified || new Date() } });
    if (promoted.count !== 1) throw unavailable();
    return { id: user.id, email: c.email, name: user.name || undefined, role, kind: c.kind } as const;
  });
}
