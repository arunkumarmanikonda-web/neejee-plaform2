import { test } from 'node:test';
import assert from 'node:assert/strict';
import Module from 'node:module';
import type { ParsedRow } from '../../lib/inventory-io';
import { workbookColours } from '../../lib/catalog/workbook-colours';

test('admin and seller create routes persist the narrative and its evidence together', async t => {
  const saved:Array<Record<string, any>>=[];
  const notes:Array<Record<string, any>>=[];
  const tx={
    product:{create:async ({data}:any)=>{const item={...data,id:'piece-'+(saved.length+1)};saved.push(item);return item;}},
    cmsPage:{create:async ({data}:any)=>{notes.push(data);return data;}},
  };
  const db={
    category:{findUnique:async()=>({name:'Sarees',path:'women/sarees'})},
    product:{findUnique:async()=>null},
    $transaction:async (operation:Function)=>operation(tx),
  };
  const prototype=Module.prototype as unknown as {require:(id:string)=>any};
  const original=prototype.require;
  const editor={id:'editor',role:'CONTENT_EDITOR'};
  t.mock.method(prototype,'require',function(this:Module,id:string) {
    if(id==='@/lib/auth') return {getSession:async()=>editor,requireRole:()=>true};
    if(id==='@/lib/seller-context') return {requireApprovedSeller:async()=>({ok:true,seller:{id:'seller',slug:'seller',region:'Unrelated office town',contactName:'Office contact'}})};
    if(id==='@/lib/agreement-upload-guard')return {getSellerAgreementUploadGate:async()=>({blocked:false})};
    if(id==='@/lib/ai')return {aiTextConfigured:()=>false};
    if(id==='@/lib/prisma')return {prisma:db};
    return original.call(this,id);
  });
  const admin=require('../../app/api/admin/products/route').POST;
  const seller=require('../../app/api/seller/products/route').POST;
  const brief={name:'Haldi',categoryId:'sarees',sku:'TEST-1',mrp:560000,sellingPrice:560000,
    pieceFacts:{colour:'Turmeric',border:'maroon temple border',pallu:'narrow gold stripes',designReference:'Temple borders of Kanchipuram'}};
  const request=(input:object)=>new Request('http://shop.test/products',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
  for(const handler of [admin,seller]) {
    const response=await handler(request(brief));
    const {product,error}=await response.json();
    assert.ok(response.ok,error);
    assert.equal(product.name,'Turmeric saree with a maroon temple border');
    assert.equal(product.shortName,'Haldi');
    assert.match(product.poeticLine,/maroon temple border/i);
    assert.match(product.description,/pallu/i);
    assert.ok(!product.region && !product.artisanName);
    assert.equal(notes.at(-1)?.slug,'piece-notes-'+product.id);
    assert.deepEqual(notes.at(-1)?.sections,brief.pieceFacts);
  }
  assert.equal(saved[1].status,'PENDING_QC');
  const response=await admin(request({...brief,keepTitle:true,poeticLine:'Selected card copy.',description:'Wording approved by the editor.'}));
  const {product}=await response.json();
  assert.equal(product.name,'Haldi');
  assert.equal(product.poeticLine,'Selected card copy.');
  assert.equal(product.description,'Wording approved by the editor.');
});

test('workbook drafts only use colours from the matching product',()=>{
  const rows:ParsedRow[]=[
    {rowIndex:2,rowType:'PRODUCT',data:{sku:'A'},errors:[]},
    {rowIndex:3,rowType:'VARIANT',data:{variantColor:'Indigo'},errors:[]},
    {rowIndex:4,rowType:'PRODUCT',data:{sku:'B'},errors:[]},
    {rowIndex:5,rowType:'VARIANT',data:{variantColor:'Wine'},errors:[]},
    {rowIndex:6,rowType:'VARIANT',data:{parentSku:'A',variantColor:'Ivory'},errors:[]},
  ];
  assert.deepEqual([...workbookColours(rows)],[[2,['Indigo','Ivory']],[4,['Wine']]]);
});
