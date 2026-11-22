import assert from 'node:assert/strict';
import test from 'node:test';
import { applyEditorialOrder, rankOutfit, type Garment } from '../../lib/outfit-rank';
import { buildStyledInput, readOwnPhotos } from '../../lib/ai/styled-fitting';
import { allAccessoriesPresent, editorialOptions, lookUrl, readStyling, type Styling, type StyleOption } from '../../lib/stylebook';
import { clearDressing, lineKey, readDressing, saveDressing } from '../../lib/outfit-closet';

const red:Garment={id:'red',variant:'vermilion',name:'Surkh',slug:'surkh',mirror:true,image:'',colour:'Vermilion',hex:'#a4382a',description:'Gold checks and a wine border',region:'Varanasi'};
test('each saree retains its own palette, styling and exact variant',()=>{
  const redOptions=rankOutfit(red,editorialOptions);
  assert.equal(redOptions.find(o=>o.slot==='blouse')?.id,'blouse-wine');
  const blueOptions=rankOutfit({...red,colour:'Indigo',hex:'#344d6a',description:'Fine silver edging on an indigo ground'},editorialOptions);
  assert.equal(blueOptions.find(o=>o.slot==='jewel')?.id,'jewel-silver');
  const keys=['blue','red'].map(v=>lineKey('same-saree',v));
  saveDressing(keys[0],{choices:{blouse:'mine'},photos:{blouse:'personal garment'}});
  assert.equal(readDressing(keys[1]).photos.blouse,undefined);
  clearDressing(keys[0]);
});
test('regional craft and colour, sizes and approved slots survive model reranking',()=>{
  const base:StyleOption={id:'sku-b1',slot:'blouse',name:'Wine blouse',image:'photo',productId:'p',colour:'Wine',region:'Varanasi',size:'S'};
  const options=rankOutfit(red,[base,{...base,id:'sku-b2',size:'M'},{...base,id:'sku-ivory',name:'Ivory blouse',colour:'Ivory',region:'Delhi'}]);
  assert.deepEqual(options.map(o=>o.id),['sku-b1','sku-b2','sku-ivory']);
  assert.deepEqual(applyEditorialOrder(options,{blouse:['sku-ivory','fake','sku-ivory'],jewel:['sku-b1']}).map(o=>o.id),['sku-ivory','sku-b1','sku-b2']);
});
test('the fitting keeps the blouse, exact shoe, and owned jewellery in their assigned places',async()=>{
  const style:Styling={look:'neel',blouse:'blouse-ivory',shoe:'sku-j1',jewel:'none'};
  const stock:StyleOption[]=[{id:'sku-j1',productId:'a1',name:'Tan jutti',slot:'shoe',image:'https://shop.example/tan.jpg'}];
  assert.deepEqual(readStyling(Object.fromEntries(new URL(lookUrl('/ai/mirror',style,'saree','blue'),'https://example.test').searchParams)),style);
  assert.equal(allAccessoriesPresent({...style,blouse:'sku-j1'},stock),false);
  const own={jewel:'data:image/jpeg;base64,/9j/2Q=='};
  assert.deepEqual(readOwnPhotos(own),own);
  assert.equal(readOwnPhotos({jewel:'https://external.example/image'}),null);
  assert.equal(readOwnPhotos({other:own.jewel}),null);
  const result=await buildStyledInput('person','/brand/bazaar/neel.webp',style,stock,'https://shop.example',own);
  assert.equal(result.image_urls.length,5);
  assert.match(result.image_urls[2],/^data:image\/webp;base64,/);
  assert.equal(result.image_urls[3],stock[0].image);
  assert.equal(result.image_urls[4],own.jewel);
  assert.match(result.prompt,/Image 5 shows the customer’s own jewellery/);
});
