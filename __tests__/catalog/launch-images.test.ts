import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { makeStyleImage } from '../../lib/ai/openai-image';
import { falRun } from '../../lib/ai';

test('image fallback preserves references and returns the requested framing for text and edits', async t => {
  const previous = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'local-fixture';
  t.after(() => { if (previous === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previous; });
  const photo = await sharp({create:{width:24,height:16,channels:3,background:'ivory'}}).jpeg().toBuffer();
  const calls: Array<{url:string, body:any}> = [];
  t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    calls.push({url, body:JSON.parse(String(init.body))});
    return Response.json({data:[{b64_json:photo.toString('base64')}]});
  });
  const banner = await makeStyleImage('banner', [], '2:1');
  const edited = await makeStyleImage('keep this piece', ['https://example.test/lamp.jpg'], '1:1');
  assert.ok(calls[0].url.endsWith('/generations'));
  assert.equal(calls[0].body.images, undefined);
  assert.ok(calls[1].url.endsWith('/edits'));
  assert.deepEqual(calls[1].body.images, [{image_url:'https://example.test/lamp.jpg'}]);
  const first = await sharp(banner).metadata(), second = await sharp(edited).metadata();
  assert.equal(first.width, 2 * first.height!);
  assert.equal(second.width, second.height);
});

test('only a definite credential rejection permits starting a different image job', async t => {
  const old = process.env.FAL_KEY;
  process.env.FAL_KEY = 'local-fixture';
  t.after(() => { if (old === undefined) delete process.env.FAL_KEY; else process.env.FAL_KEY = old; });
  let status = 401;
  t.mock.method(globalThis, 'fetch', async () => Response.json({detail:'unavailable'}, {status}));
  const req = { endpoint:'fal-ai/nano-banana-pro/edit', input:{prompt:'fixture'} };
  assert.equal((await falRun(req)).credentialRejected, true);
  status = 402;
  assert.equal((await falRun(req)).credentialRejected, true);
  for (status of [400, 403, 422, 429, 500]) assert.equal((await falRun(req)).credentialRejected, false);
});

test('an authenticated jewellery fitting saves the generated photograph privately and requires the owner’s upload', async t => {
  const Module = require('node:module');
  const previous = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = 'a-local-test-only-key-for-signing-media-proofs';
  t.after(() => { if (previous === undefined) delete process.env.AUTH_SECRET; else process.env.AUTH_SECRET=previous; });
  const { createPrivateAiMediaUrl, verifyPrivateAiMediaRequest } = require('../../lib/ai/private-media');
  let uploads = 0, writes = 0, generations = 0;
  const fixtures: Record<string, unknown> = {
    '@/lib/auth':{getSession:async()=>({id:'test-user'})},
    '@/lib/prisma':{prisma:{product:{findFirst:async()=>({id:'piece',name:'Ring',arTryOnEligible:true,images:['https://example.test/ring.jpg']})},
      aiPreview:{create:async({data}: any)=>{writes++;assert.equal(data.consentLogged,true);assert.ok(verifyPrivateAiMediaRequest(new URL(data.outputImage)).ok);return {id:'preview'};}}}},
    '@/lib/storage':{privateStudioReadUrl:async()=> 'https://example.test/signed-source',storageConfigured:()=>true,
      makeUploadPath:(folder:string)=>folder+'/result.jpg',uploadPrivateAiFile:async()=>{uploads++;}},
    '@/lib/ai': {aiImageConfigured:()=>true,detectJewelleryType:()=> 'ring',jewelleryTryOn:async()=>{generations++;return {ok:true,jpeg:Buffer.from([255,216,255,217])};}},
  };
  const original = Module.prototype.require;
  t.mock.method(Module.prototype,'require',function(this:unknown,id:string) {
    return Object.hasOwn(fixtures,id) ? fixtures[id] : original.call(this,id);
  });
  const { POST } = require('../../app/api/ai/jewellery-tryon/route');
  const req = (owner:string, consent:boolean) => new Request('https://example.test/api/ai/jewellery-tryon',{
    method:'POST',body:JSON.stringify({productId:'piece',consent,personImageUrl:createPrivateAiMediaUrl('https://example.test','ai-tryon/'+owner+'/input.jpg')})});
  assert.equal((await POST(req('someone-else',true))).status,400);
  assert.equal((await POST(req('test-user',false))).status,400);
  assert.equal(generations,0);
  const res = await POST(req('test-user',true));
  assert.equal(res.status,200);
  const result = await res.json();
  assert.equal(verifyPrivateAiMediaRequest(new URL(result.outputUrl)).path,'ai-tryon/test-user/result.jpg');
  assert.deepEqual([generations,uploads,writes],[1,1,1]);
});
