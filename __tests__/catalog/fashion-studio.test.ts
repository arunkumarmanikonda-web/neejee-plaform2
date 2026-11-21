import test from 'node:test';
import assert from 'node:assert/strict';
import { localReturn, studioHref } from '../../lib/studio';
import { signStudioJob, verifyStudioJob } from '../../lib/ai/studio-job';
import { getEdit, editHref } from '../../lib/shop-edits';

test('wardrobe and home edits have stable customer routes',()=>{
  assert.deepEqual(['sarees','suits','home'].map(k=>editHref(getEdit(k)!.slug)),['/edits/sarees','/edits/suits','/edits/home']);
  assert.equal(getEdit('mens-suits'),undefined);
  assert.equal(getEdit('suits')?.paths.some(p=>p.startsWith('men/')),false);
});
test('studio selection survives a local auth return',()=>{
  const url=studioHref('mirror','saree-wine','size L+gold',2);
  assert.equal(new URL(url,'https://neejee.com').searchParams.get('variant'),'size L+gold');
  assert.equal(localReturn(url),url);
  assert.equal(localReturn('//other.example','/account'),'/account');
  assert.equal(localReturn('/\\other.example','/account'),'/account');
});
test('a queued preview is bound to its shopper and exact provider job',()=>{
  const old=process.env.AI_MEDIA_SIGNING_SECRET;
  process.env.AI_MEDIA_SIGNING_SECRET='fixture-only-unit-secret-32-characters-or-more';
  try {
    const query=new URLSearchParams({id:'job-123',previewId:'preview',endpoint:'wearables',statusUrl:'https://queue.fal.run/a'});
    signStudioJob('owner',query);
    assert.equal(verifyStudioJob('owner',query),true);
    assert.equal(verifyStudioJob('other',query),false);
    query.set('id','changed');
    assert.equal(verifyStudioJob('owner',query),false);
  } finally {if(old===undefined)delete process.env.AI_MEDIA_SIGNING_SECRET;else process.env.AI_MEDIA_SIGNING_SECRET=old;}
});
