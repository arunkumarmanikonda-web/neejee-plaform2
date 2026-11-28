import assert from 'node:assert/strict';
import { test } from 'node:test';
import Module from 'node:module';

test('courier callbacks keep terminal orders closed, accept duplicates and retry a conflicting database update', async t => {
  let orderStatus = 'CANCELLED', carrierStatus = 'IN TRANSIT', writes = 0, messages = 0, race = false, fail = false;
  const order = {
    async findUnique() { messages++; return null; },
    async findFirst() { if (fail) throw new Error('test unavailable'); return {id:'fixture',status:orderStatus,awbNumber:'AWB1'}; },
    async updateMany({where,data}: any) {
      assert.equal(where.status,orderStatus);
      assert.equal(where.awbNumber,'AWB1');
      if (race) return {count:0};
      writes++; orderStatus=data.status; return {count:1};
    },
  };
  const replacements: Record<string, unknown> = {
    '@/lib/prisma': {prisma:{order}},
    '@/lib/webhooks/auth': {verifyShiprocketWebhook:()=>true,webhookSecretConfigured:()=>true},
  };
  const prototype = Module.prototype as unknown as {require:(id:string)=>any};
  const original = prototype.require;
  t.mock.method(prototype,'require',function(this:Module,id:string) {
    return Object.hasOwn(replacements,id) ? replacements[id] : original.call(this,id);
  });
  const {POST} = require('../../app/api/webhooks/shiprocket/route');
  const submit = () => POST(new Request('https://example.test', {method:'POST',body:JSON.stringify({awb:'AWB1',current_status:carrierStatus})}));
  for (orderStatus of ['CANCELLED','RETURNED','REFUNDED','CANCELLED_BUG','DELIVERED']) await submit();
  assert.equal(writes,0);
  orderStatus='PACKED'; race=true;
  assert.equal((await submit()).status,503);
  assert.equal(messages,0);
  race=false;
  assert.equal((await submit()).status,200);
  assert.equal(orderStatus,'SHIPPED');
  await submit();
  assert.equal(writes,1);
  carrierStatus='DELIVERED'; await submit();
  assert.equal(orderStatus,'DELIVERED');
  carrierStatus='CANCELED'; await submit();
  assert.equal(writes,2);
  assert.equal(messages,2);
  fail=true;
  assert.equal((await submit()).status,503);
});
