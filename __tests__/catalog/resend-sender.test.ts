import test from 'node:test';
import assert from 'node:assert/strict';
import { verifiedSender,sendingState,senderDomain } from '../../lib/resend-sender';

test('Resend uses the configured verified domain or a verified Neejee domain',()=>{
  const valid={status:'partially_verified',capabilities:{sending:'enabled'}};
  const options=[{...valid,name:'another-shop.test'},{...valid,name:'notneejee.com'},{...valid,name:'mail.neejee.com'}];
  assert.equal(senderDomain('NEEJEE <hello@neejee.com>'),'neejee.com');
  assert.equal(verifiedSender(options,'neejee.com'),'mail.neejee.com');
  assert.equal(verifiedSender(options.slice(0,2),'neejee.com'),undefined);
  assert.match(sendingState([{name:'neejee.com',status:'pending'}],'neejee.com'),/pending/);
  assert.equal(verifiedSender([{...valid,name:'neejee.com',capabilities:{sending:'disabled'}}],'neejee.com'),undefined);
});
