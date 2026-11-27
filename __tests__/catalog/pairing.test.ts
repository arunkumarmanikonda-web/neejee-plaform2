import test from 'node:test';
import assert from 'node:assert/strict';
import {slotFor,slotsFor,studyStyleHref,styleHref} from '../../lib/pairing';
test('styling carries the exact option and safely encodes product keys',()=>{
  const url=new URL(styleHref('a&b','blue / M'),'https://example.org');
  assert.equal(url.searchParams.get('product'),'a&b');
  assert.equal(url.searchParams.get('variant'),'blue / M');
  assert.equal(studyStyleHref('surkh'),'/style?study=surkh');
});
test('a saree, a kurta and a table receive appropriate pairings',()=>{
  assert.deepEqual(slotsFor('fashion','saree'),['blouse','jewellery','footwear','accessory']);
  assert.ok(!slotsFor('fashion','kurta set').includes('blouse'));
  assert.deepEqual(slotsFor('room','teak table'),['lamp','frame','object','wall','rug']);
  assert.equal(slotFor('brass table lamp'),'lamp');
  assert.ok(slotsFor('room','table lamp').includes('table'));
  assert.ok(!slotsFor('room','table lamp').includes('lamp'));
});
