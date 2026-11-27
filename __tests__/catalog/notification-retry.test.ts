import test from 'node:test';
import assert from 'node:assert/strict';
import { retryOrderDispatch } from '../../lib/notifications/retry-worker';
import { RETRY_NO_CONFIG, RETRY_RATE_LIMIT, retryAfterMs, retryTime } from '../../lib/notifications/retry-policy';

test('only a definitively unsent order notification receives bounded backoff', () => {
  assert.equal(retryTime('ORDER_SHIPPED',RETRY_RATE_LIMIT,1,3,0)?.getTime(),300_000);
  assert.equal(retryTime('ORDER_SHIPPED',RETRY_RATE_LIMIT,2,3,0)?.getTime(),1_500_000);
  assert.equal(retryTime('ORDER_SHIPPED',RETRY_RATE_LIMIT,2,3,0,3_000_000)?.getTime(),3_000_000);
  assert.equal(retryTime('ORDER_SHIPPED',RETRY_RATE_LIMIT,3,3,0),null);
  assert.equal(retryTime('OTP_LOGIN',RETRY_RATE_LIMIT,1,3,0),null);
  assert.equal(retryTime('CART_T1H',RETRY_NO_CONFIG,1,3,0),null);
  assert.equal(retryTime('ORDER_SHIPPED',undefined,1,3,0),null);
  assert.equal(retryAfterMs('120',0),120000);
  assert.equal(retryAfterMs('Thu, 01 Jan 1970 00:02:00 GMT',0),120000);
});

function fixture() {
  let row:any = {id:'notice',orderId:'ord',status:'failed',event:'ORDER_SHIPPED',attempt:1,maxAttempts:3,channel:'SMS',
    templateName:'template',recipient:'test',payloadJson:{},createdAt:new Date(),nextRetryAt:new Date(1),
    errorMessage:RETRY_RATE_LIMIT,providerRequestId:null};
  let orderStatus='SHIPPED';
  let sends=0;
  let response:any={ok:true,providerRequestId:'receipt'};
  let throwAfterAcceptance=false;
  const db:any = {
    order:{findUnique:async()=>({status:orderStatus})},
    notificationDispatch:{
      findUnique:async()=>({...row}),
      updateMany:async({where,data}:any)=>{
        if(!Object.entries(where).every(([k,v])=>row[k]===v)) return {count:0};
        if (throwAfterAcceptance && data.status==='sent') throw new Error('database offline');
        row={...row,...data};return {count:1};
      },
    },
  };
  const adapters:any={SMS:{isConfigured:()=>true,send:async()=>{sends++;return response;}}};
  return {run:()=>retryOrderDispatch('notice',db,adapters),state:()=>row,count:()=>sends,
    change:(v:object)=>{row={...row,...v}},respond:(v:object)=>{response=v},
    advanceOrder:()=>{orderStatus='DELIVERED'},loseAcknowledgement:()=>{throwAfterAcceptance=true}};
}

test('overlapping workers claim one attempt and call the provider once', async () => {
  const w=fixture();
  const outcomes=await Promise.all([w.run(),w.run(),w.run()]);
  assert.equal(w.count(),1);
  assert.equal(outcomes.filter(r=>r.ok).length,1);
  assert.equal(w.state().status,'sent');
  assert.equal(w.state().attempt,2);
});

test('a lost acknowledgement, ambiguous delivery or existing receipt cannot be auto-replayed',async()=>{
  const accepted=fixture();accepted.loseAcknowledgement();
  await assert.rejects(accepted.run(),/database offline/);
  await accepted.run();
  assert.equal(accepted.count(),1);
  assert.equal(accepted.state().nextRetryAt,null);
  const timeout=fixture();timeout.respond({ok:false,errorMessage:'network timeout'});
  await timeout.run();await timeout.run();
  assert.equal(timeout.count(),1);assert.equal(timeout.state().nextRetryAt,null);
  const recorded=fixture();recorded.change({providerRequestId:'existing-receipt'});
  await recorded.run();assert.equal(recorded.count(),0);
});

test('respect scheduling, changed order status and the attempt ceiling',async()=>{
  const w=fixture();w.respond({ok:false,rateLimited:true,errorMessage:'rate limited'});
  const started=Date.now();
  await w.run();assert.ok(w.state().nextRetryAt.getTime()>=started+25*60_000);
  await w.run();assert.equal(w.count(),1);
  w.change({nextRetryAt:new Date(1)});
  await w.run();assert.equal(w.count(),2);assert.equal(w.state().nextRetryAt,null);
  const moved=fixture();moved.advanceOrder();await moved.run();
  assert.equal(moved.count(),0);assert.equal(moved.state().nextRetryAt,null);
});
