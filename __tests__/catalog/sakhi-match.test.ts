import test from 'node:test';
import assert from 'node:assert/strict';
import { shoppingHints, wantsStyling, rankingBrief, rankedIndices } from '../../lib/sakhi-match';
import { parsePitari } from '../../lib/pitari';

test('Indian colour and craft names preserve price and real variant constraints',()=>{
  const message='Gulabi Bandhej sarees under ₹6,000 for a shaadi';
  const h=shoppingHints(message), p=parsePitari(message);
  assert.ok(h.colours.includes('pink'));
  assert.equal(h.occasion,'wedding');
  assert.deepEqual(p.terms.sort(),['bandhani','sari']);
  assert.deepEqual(p.words.filter(w=>!h.ignored.has(w)),[]);
  assert.equal(p.maxPaise,599999);
  assert.equal(shoppingHints('a black saree for my friend Fred').colours.includes('red'),false);
});
test('wearing one’s own blouse is a styling request and buying included blouse fabric is a product fact',()=>{
  assert.ok(wantsStyling('Can I match my own blouse?'));
  assert.ok(wantsStyling('Which juttis go with this saree?'));
  assert.equal(wantsStyling('Does it include a blouse piece?'),false);
  assert.equal(parsePitari('Will I get cash on delivery?').service,'cod');
});
test('ranker receives only approved facts and one enumerated occasion',()=>{
  const facts={material:'Silk',craft:'Banarasi',color:'Pink',occasion:'Evening',slug:'secret-slug',email:'personal@example.com'};
  const brief=JSON.parse(rankingBrief('wedding',[facts]));
  assert.deepEqual(brief,{occasion:'wedding',choices:[{index:0,material:'Silk',craft:'Banarasi',occasion:'Evening',colour:'Pink'}]});
});
test('invalid model ids or text never add products, links, prices or promises',()=>{
  assert.deepEqual(rankedIndices([2,2,9,-1,'free returns',null,'https://example.com'],3),[2,0,1]);
  assert.deepEqual(rankedIndices({text:'ships today'},3),[0,1,2]);
  assert.deepEqual(rankedIndices([],2),[0,1]);
});
