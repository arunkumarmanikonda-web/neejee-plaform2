import assert from 'node:assert/strict';
import {test} from 'node:test';
import {issueSellerPhoneVerificationProof, SELLER_PHONE_VERIFICATION_COOKIE, verifySellerPhoneVerificationProof} from '../../lib/seller-onboarding/phone-verification';
import {requireIntakeAccess} from '../../lib/seller-onboarding/intake-access';

test('seller intake requires a signed verification cookie before processing onboarding data',async t=>{
  const previous=process.env.AUTH_SECRET;
  process.env.AUTH_SECRET='isolated-test-signing-key-for-seller-proof';
  t.after(()=>{if(previous===undefined) delete process.env.AUTH_SECRET; else process.env.AUTH_SECRET=previous;});
  const request=(value?:string)=>new Request('https://example.test/apply',{headers:value?{cookie:SELLER_PHONE_VERIFICATION_COOKIE+'='+value}:{}});
  assert.equal((await requireIntakeAccess(request()))?.status,401);
  assert.equal((await requireIntakeAccess(request('invalid')))?.status,401);
  const {token}=issueSellerPhoneVerificationProof('9000000000');
  assert.equal(await requireIntakeAccess(request(token)),null);
  assert.equal(verifySellerPhoneVerificationProof(token,'9000000001').ok,false);
});
