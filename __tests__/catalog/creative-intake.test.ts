import {test} from 'node:test';
import assert from 'node:assert/strict';
import Module from 'node:module';
import type {TestContext} from 'node:test';
import {creationProductId, intakeJobId, intakeReferences, reviewedImages} from '../../lib/catalog/creation-intake';

function mockModules(t: TestContext, values: Record<string,unknown>) {
  const prototype=Module.prototype as unknown as {require:(id:string)=>any};
  const original=prototype.require;
  t.mock.method(prototype,'require',function(this:Module,id:string) {
    return Object.hasOwn(values,id) ? values[id] : original.call(this,id);
  });
}
const key='b85d8db7-eb65-42d5-9c23-962fb948455a';
const photo='https://media.example/products/new/body.jpg';
const openPallu='https://media.example/products/new/pallu.jpg';
const pathFor=(url:string)=>url.startsWith('https://media.example/') ? url.slice(22) : null;
const req=(body:unknown)=>new Request('https://example.test/api/admin/products',{method:'POST',body:JSON.stringify(body)});

test('reference set and product replay identities are scoped',()=>{
  assert.equal(creationProductId('staff','bad-key'),null);
  assert.notEqual(creationProductId('a',key),creationProductId('b',key));
  assert.equal(creationProductId('a',key),creationProductId('a',key.toUpperCase()));
  assert.deepEqual(intakeReferences([photo,photo,'https://media.example/portraits/private.jpg','https://other.test/image.jpg',openPallu],pathFor),[photo,openPallu]);
  assert.deepEqual(reviewedImages('intake-new',['hero','detail'],['body','detail','border']),['hero','detail','body','border']);
  assert.deepEqual(reviewedImages('legacy',['hero'],['body']),['hero']);
});

test('one creation replay returns the same draft and queues one job alongside the facts', async t=>{
  let item:any=null, inside=false, photoJob:any=null, writes=0;
  const category={name:'Sarees',slug:'sarees',path:'Women/Sarees'};
  const tx={category:{findUnique:async()=>category},product:{create:async({data}:any)=>{
    assert.ok(inside);writes++;item=data;return data;
  }}, aiPhotoJob:{create:async({data}:any)=>{assert.ok(inside); photoJob=data;return data;}}};
  const db={product:{findUnique:async({where}:any)=>where.id && where.id===item?.id ? item:null},$transaction:async(fn:Function)=>{
    inside=true;try{return await fn(tx);}finally{inside=false;}
  }};
  const session={id:'editor',role:'CONTENT_EDITOR'};
  let evidenceSaved=0,authored=0;
  mockModules(t,{'@/lib/auth':{getSession:async()=>session,requireRole:()=>true},'@/lib/prisma':{prisma:db},
    '@/lib/storage':{storagePathFromPublicUrl:pathFor},'@/lib/catalog/narrative-service':{
      authorNewProduct:async(body:any)=>{authored++;assert.equal(body.name,'');return {draft:{name:'Indigo saree with ivory checks'}};},
      saveCreationFacts:async()=>{assert.ok(inside);evidenceSaved++;},
    }});
  const {POST}=require('../../app/api/admin/products/route');
  const body={creationKey:key,categoryId:'sarees',generateCreatives:true,images:[photo,openPallu],sku:'NJ-1',
    name:'',pieceFacts:{colour:'indigo',motif:'ivory checks'},sellingPrice:24000,mrp:25000};
  assert.equal((await POST(req(body))).status,200);
  const replay=await (await POST(req(body))).json();
  assert.equal(authored,1);assert.equal(writes,1);assert.equal(evidenceSaved,1);
  assert.equal(replay.product.id,item.id);assert.equal(item.status,'DRAFT');
  assert.equal(photoJob.id,intakeJobId(item.id));assert.equal(photoJob.strategy,'SAREE_ON_MODEL');
  assert.equal(photoJob.status,'QUEUED');assert.deepEqual(photoJob.sourceImageUrls,[photo,openPallu]);
});

test('competing workers submit each scene once and failed providers never publish media',async t=>{
  let status='QUEUED',calls=0,providerOnline=false;
  const stored:string[]=[];
  t.mock.method(globalThis,'fetch', async()=>new Response(new Uint8Array([255,216,1,255,217])));
  const written:any[]=[];
  const jobs={updateMany:async({where,data}:any)=>{if(status!==where.status)return {count:0};status=data.status;return {count:1};},
    findUnique:async()=>({id:'intake-p1',sourceImageUrls:[photo,openPallu],productId:'p1',strategy:'SAREE_ON_MODEL',variantCount:2,product:{name:'Indigo saree'}}),
    update:async({data}:any)=>{status=data.status;}};
  const db={aiPhotoJob:jobs,$transaction:async(fn:Function)=>fn({aiPhotoJob:jobs,aiPhotoVariant:{createMany:async({data}:any)=>written.push(...data)}})};
  mockModules(t,{'@/lib/prisma':{prisma:db},'@/lib/ai':{falRun:async({input}:any)=>{
    calls++;assert.deepEqual(input.image_urls,[photo,openPallu]);return providerOnline ? {ok:true,data:{images:[{url:'https://v3.fal.media/sku.jpg'}]}} : {ok:false,error:'service unavailable'};
  }},'@/lib/storage':{uploadFile:async(path:string)=>{assert.ok(providerOnline);stored.push(path);return {url:'https://media.example/'+path};}}});
  const {runAiPhotoJob}=require('../../lib/ai-photo-studio/generate');
  const results=await Promise.all([runAiPhotoJob('intake-p1'),runAiPhotoJob('intake-p1')]);
  assert.equal(status,'FAILED');assert.equal(calls,2);assert.equal(written.length,0);
  assert.equal(results.filter(r=>r.firstError==='Already claimed or finished').length,1);
  providerOnline=true;status='QUEUED'; // staff explicitly retries the failed, empty job
  const success=await runAiPhotoJob('intake-p1');
  assert.equal(success.variantCount,2);assert.equal(status,'COMPLETED');
  assert.deepEqual(stored.sort(),['products/p1/creatives/intake-p1-0.jpg','products/p1/creatives/intake-p1-1.jpg']);
  assert.ok(written.every(r=>r.decision==='PENDING' && r.url.startsWith('https://media.example/products/')));
  await runAiPhotoJob('intake-p1');assert.equal(calls,4);
});

test('intake status and dispatch require a signed-in catalogue operator', async t=>{
  let session:{id:string;role:string} | null=null;
  let reads=0;
  mockModules(t,{'@/lib/auth':{getSession:async()=>session,requireRole:(user:any,roles:string[])=>roles.includes(user.role)},
    '@/lib/prisma':{prisma:{aiPhotoJob:{findUnique:async()=>{reads++;return null;}}}},
    '@/lib/ai-photo-studio/generate':{runAiPhotoJob:async()=>{throw Error('should never start');}}});
  const {GET,POST}=require('../../app/api/admin/products/[id]/photo-intake/route');
  const args=[req({}),{params:{id:'p1'}}];
  assert.equal((await GET(...args)).status,401);
  session={id:'shopper',role:'CUSTOMER'};
  assert.equal((await POST(...args)).status,403);assert.equal(reads,0);
  session.role='CONTENT_EDITOR';
  assert.equal((await POST(...args)).status,404);assert.equal(reads,1);
});
