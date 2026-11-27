import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHttpAdapter,ErpReadError} from '../../lib/erp/adapter/http';
import {erpSourceSummary} from '../../lib/erp/adapter/resolver';
const origin='https://bridge.example', token='fixture-token', date='2026-11-27T12:00:00Z';
const row=(sku:string)=>({id:'id-'+sku,sku,slug:'piece-'+sku,name:'Piece',sellerId:null,status:'ACTIVE',currency:'INR',pricePaise:1200,updatedAt:date});
const json=(value:unknown)=>Response.json(value);

test('explicit credentials are required and config status never implies a successful live call',()=>{
  for(const value of ['http://bridge.example','https://name:secret@bridge.example','https://bridge.example/path','https://bridge.example?code=private']){
    assert.throws(()=>createHttpAdapter(value,token),err=>err instanceof ErpReadError && !err.message.includes('secret'));
  }
  assert.throws(()=>createHttpAdapter(origin),/ERP_API_TOKEN/);
  assert.match(erpSourceSummary({}),/Demo/);
  assert.match(erpSourceSummary({ERP_ADAPTER:'real'}),/incomplete/);
  assert.match(erpSourceSummary({ERP_ADAPTER:'real',ERP_API_ORIGIN:origin,ERP_API_TOKEN:token}),/verify a live/);
  assert.match(erpSourceSummary({ERP_STOCK_FEED_URL:origin}),/stock feed/);
});

test('gets authenticated bounded pages, includes filters and follows only an opaque cursor',async()=>{
  const requests:URL[]=[];
  const adapter=createHttpAdapter(origin,token,async(input,init)=>{
    const url=new URL(String(input)); requests.push(url);
    assert.equal(url.origin,origin); assert.equal(url.pathname,'/v1/products');
    assert.equal(init?.method,'GET'); assert.equal(init?.redirect,'error'); assert.equal(new Headers(init?.headers).get('authorization'),'Bearer '+token);
    return json(requests.length===1?{items:[{...row('A'),sellerId:'one'}],nextCursor:'https://other.example?token=x'}:{items:[{...row('B'),sellerId:'one'}],nextCursor:null});
  });
  assert.deepEqual((await adapter.listProducts({sellerId:'one',status:'ACTIVE'})).map(r=>r.sku),['A','B']);
  assert.equal(requests[1].searchParams.get('cursor'),'https://other.example?token=x');assert.equal(requests[0].searchParams.get('sellerId'),'one');
});

test('looks up exact product, stock, prices, sales orders, purchase orders and sellers',async()=>{
  const a=createHttpAdapter(origin,token,async(input)=>{
    const u=new URL(String(input)),sku=u.searchParams.get('sku') ?? 'A';
    switch(u.pathname){
      case '/v1/product':return json(row(sku));
      case '/v1/stock':return json({sku,inStock:true,availableQuantity:3,reservedQuantity:1,updatedAt:date});
      case '/v1/price':return json({sku,currency:'INR',mrpPaise:1200,sellingPricePaise:1100,effectivePricePaise:1100,onSale:true,updatedAt:date});
      case '/v1/sales-order':return json({id:'one',orderNumber:u.searchParams.get('orderNumber'),sellerId:null,status:'CONFIRMED',currency:'INR',totalPaise:500,placedAt:date,updatedAt:date,lines:[{sku,quantity:1,unitPricePaise:500,totalPricePaise:500}]});
      case '/v1/purchase-order':return json({id:'one',poNumber:u.searchParams.get('poNumber'),vendorCode:'vendor',status:'RECEIVED',currency:'INR',totalPaise:300,issuedAt:date,updatedAt:date,lines:[{sku,quantity:1,unitCostPaise:300,totalCostPaise:300}]});
      case '/v1/sellers':return json({items:[{id:'seller',code:'s',name:'A',status:'ACTIVE',updatedAt:date}],nextCursor:null});
      default:throw Error('unexpected request');
    }
  });
  assert.equal((await a.getProductBySku(' a/1?x= '))?.sku,'A/1?X=');
  assert.equal((await a.getStockBySku('a'))?.availableQuantity,3);
  assert.equal((await a.getPriceBySku('a'))?.effectivePricePaise,1100);
  assert.equal((await a.getSalesOrder('so-100'))?.orderNumber,'SO-100');
  assert.equal((await a.getPurchaseOrder('po-100'))?.lines[0].unitCostPaise,300);
  assert.equal((await a.listSellers())[0].id,'seller');
});

test('validates identity and payloads, distinguishes missing items, and redacts upstream errors',async()=>{
  const adapter=(code:number)=>createHttpAdapter(origin,token,async()=>new Response('provider debug '+token,{status:code}));
  assert.equal(await adapter(404).getProductBySku('missing'),null);
  for(const code of [401,403,429,503]){
    await assert.rejects(()=>adapter(code).listSellers(),err=>err instanceof ErpReadError && err.status===code && err.retryable===(code>=429) && !err.message.includes(token));
  }
  const malformed=createHttpAdapter(origin,token,async()=>json(row('wrong')));
  await assert.rejects(()=>malformed.getProductBySku('correct'),/invalid or incomplete/);
  await assert.rejects(()=>malformed.getStockBySku('wrong'),/invalid or incomplete/);
  const repeat=createHttpAdapter(origin,token,async()=>json({items:[],nextCursor:'same'}));
  await assert.rejects(()=>repeat.listProducts(),/invalid or incomplete/);
  const secretFailure=createHttpAdapter(origin,token,async()=>{throw Error(token);});
  await assert.rejects(()=>secretFailure.listProducts(),err=>err instanceof ErpReadError && err.retryable && !err.message.includes(token));
});
