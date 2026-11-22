import test from 'node:test';
import assert from 'node:assert/strict';
import {readPieceFacts} from '../../lib/catalog/piece-notes';

test('only approved customer-facing fields are displayed',()=>{
  assert.deepEqual(readPieceFacts({contents:'  Unstitched blouse piece  ',blouse:'  ',vendorInvoice:'private',dimensions:42}),{contents:'Unstitched blouse piece'});
  assert.deepEqual(readPieceFacts(null),{});
  assert.deepEqual(readPieceFacts(['text']),{});
  assert.equal(readPieceFacts({fit:'x'.repeat(600)}).fit?.length,400);
});
