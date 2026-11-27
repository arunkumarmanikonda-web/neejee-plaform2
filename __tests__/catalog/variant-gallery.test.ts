import test from 'node:test';
import assert from 'node:assert/strict';
import { applyGalleryChange, parseGalleryChange, retryGalleryWrite } from '../../lib/catalog/variant-gallery';

test('gallery retries and removals preserve ordering and other photographs', () => {
  const add=parseGalleryChange({images:['new','first','new']})!;
  assert.deepEqual(applyGalleryChange(['first','second'],add), ['first','second','new']);
  assert.deepEqual(applyGalleryChange(['first','new','second','new'],parseGalleryChange({image:'new'},true)!), ['first','second']);
  assert.deepEqual(applyGalleryChange(['old'],parseGalleryChange({mode:'replace',images:[]})!), []);
  assert.equal(parseGalleryChange({images:[null]}),null);
  assert.equal(parseGalleryChange({mode:'replace'}),null);
  assert.equal(parseGalleryChange({mode:'unknown',images:[]}),null);
});

test('a serialization conflict re-reads the latest gallery before appending', async () => {
  let written=['base'], attempts=0;
  const result=await retryGalleryWrite(async () => {
    attempts++;
    if (attempts===1) { written.push('other-writer'); throw Object.assign(new Error('conflict'),{code:'P2034'}); }
    return applyGalleryChange(written,{mode:'append',images:['my-image']});
  });
  assert.equal(attempts,2);
  assert.deepEqual(result,['base','other-writer','my-image']);
});

test('persistent concurrency errors are bounded and unrelated failures are never retried', async () => {
  let attempts=0;
  await assert.rejects(retryGalleryWrite(async () => { attempts++; throw Object.assign(new Error(),{code:'P2034'}); }));
  assert.equal(attempts,3);
  attempts=0;
  await assert.rejects(retryGalleryWrite(async () => { attempts++; throw new Error('connection'); }),/connection/);
  assert.equal(attempts,1);
});
