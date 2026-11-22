import test from 'node:test';
import assert from 'node:assert/strict';
import {counterHref, firstPair, rankedCloths, readCounter, safeHex, type CounterCloth} from '../../lib/counter';
import {archiveCloths} from '../../lib/counter-archive';

test('invitations and replies carry both exact pieces and the selected shade',()=>{
  const state={colour:'#48263f',one:'archive-banaras',two:'archive-red-silk'};
  const url=new URL(counterHref(state,'reply',state.two),'https://example.test');
  assert.deepEqual(readCounter(url.searchParams),{...state,mode:'reply',pick:state.two});
  assert.deepEqual([...url.searchParams.keys()].sort(),['c','mode','one','pick','two']);
});
test('unrecognised pieces and external inputs cannot become arbitrary links or choices',()=>{
  const v=readCounter(new URLSearchParams({one:'https://elsewhere.test',two:'x',mode:'reply',pick:'not-on-the-table',c:'<script>'}));
  assert.equal(v.one,'');assert.equal(v.pick,'');assert.equal(v.colour,'');
  assert.equal(safeHex('url(bad)'),'');
  assert.equal(readCounter(new URLSearchParams({one:'a',two:'a'})).two,'');
});
test('matching and contrast use real swatches and keep unrated cloth away from colour claims',()=>{
  const row=(id:string,palette:string[]):CounterCloth=>({...archiveCloths[0],id,palette});
  const set=[row('unknown',[]),row('white',['#ffffff']),row('black',['#000000'])];
  assert.deepEqual(rankedCloths(set,'#ffffff').map(p=>p.id),['white','black','unknown']);
  assert.deepEqual(rankedCloths(set,'#ffffff',true).map(p=>p.id),['black','white','unknown']);
});
test('an available garment can join an archive comparison without inventing stock',()=>{
  const live:CounterCloth={...archiveCloths[0],kind:'shop',id:'v-123'};
  const [one,two]=firstPair([live,...archiveCloths],'#351c37');
  assert.equal(one,'v-123');assert.notEqual(one,two);
});

test('pale zari does not outrank the ivory body when matching an unbleached blouse', () => {
  assert.equal(rankedCloths(archiveCloths, '#e5d8b9')[0].id, 'archive-ivory-cotton');
  assert.equal(rankedCloths(archiveCloths, '#48263f')[0].id, 'archive-banaras');
});
