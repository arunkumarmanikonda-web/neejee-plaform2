import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const origin = process.env.NEEJEE_LOCAL_COD_TEST_URL;
test('a lost or concurrent COD response produces one order, address and inventory debit', { skip: !origin }, async () => {
  const local = (url: string) => ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(url).hostname);
  assert.ok(local(origin!) && local(process.env.DATABASE_URL!), 'use a disposable local database and server');
  const prisma = new PrismaClient();
  const prefix = 'cod-fixture-' + randomUUID();
  const email = prefix + '@example.test';
  const key = randomUUID();
  const address = { name: prefix, line1: 'Fixture lane', city: 'Jaipur', state: 'Rajasthan', pincode: '302001', country: 'India' };
  const contact = { email, phone: '9000000000' };
  const submit = async (payload: object, token?: string) => {
    const response = await fetch(origin + '/api/checkout', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { 'Idempotency-Key': token } : {}) }, body: JSON.stringify(payload),
    });
    return { status: response.status, data: await response.json() };
  };
  try {
    const category = await prisma.category.create({ data: { slug: prefix, name: 'Fixture category' } });
    const products = await Promise.all([0,1].map(i => prisma.product.create({
      data: { slug: prefix + i, sku: prefix + i, name: 'Fixture piece', categoryId: category.id, status: 'ACTIVE', mrp: 5000,
        sellingPrice: 5000, codEligible: true, variants: { create: { sku: prefix + '-v' + i, inventory: 2 } } },
      include: { variants: true },
    })));
    const payload = (i: number) => ({ payment: 'COD', contact, address, shipping: 'STANDARD',
      items: [{ productId: products[i].id, variantId: products[i].variants[0].id, quantity: 2 }] });
    const same = payload(0);
    const concurrent = await Promise.all([submit(same, key), submit(same, key), submit(same, key)]);
    for (const response of concurrent) assert.equal(response.status, 200, JSON.stringify(response.data));
    const receipt = concurrent[0].data;
    assert.ok(receipt.orderNumber);
    assert.equal(new Set(concurrent.map(r => r.data.orderId)).size, 1);
    assert.equal((await submit(same, key)).data.orderId, receipt.orderId);
    assert.equal((await submit({ ...same, personalNote: 'Different order' }, key)).status, 409);
    assert.equal(await prisma.order.count({ where: { guestEmail: email } }), 1);
    assert.equal(await prisma.address.count({ where: { name: prefix } }), 1);
    assert.equal((await prisma.variant.findUniqueOrThrow({ where: { id: products[0].variants[0].id } })).inventory, 0);
    const recover = await fetch(origin + '/api/checkout/cod-receipt', { headers: { 'Idempotency-Key': key } });
    assert.deepEqual(await recover.json(), { found: true, orderNumber: receipt.orderNumber });
    assert.equal((await fetch(origin + '/api/checkout/cod-receipt', { headers: { 'Idempotency-Key': randomUUID() } })).status, 404);
    assert.equal((await submit(payload(1), 'invalid')).status, 400);
    assert.equal((await submit(payload(1))).status, 200);
    assert.equal(await prisma.order.count({ where: { guestEmail: email } }), 2);
  } finally {
    // All rows are confined to the unique synthetic customer and catalog set.
    await prisma.order.deleteMany({ where: { guestEmail: email } });
    await prisma.address.deleteMany({ where: { name: prefix } });
    await prisma.variant.deleteMany({ where: { sku: { startsWith: prefix } } });
    await prisma.product.deleteMany({ where: { sku: { startsWith: prefix } } });
    await prisma.category.deleteMany({ where: { slug: prefix } });
    await prisma.$disconnect();
  }
});
