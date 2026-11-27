import test from 'node:test';
import assert from 'node:assert/strict';
import { fittingReferences } from '../../lib/ai/fitting-references';
import { buildStyledInput } from '../../lib/ai/styled-fitting';
import { stockStyling, type StyleOption } from '../../lib/stylebook';

const shot = (name: string, sku = 'blue') => 'https://media.example/'+sku+'/1-abc-neejee-shot-saree-'+name+'.jpg?s=1';
const stock = {id:'sku-j1',slot:'jewel',productId:'p1',image:'/jewel.jpg',name:'Silver earrings'} as StyleOption;
test('the worn variant is primary and its actual pallu and border retain their roles', () => {
  const {primary, details} = fittingReferences([shot('border'),shot('body'),shot('pallu'),shot('drape')], [shot('drape','red')], 'red.jpg',2);
  assert.equal(primary,shot('drape'));
  assert.deepEqual(details,[{role:'pallu',image:shot('pallu')},{role:'border',image:shot('border')}]);
});
test('one SKU can inherit product captures, while two SKUs cannot borrow a missing view', () => {
  assert.deepEqual(fittingReferences([shot('body')],[shot('pallu')],null,1),{primary:shot('body'),details:[{role:'pallu',image:shot('pallu')}]});
  assert.deepEqual(fittingReferences([], [shot('drape','red')], 'red.jpg',2),{primary:null,details:[]});
  assert.deepEqual(fittingReferences([shot('border')], [],null,1),{primary:null,details:[]});
  assert.equal(fittingReferences([],['old-catalogue.jpg'],'preferred.jpg',1).primary,'preferred.jpg');
  assert.equal(fittingReferences(['variant-front.jpg'],['preferred.jpg'],null,2).primary,'variant-front.jpg');
});
test('fabric and accessory prompts track exact image positions, including a customer-owned blouse',async () => {
  const fitting=await buildStyledInput('person',shot('drape'),{look:'neel',shoe:'none',jewel:stock.id,blouse:'none'},[stock],
    'https://shop.example',{blouse:'customer-blouse'},[{role:'pallu',image:shot('pallu')},{role:'border',image:shot('border')}]);
  assert.deepEqual(fitting.image_urls,['person',shot('drape'),shot('pallu'),shot('border'),'customer-blouse','https://shop.example/jewel.jpg']);
  assert.match(fitting.prompt,/Image 3 is the actual pallu/);
  assert.match(fitting.prompt,/Image 4 is the actual border/);
  assert.match(fitting.prompt,/Image 5 shows the customer’s own blouse/);
  assert.match(fitting.prompt,/Image 6 shows the Silver earrings/);
});
test('garment detail mode needs no styling choices or accessory images', async () => {
  const fitting=await buildStyledInput('person',shot('body'),null,[],'https://shop.example',{},[{role:'border',image:shot('border')}]);
  assert.deepEqual(fitting.image_urls,['person',shot('body'),shot('border')]);
  assert.match(fitting.prompt,/Image 3 is the actual border/);
  assert.match(fitting.prompt,/Keep the jewellery from image 1/);
});
test('live styling drops sample items but preserves chosen SKU ids and empty slots', () => {
  assert.deepEqual(stockStyling({look:'surkh',shoe:'jutti-gold',jewel:'sku-123',blouse:'none'}),
    {look:'surkh',shoe:'none',jewel:'sku-123',blouse:'none'});
});
