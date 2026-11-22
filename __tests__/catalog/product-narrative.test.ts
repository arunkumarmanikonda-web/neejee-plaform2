import test from 'node:test';
import assert from 'node:assert/strict';
import {buildProductNarrative, productNarrativePrompt, readNarrativeEvidence, resolveProductNarrative} from '../../lib/catalog/product-narrative';
import {studies} from '../../lib/shop-studies';

test('uses the actual saree and suit storefront captions as editorial examples',()=>{
  for (const [category,group] of [['Sarees','sarees'],['Suit sets','suits']]) {
    const prompt=JSON.parse(productNarrativePrompt({categoryName:category}).user);
    assert.deepEqual(prompt.formatExamples.map((p:{name:string;poeticLine:string})=>[p.name,p.poeticLine]),
      studies.filter(p=>p.group===group).map(p=>[p.name,p.caption]));
  }
});

test('starts a saree with colour and visible motif, retaining its working alias',()=>{
  const e=readNarrativeEvidence({name:'Neel',category:{name:'Sarees'},variants:[{color:'Indigo'}],
    motif:'Bandhani diamonds',border:'ivory dots',pallu:'fine ivory stripes',
    designReference:'Bandhani of Gujarat and Rajasthan',sellerProfile:{region:'Jaipur'}});
  const draft=resolveProductNarrative(e);
  assert.equal(draft.name,'Indigo saree with Bandhani diamonds');
  assert.equal(draft.shortName,'Neel');
  assert.match(draft.description,/ivory stripes/i);
  assert.doesNotMatch(draft.description,/made in|Jaipur/i);
  assert.match(draft.description,/design draws on/i);
});

test('separates a decorative reference from manufacture when reviewing AI text',()=>{
  const e={name:'Neel',categoryName:'Sarees',colour:'Indigo',motif:'Bandhani diamonds',designReference:'Bandhani of Gujarat'};
  const proposed={name:'Indigo saree with Bandhani diamonds',shortName:'Maharani',
    poeticLine:'Bandhani diamonds across the indigo saree.',description:'This Bandhani saree is made in Gujarat.'};
  const resolved=resolveProductNarrative(e,proposed);
  assert.equal(resolved.poeticLine,proposed.poeticLine);
  assert.equal(resolved.shortName,'Neel');
  assert.equal(resolved.description,buildProductNarrative(e).description);
});

test('preserves qualified material and rejects invented weave, contents and offline origin',()=>{
  const e={categoryName:'Suit sets',name:'Pista',colour:'Pistachio',material:'silk-look polyester',contents:'kurta and trousers'};
  const proposed={name:'Pistachio silk kurta set',description:'The handwoven kurta comes with a dupatta.'};
  const draft=resolveProductNarrative(e,proposed);
  assert.match(draft.name,/silk-look polyester/);
  assert.match(draft.description,/kurta and trousers/i);
  assert.doesNotMatch(draft.description,/dupatta|handwoven/i);
});

test('uses verified object details and supports incomplete evidence',()=>{
  const e=readNarrativeEvidence({name:'Istanbul Hand-Painted Mushroom Lamp',material:'Ceramic',region:'Istanbul',pieceFacts:{dimensions:'21 × 12 cm',finish:'Hand-painted ceramic'}});
  const draft=buildProductNarrative(e);
  assert.equal(draft.name,'Istanbul Hand-Painted Mushroom Lamp');
  assert.match(draft.description,/21 × 12 cm/);
  assert.match(draft.description,/Made in Istanbul/);
  assert.deepEqual(resolveProductNarrative({}, {name:'Banarasi silk saree'}),{name:'',shortName:'',poeticLine:'',description:''});
});

test('uses nested garment facts, retaining reference status and case in the title',()=>{
  const input=readNarrativeEvidence({name:'Neel',categoryName:'Sarees',pieceFacts:{
    color:'Indigo',motif:'ivory diamonds',pallu:'fine ivory stripes',designReference:'Bandhani of Gujarat',
  }});
  const draft=resolveProductNarrative(input,{description:'This saree is from Gujarat.'});
  assert.equal(draft.name,'Indigo saree with Bandhani-style ivory diamonds');
  assert.doesNotMatch(draft.description,/is from Gujarat/);
  assert.match(draft.poeticLine,/ivory diamonds/i);
  assert.equal(buildProductNarrative({name:'Neel',categoryName:'Sarees',colour:'Indigo',technique:'Bandhani'}).name,'Indigo Bandhani saree');
  assert.equal(buildProductNarrative({name:'Istanbul ceramic lamp'}).name,'Istanbul ceramic lamp');
  assert.equal(buildProductNarrative({name:'Neel',categoryName:'Sarees',colour:'Indigo',motif:'Dotted diamonds'}).name,'Indigo saree with dotted diamonds');
});

test('a home collection alias becomes a physical merchandise title when the category names the object',()=>{
  const item=buildProductNarrative({name:'Diya',categoryName:'Lamps',colour:'Amber',material:'glass'});
  assert.equal(item.name,'Amber glass lamp');
  assert.equal(item.shortName,'Diya');
});
