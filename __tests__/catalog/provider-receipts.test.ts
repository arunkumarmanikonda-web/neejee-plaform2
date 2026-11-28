import assert from 'node:assert/strict';
import {test} from 'node:test';
import Module from 'node:module';
import {createHmac} from 'node:crypto';
import {fast2smsWebhook} from '../../lib/notifications/fast2sms-webhook';

test('SMS setup uses the store entity, preserves other callbacks and recognizes an existing subscription',async t=>{
  const keys = ['FAST2SMS_API_KEY','FAST2SMS_ENTITY_ID','FAST2SMS_WEBHOOK_SECRET'];
  const old = keys.map(k=>process.env[k]);
  t.after(()=>keys.forEach((k,i)=>{if(old[i]===undefined)delete process.env[k];else process.env[k]=old[i];}));
  Object.assign(process.env,{FAST2SMS_API_KEY:'example',FAST2SMS_ENTITY_ID:'entity1',FAST2SMS_WEBHOOK_SECRET:'x'.repeat(40)});
  const hooks:any[] = [{id:'elsewhere',name:'Unrelated callback',url:'https://example.org/old'}];
  let posts = 0;
  t.mock.method(globalThis,'fetch',async (_:unknown,init:RequestInit)=>{
    if(init.method !== 'POST') return Response.json({return:true,data:hooks});
    const body=JSON.parse(String(init.body));
    assert.equal(body.identity_id,'entity1');assert.equal(body.url,'https://www.neejee.com/api/webhooks/fast2sms');
    assert.equal(body.payload.mobile,undefined);assert.equal(body.header_value[0],process.env.FAST2SMS_WEBHOOK_SECRET);
    hooks.push({...body,id:'wh_example'});posts++;
    return Response.json({return:true,data:{id:'wh_example'}});
  });
  assert.equal((await fast2smsWebhook()).ok,undefined);
  assert.equal((await fast2smsWebhook(true)).ok,true);
  assert.equal((await fast2smsWebhook(true)).ok,true);
  hooks[1].identity_id='another';assert.equal((await fast2smsWebhook(true)).ok,false);
  assert.equal(posts,1);
});

test('delivery receipts preserve channel, terminal states and retryable DB errors; processed payouts can reverse',async t=>{
  const oldKeys=['FAST2SMS_WEBHOOK_SECRET','AISENSY_WEBHOOK_SECRET','RAZORPAYX_WEBHOOK_SECRET'];
  const old=oldKeys.map(k=>process.env[k]);
  const shared='x'.repeat(40); oldKeys.forEach(k=>process.env[k]=shared);
  t.after(()=>oldKeys.forEach((k,i)=>{if(old[i]===undefined)delete process.env[k];else process.env[k]=old[i];}));
  type Row = {channel:string;id:string;status:string;deliveredAt:Date|null;readAt:Date|null};
  const row=(channel:string,id:string):Row=>({channel,id,status:'sent',deliveredAt:null,readAt:null});
  const rows=[row('SMS','same'),row('WHATSAPP','same'),row('WHATSAPP','other')];
  let down=false;
  const payout={id:'fixture',status:'PAID',rzpxStatus:'processed',transactionRef:'ref',paidAt:new Date(),rzpxFailReason:null};
  const prisma={ notificationLog:{updateMany:async({where}:any)=>{assert.equal(where.channel,'SMS');return {count:0};}}, notificationDispatch:{updateMany:async({where,data}:any)=>{
    if(down) throw Error('offline');
    for(const v of rows)if(v.channel===where.channel && v.id===where.providerRequestId && where.status.in.includes(v.status)
      && (where.deliveredAt !== null || !v.deliveredAt))Object.assign(v,data);
    return {count:1};
  }},vendorPayout:{findFirst:async()=>({...payout}),updateMany:async({where,data}:any)=>{
    assert.equal(where.rzpxPayoutId,'pout_fixture');assert.equal(where.rzpxStatus,payout.rzpxStatus);Object.assign(payout,data);return {count:1};
  }}};
  const prototype=Module.prototype as unknown as {require:(id:string)=>any};
  const original=prototype.require;
  t.mock.method(prototype,'require',function(this:Module,id:string){return id==='@/lib/prisma'?{prisma}:original.call(this,id);});
  const sms=require('../../app/api/webhooks/fast2sms/route').POST;
  const whatsapp=require('../../app/api/webhooks/aisensy/route').POST;
  const payouts=require('../../app/api/webhooks/razorpayx/route').POST;
  const post=(action:any,body:any,header='x-neejee-webhook-token',key=shared)=>action(new Request('https://example.test',{method:'POST',headers:{[header]:key,'content-type':'application/json'},body:JSON.stringify(body)}));
  const report={request_id:'same',status:'UNDELIVERED'};
  assert.equal((await post(sms,report,'webhook_secret_key')).status,200);
  assert.deepEqual(rows.map(r=>r.status),['failed','sent','sent']);
  await post(sms,{request_id:'same',status:'sent'});assert.equal(rows[0].status,'failed');
  await post(whatsapp,{entry:[{changes:[{value:{statuses:[{id:'same',status:'delivered'},{id:'other',status:'read'}]}}]}]});
  const delivered=rows[1].deliveredAt;
  await post(whatsapp,{id:'same',status:'read'});await post(whatsapp,{id:'same',status:'sent'});
  assert.equal(rows[1].deliveredAt,delivered);assert.deepEqual(rows.map(r=>r.status),['failed','read','read']);
  down=true;assert.equal((await post(sms,report)).status,503);
  const notifyPayout=(status:string)=>{
    const obj={event:'payout.'+status,payload:{payout:{entity:{id:'pout_fixture',status}}}};
    const signature=createHmac('sha256',shared).update(JSON.stringify(obj)).digest('hex');
    return post(payouts,obj,'x-razorpay-signature',signature);
  };
  await notifyPayout('processing');assert.equal(payout.status,'PAID');
  await notifyPayout('reversed');assert.equal(payout.status,'FAILED');
  await notifyPayout('processed');assert.equal(payout.status,'FAILED');
});
