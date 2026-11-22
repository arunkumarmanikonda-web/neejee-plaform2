import test from 'node:test';
import assert from 'node:assert/strict';
import {readPieceFacts,requestedPieceField} from '../../lib/catalog/piece-notes';

test('only approved customer-facing fields are displayed',()=>{
  assert.deepEqual(readPieceFacts({contents:'  Unstitched blouse piece  ',blouse:'  ',vendorInvoice:'private',dimensions:42}),{contents:'Unstitched blouse piece'});
  assert.deepEqual(readPieceFacts(null),{});
  assert.deepEqual(readPieceFacts(['text']),{});
  assert.equal(readPieceFacts({fit:'x'.repeat(600)}).fit?.length,400);
});

test('Sakhi looks up a matching SKU fact including blouse and dimensions',()=>{
  assert.equal(requestedPieceField('Does this include a blouse?'),'blouse');
  assert.equal(requestedPieceField('How tall is the lamp?'),'dimensions');
  assert.equal(requestedPieceField('What comes with this piece?'),'contents');
  assert.equal(requestedPieceField('Tell me a story'),undefined);
});
