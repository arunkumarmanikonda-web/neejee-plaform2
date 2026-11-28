import assert from 'node:assert/strict';
import { test } from 'node:test';
import Module from 'node:module';

test('checkout and courier order notifications honour consent, claim each campaign once, and keep the AiSensy reference', async t => {
  const previous = { key: process.env.AISENSY_API_KEY, enabled: process.env.WHATSAPP_ENABLED };
  process.env.AISENSY_API_KEY = 'fixture';
  delete process.env.WHATSAPP_ENABLED;
  t.after(() => {
    if (previous.key === undefined) delete process.env.AISENSY_API_KEY; else process.env.AISENSY_API_KEY = previous.key;
    if (previous.enabled === undefined) delete process.env.WHATSAPP_ENABLED; else process.env.WHATSAPP_ENABLED = previous.enabled;
  });
  const user = {id:'buyer',name:'Arun Kumar',phone:'9990000000',whatsappOptIn:true,notificationPref:null};
  const order = {id:'order',userId:user.id,user,address:null,orderNumber:'TEST-ORDER',items:[{quantity:1,product:{name:'Lamp'}}],
    total:499900,paymentMethod:'ONLINE',paymentStatus:'PAID',awbNumber:'AWB'};
  const calls: any[] = [], rows = new Map<string,any>();
  const db = {
    order: {findUnique:async()=>order},
    user: {findMany:async()=>[user]},
    notificationLog:{create:async()=>({id:'skip'})},
    notificationDispatch:{
      createMany:async({data:[record]}:any)=>{if(rows.has(record.id))return {count:0}; rows.set(record.id,record);return {count:1};},
      update:async({where,data}:any)=>Object.assign(rows.get(where.id),data),
    },
  };
  const proto = Module.prototype as unknown as {require:(id:string)=>any};
  const original = proto.require;
  t.mock.method(proto,'require',function(this:Module,id:string) {
    if (id === '@/lib/prisma') return {prisma:db};
    return original.call(this,id);
  });
  t.mock.method(globalThis,'fetch',async (_:unknown,init:RequestInit)=>{
    calls.push(JSON.parse(String(init.body)));
    return Response.json({success:'true',submitted_message_id:'wa-ref'});
  });
  const {notify}=require('../../lib/notifications');
  const {fireOrderEvent}=require('../../lib/notifications/order-events');
  const args={userId:user.id,event:'ORDER_CONFIRMED',context:{type:'ORDER',id:order.id}};
  await Promise.all([notify(args),notify(args)]);
  assert.equal(calls.length,1);
  assert.equal(calls[0].campaignName,'order_placed');
  assert.deepEqual(calls[0].templateParams,['Arun','TEST-ORDER','1× Lamp','4,999','Online (Paid)','TEST-ORDER']);
  assert.equal([...rows.values()][0].providerRequestId,'wa-ref');
  assert.equal([...rows.values()][0].status,'sent');
  user.whatsappOptIn=false;
  await fireOrderEvent({orderId:order.id,event:'ORDER_DELIVERED',whatsappForUser:user.id});
  await notify({...args,event:'ORDER_SHIPPED'});
  assert.equal(calls.length,1);
  user.whatsappOptIn=true;
  await fireOrderEvent({orderId:order.id,event:'ORDER_DELIVERED',whatsappForUser:'different-buyer'});
  assert.equal(calls.length,1);
  order.paymentMethod='COD'; order.paymentStatus='PENDING';
  await notify({...args,event:'ORDER_CANCELLED'});
  assert.deepEqual(calls[1].templateParams,['Arun','TEST-ORDER','0','not applicable','not applicable','TEST-ORDER']);
});
