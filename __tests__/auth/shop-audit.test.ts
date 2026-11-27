import test from 'node:test';
import assert from 'node:assert/strict';
import { canOpenAdminPage } from '../../lib/admin/shop-access';
import { catalogImageType } from '../../lib/admin/image-format';
import { hasValidPrivilegedAssurance } from '../../lib/auth';

test('shop sections match staff duties and reject ordinary shoppers',()=>{
  assert.equal(canOpenAdminPage('CUSTOMER','/admin'),false);
  assert.equal(canOpenAdminPage('CONTENT_EDITOR','/admin/inventory'),true);
  assert.equal(canOpenAdminPage('CONTENT_EDITOR','/admin/enquiries'),false);
  assert.equal(canOpenAdminPage('FINANCE_OPERATOR','/admin/finance/returns'),true);
  assert.equal(canOpenAdminPage('FINANCE_OPERATOR','/admin/team'),false);
  assert.equal(canOpenAdminPage('MARKETING_MANAGER','/admin/products'),true);
  assert.equal(canOpenAdminPage('MARKETING_MANAGER','/admin/products/new'),false);
  assert.equal(canOpenAdminPage('SUPER_ADMIN','/admin/enquiries'),true);
});

test('catalogue signature checks recognise still and animated photo formats',()=>{
  assert.equal(catalogImageType(Buffer.from('89504e470d0a1a0a0000000d','hex')),'image/png');
  assert.equal(catalogImageType(Buffer.from('RIFFxxxxWEBPVP8 ')),'image/webp');
  assert.equal(catalogImageType(Buffer.from('GIF89a123456')),'image/gif');
  assert.equal(catalogImageType(Buffer.from('00000018667479706d69663100000000617669666d696631','hex')),'image/avif');
  assert.equal(catalogImageType(Buffer.from('incomplete')),null);
});
test('a future verification time cannot extend staff access',()=>{
  assert.equal(hasValidPrivilegedAssurance({id:'staff',email:'qa@example.invalid',role:'ADMIN',amr:['password','otp'],aal:'aal2',mfaVerifiedAt:new Date(Date.now()+3600000).toISOString()}),false);
});
