import test from 'node:test';
import assert from 'node:assert/strict';
import { shopHelp } from '../../lib/sakhi-help';
import { faqs } from '../../lib/shop-faq';
test('Sakhi uses the same customer-facing answers as the FAQ',()=>{
  assert.equal(shopHelp('Can you ship to the UK?')?.text,faqs.find(f=>f.key==='international')?.a);
  assert.equal(shopHelp('What is your return policy?')?.links[0].href,'/help/returns');
  assert.equal(shopHelp('Show me a Bandhani saree'),null);
});
