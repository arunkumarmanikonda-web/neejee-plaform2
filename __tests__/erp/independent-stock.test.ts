import assert from 'node:assert/strict';
import { describe,it } from 'node:test';
import { parseStockSheet,stockSheetHeader } from '../../lib/erp/reconciliation/stock-sheet';
import { readStockFeed } from '../../lib/erp/reconciliation/feed';

describe('independent stock feed',()=>{
  const csv=stockSheetHeader+'\n"n-42",ACTIVE,4999,4200.50,3';
  it('converts rupees into paise and normalises SKU identity',()=>{
    const rows=parseStockSheet('\uFEFF'+csv,'2026-01-01');
    assert.equal(rows[0].sku,'N-42');
    assert.equal(rows[0].sellingPricePaise,420050);
  });
  it('rejects duplicate identity, incomplete rows and invalid quantities',()=>{
    for(const invalid of [csv+'\nN-42,DRAFT,5,5,1',stockSheetHeader+'\nABC,ACTIVE,5,5,-1',stockSheetHeader+'\nABC,ACTIVE,10,5']) assert.throws(()=>parseStockSheet(invalid,''));
  });
  it('reads a dated feed using the configured transport and credentials', async t=>{
    t.mock.method(globalThis,'fetch',async (url:URL,init:RequestInit)=>{
      assert.equal(url.protocol,'https:');assert.equal(init.redirect,'error');
      assert.equal(new Headers(init.headers).get('authorization'),'Bearer fixture');
      return new Response(csv,{headers:{'Last-Modified':'Fri, 20 Nov 2026 10:00:00 GMT'}});
    });
    const rows=await readStockFeed('https://fixture.invalid/stock.csv','fixture');
    assert.equal(rows[0].updatedAt,'2026-11-20T10:00:00.000Z');
  });
  it('rejects unencrypted feeds before requesting data',async()=>{
    await assert.rejects(()=>readStockFeed('http://fixture.invalid/stock.csv'),/HTTPS/);
  });
});
