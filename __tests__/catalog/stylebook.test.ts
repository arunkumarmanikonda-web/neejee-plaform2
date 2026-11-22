import assert from 'node:assert/strict';
import test from 'node:test';
import {allAccessoriesPresent, defaultStyling, getEditorialPiece, lookUrl, readStyling, selectedAccessories, type StyleOption} from '../../lib/stylebook';
import {buildStyledInput} from '../../lib/ai/styled-fitting';
import {readPieceFacts, requestedPieceField} from '../../lib/catalog/piece-notes';

const stock:StyleOption={id:'sku-123',slot:'shoe',name:'Real jutti',image:'https://shop.example/jutti.jpg',href:'/products/jutti?variant=123',productId:'123p'};

test('a saved or login-return link restores the exact garment, shoe and jewel selections',()=>{
  const style={...defaultStyling('rose'),shoe:'sku-123',jewel:'jewel-silver'};
  const params=new URL(lookUrl('/ai/mirror',style,'pink-saree','pink-m'),'https://example.test').searchParams;
  assert.deepEqual(readStyling(Object.fromEntries(params)),style);
  assert.equal(params.get('product'),'pink-saree');
  assert.equal(params.get('variant'),'pink-m');
  assert.equal(allAccessoriesPresent(style,[stock]),true);
  assert.equal(allAccessoriesPresent(style,[]),false);
  assert.equal(allAccessoriesPresent({...style,shoe:'none',jewel:'sku-123'},[stock]),false);
  assert.equal(readStyling({...style,jewel:'https://example.test/private'}),null);
});
test('the four model references use the exact selected items in order',async()=>{
  const style={...defaultStyling('indigo'),shoe:'sku-123',jewel:'jewel-pearl'};
  const person='https://private.example/portrait.jpg';
  const garment='https://shop.example/indigo.jpg';
  const payload=await buildStyledInput(person,garment,style,[stock],'https://neejee.com');
  assert.deepEqual(payload.image_urls.slice(0,3),[person,garment,stock.image]);
  assert.match(payload.image_urls[3],/^data:image\/webp;base64,/);
  assert.match(payload.prompt,/Image 3 shows the Real jutti/);
  assert.match(payload.prompt,/Image 4 shows the Pearl studs/);
});
test('an editorial outfit uses bundled references and optional accessories can be left out',async()=>{
  const style={...defaultStyling('sage'),shoe:'none',jewel:'none'};
  const study=getEditorialPiece(style);
  assert.match(study.image,/sage.webp$/);
  const payload=await buildStyledInput('https://example.test/person',study.image,style);
  assert.equal(payload.image_urls.length,2);
  assert.match(payload.image_urls[1],/^data:image\/webp;base64,/);
  assert.equal(selectedAccessories(style).length,0);
});
test('published product facts can answer questions about drape, touch and sheerness',()=>{
  assert.deepEqual(readPieceFacts({drape:'Light and fluid',opacity:'Unlined',handfeel:'Soft',tag:'draft'}),{handfeel:'Soft',drape:'Light and fluid',opacity:'Unlined'});
  assert.equal(requestedPieceField('How does it feel against the skin?'),'handfeel');
  assert.equal(requestedPieceField('Is it sheer?'),'opacity');
  assert.equal(requestedPieceField('Is the pallu heavy?'),'drape');
});
