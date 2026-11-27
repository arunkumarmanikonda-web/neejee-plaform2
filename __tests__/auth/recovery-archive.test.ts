import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { restoreFiles, sealFiles } from '../../lib/recovery/storage-archive';

test('restores both bucket types byte-for-byte and rejects a changed archive, wrong key or unsafe path', () => {
  const key = randomBytes(32).toString('hex');
  const fixtures = ['catalogue','seller-documents'].map(bucket => ({bucket,name:'sub/नमूना file.bin',contentType:'application/octet-stream',bytes:randomBytes(64)}));
  const date = new Date().toISOString();
  const archive = sealFiles(fixtures,key,date);
  assert.deepEqual(restoreFiles(archive,key),{createdAt:date,bytes:128,files:fixtures});
  assert.throws(() => restoreFiles(archive,randomBytes(32).toString('hex')));
  const modified = Buffer.from(archive); modified[modified.length-1] ^= 1;
  assert.throws(() => restoreFiles(modified,key));
  for (const name of ['../x','/absolute','a//b']) {
    assert.throws(() => restoreFiles(sealFiles([{...fixtures[0],name}],key,date),key));
  }
});
