import assert from 'node:assert/strict';
import {test} from 'node:test';
import Module from 'node:module';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
import {CampaignPreview} from '../../components/admin/CampaignPreview';

test('production settings stay in one target, preserve successful fields and redact upstream errors', async t => {
  const prototype = Module.prototype as unknown as {require:(id:string)=>unknown};
  const original = prototype.require;
  t.mock.method(prototype,'require',function(this:Module,id:string) {
    if (id === '@/lib/auth') return {getSession:async()=>({role:'SUPER_ADMIN'}),requireRole:()=>true};
    return original.call(this,id);
  });
  const keys = ['VERCEL_ENV','VERCEL_TEAM_ID','VERCEL_ACCESS_TOKEN','VERCEL_PROJECT_ID'] as const;
  const previous = keys.map(key=>process.env[key]);
  t.after(()=>keys.forEach((key,i)=>{if(previous[i] === undefined) delete process.env[key]; else process.env[key]=previous[i];}));
  Object.assign(process.env,{VERCEL_ENV:'preview',VERCEL_TEAM_ID:'example-team',VERCEL_PROJECT_ID:'example-project',VERCEL_ACCESS_TOKEN:'fixture'});
  const calls: {url:URL; method:string; body:any}[] = [];
  t.mock.method(globalThis,'fetch',async(input:URL,init:RequestInit)=>{
    const method = init.method || 'GET';
    calls.push({url:new URL(input), method, body:init.body && JSON.parse(String(init.body))});
    if(method === 'GET') return Response.json({envs:[
      {id:'shared',key:'RESEND_API_KEY',type:'sensitive',target:['production','preview']},
      {id:'solo',key:'FAL_KEY',type:'sensitive',target:['production']},
    ]});
    if(method === 'POST') return new Response('unfiltered provider detail', {status:400});
    return Response.json({ok:true});
  });
  const {PUT}=require('../../app/api/admin/settings/route');
  const submit=()=>PUT(new Request('https://example.test/api/admin/settings',{method:'PUT',body:JSON.stringify({values:{RESEND_API_KEY:'fixture',FAL_KEY:'fixture',OPENAI_API_KEY:'fixture'}})}));
  assert.equal((await submit()).status,403);
  assert.equal(calls.length,0);
  process.env.VERCEL_ENV='production';
  const result=await (await submit()).json();
  assert.deepEqual(result.updated,['FAL_KEY']);
  assert.deepEqual(result.failed.map((x:{key:string})=>x.key).sort(),['OPENAI_API_KEY','RESEND_API_KEY']);
  assert.equal(JSON.stringify(result).includes('unfiltered provider detail'),false);
  assert.equal(calls.length,3);
  assert.ok(calls.every(c=>c.url.searchParams.get('teamId')==='example-team'));
  assert.equal(calls[0].url.searchParams.get('decrypt'),'false');
  assert.ok(calls.some(c=>c.method==='PATCH'&&c.url.pathname.endsWith('/solo')));
  for(const change of calls.slice(1)){
    assert.deepEqual(change.body.target,['production']);
    assert.equal(change.body.type,'sensitive');
  }
});

test('campaign previews render inside a sandbox without referrers or active browser permissions',()=>{
  const html=renderToStaticMarkup(createElement(CampaignPreview,{html:'<p>Sample campaign</p>'}));
  assert.match(html, /<iframe/);
  assert.match(html, /sandbox=""/);
  assert.match(html, /no-referrer/);
  assert.match(html, /Content-Security-Policy/);
  assert.ok(!html.includes('allow-same-origin'));
});
