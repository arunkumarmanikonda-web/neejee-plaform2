import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { prisma } from '../../lib/prisma';
import { inviteMember, acceptInvitation } from '../../lib/team-invitations';
import { createMagicTokenForVendor, consumeMagicToken } from '../../lib/vendor-auth';
import { resolveVendorForSession } from '../../lib/vendor-auth-helpers';

const localDb = process.env.DATABASE_URL && ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(process.env.DATABASE_URL).hostname);
test('team invitations, reissue, password setup and vendor recovery preserve the intended account', { skip: !localDb }, async () => {
  const prefix = randomUUID();
  const address = (label: string) => prefix + '-' + label + '@example.invalid';
  const originalFetch = global.fetch;
  const originalKey = process.env.RESEND_API_KEY;
  let lastToken = '';
  process.env.RESEND_API_KEY = 'local-fixture';
  global.fetch = async (input, init) => {
    if (String(input) !== 'https://api.resend.com/emails') throw new Error('Unexpected fixture transport');
    const mail = JSON.parse(String(init?.body));
    assert.ok(mail.to[0].endsWith('@example.invalid'));
    lastToken = mail.html.match(/team-invitation#([^"]+)/)[1];
    return Response.json({ id: 'local-fixture' });
  };
  try {
    const seller = await prisma.seller.create({ data: { businessName: 'Fixture', contactName: 'Fixture', email: address('seller'), phone: '0000000000', kycStatus: 'APPROVED' } });
    const vendor = await prisma.vendor.create({ data: { legalName: 'Fixture', contactEmail: address('vendor'), status: 'ACTIVE' } });
    for (const kind of ['seller', 'vendor'] as const) {
      const studio = kind === 'seller' ? seller.id : vendor.id;
      const email = address(kind + '-member');
      const form = { email, accessLevel: 'FINANCE_ONLY' };
      const member = await inviteMember(kind, studio, 'fixture-owner', form);
      const first = lastToken;
      await inviteMember(kind, studio, 'fixture-owner', form);
      await assert.rejects(acceptInvitation(first, 'fixture-password'));
      await assert.rejects(acceptInvitation(lastToken, ''));
      const accepted = await acceptInvitation(lastToken, 'fixture-password');
      assert.equal(accepted.id, member.userId);
      assert.equal(accepted.role, kind === 'seller' ? 'SELLER_STAFF' : 'VENDOR_STAFF');
      await assert.rejects(acceptInvitation(lastToken, 'fixture-password'));
      if (kind === 'vendor') {
        const binding = { type: 'member' as const, email, memberId: member.id, userId: member.userId };
        const link = await createMagicTokenForVendor(studio, binding);
        const recovery = await consumeMagicToken(link.token);
        assert.equal(recovery?.user.id, member.userId);
        assert.equal((await resolveVendorForSession(accepted))?.accessLevel, 'FINANCE_ONLY');
        assert.equal(await consumeMagicToken(link.token), null);
        const ownerLink = await createMagicTokenForVendor(studio, { type: 'owner', email: vendor.contactEmail });
        assert.equal((await consumeMagicToken(ownerLink.token))?.user.email, vendor.contactEmail);
      }
    }
  } finally {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalKey;
    await prisma.vendor.deleteMany({ where: { contactEmail: address('vendor') } });
    await prisma.seller.deleteMany({ where: { email: address('seller') } });
    await prisma.user.deleteMany({ where: { email: { startsWith: prefix + '-' } } });
    await prisma.$disconnect();
  }
});
