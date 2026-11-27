import test from 'node:test';
import assert from 'node:assert/strict';
import { sellerFileUrl, sellerInventoryPath, sellerDocumentType } from '../../lib/seller-private-files';

test('an inventory document reference resolves only in the submitting studio',()=>{
  const path='seller-inventory-files/studio-one/receipt.csv';
  assert.equal(sellerInventoryPath(sellerFileUrl(path),'studio-one'),path);
  assert.equal(sellerInventoryPath(sellerFileUrl(path),'studio-two'),null);
  assert.equal(sellerInventoryPath('https://example.invalid/inventory.csv','studio-one'),null);
});

test('seller intake accepts a PDF signature and separates catalogue image and document formats',()=>{
  assert.equal(sellerDocumentType(Buffer.from('%PDF-1.7\n')),'application/pdf');
  assert.equal(sellerDocumentType(Buffer.from('name,sku,mrp\n')),null);
});
