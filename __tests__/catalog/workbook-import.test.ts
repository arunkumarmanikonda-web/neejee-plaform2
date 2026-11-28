import { test } from 'node:test';
import assert from 'node:assert/strict';
import Module from 'node:module';
import ExcelJS from 'exceljs';
import { buildTemplateWorkbook, IMPORT_COLUMNS, parseInventoryWorkbook } from '../../lib/inventory-io';

const cells = (input:Record<string,string|number>) => IMPORT_COLUMNS.map(c=>input[c.key] ?? '');
async function filledTemplate(rows: Record<string,string|number>[]) {
  const book=new ExcelJS.Workbook();
  await book.xlsx.load(await buildTemplateWorkbook() as any);
  const sheet=book.getWorksheet('Products')!;
  for (const row of rows) sheet.addRow(cells(row));
  return Buffer.from(await book.xlsx.writeBuffer());
}

test('a blank current or unmodified legacy template imports no examples, and real sparse clothing rows survive',async()=>{
  assert.deepEqual(await parseInventoryWorkbook(await buildTemplateWorkbook()),[]);
  const old=new ExcelJS.Workbook();
  await old.xlsx.load(await buildTemplateWorkbook() as any);
  const sheet=old.getWorksheet('Products')!;
  sheet.addRow(IMPORT_COLUMNS.map(c=>c.example || '')).font={italic:true};
  for(const [size,stock] of [['S',3],['M',5],['L',2]] as const) sheet.addRow(cells({rowType:'VARIANT',variantSize:size,variantInventory:stock})).font={italic:true};
  assert.deepEqual(await parseInventoryWorkbook(Buffer.from(await old.xlsx.writeBuffer())),[]);
  sheet.getRow(14).values=cells({rowType:'PRODUCT',name:'Banarasi Katan silk saree',category:'sarees',mrp:1000,sellingPrice:900});
  sheet.getRow(16).values=cells({rowType:'VARIANT',variantSize:'S',variantInventory:7});
  sheet.getRow(18).values=cells({rowType:'VARIANT',variantSize:'M',variantInventory:'invalid'});
  const parsed=await parseInventoryWorkbook(Buffer.from(await old.xlsx.writeBuffer()));
  assert.deepEqual(parsed.map(r=>r.rowIndex),[14,16,18]);
  assert.equal(parsed[1].data.variantInventory,7);
  assert.ok(parsed[2].errors.some(s=>s.includes('Stock')));
});

test('inventory upload keeps S/M/L stock, isolates rejected parents, resolves explicit links and replays safely',async t=>{
  const products: any[]=[{id:'existing',sku:'TAKEN',name:'Existing'}], variants:any[]=[];
  const repo=(rows:any[])=>({
    findFirst:async({where}:any)=>rows.find(r=>Object.entries(where).every(([k,v])=>r[k]===v))||null,
    findUnique:async({where}:any)=>rows.find(r=>Object.entries(where).every(([k,v])=>r[k]===v))||null,
    create:async({data}:any)=>{if(rows.some(r=>r.id===data.id||r.sku===data.sku))throw Object.assign(Error('duplicate'),{code:'P2002'});rows.push(data);return data;},
  });
  const mocks:Record<string,any>={
    '@/lib/auth':{getSession:async()=>({role:'SUPER_ADMIN'}),requireRole:()=>true},
    '@/lib/prisma':{prisma:{product:repo(products),variant:repo(variants),category:{findMany:async()=>[{id:'cat',slug:'suits',name:'Suits'}]}}},
    '@/lib/catalog/narrative-service':{draftMerchandise:async(input:any)=>({draft:{name:input.name}})},
    '@/lib/sku':{generateSlug:async(name:string)=>name.toLowerCase()},
    '@/lib/taxonomy/resolver':{generateSkuFor:async()=>'NEW-AUTO'},
  };
  const proto=Module.prototype as unknown as {require:(id:string)=>any},original=proto.require;
  t.mock.method(proto,'require',function(this:Module,id:string){return Object.hasOwn(mocks,id)?mocks[id]:original.call(this,id);});
  const {POST}=require('../../app/api/admin/products/import/route');
  const product=(name:string,sku:string,mrp:number)=>({rowType:'PRODUCT',name,sku,category:'suits',mrp,sellingPrice:900});
  const variant=(size:string,stock:number,parentSku='')=>({rowType:'VARIANT',variantSize:size,variantInventory:stock,parentSku});
  const bytes=await filledTemplate([variant('XS',1,'FIRST'),product('First','FIRST',1000),variant('S',3),variant('M',5),variant('L',2),
    product('Invalid','BAD',0),variant('WRONG',99),product('Collision','TAKEN',1000),variant('WRONG2',99,'TAKEN'),product('Other','',1000),variant('XL',4)]);
  const upload=async()=>{const form=new FormData();form.set('file',new File([Uint8Array.from(bytes)],'stock.xlsx'));return (await POST(new Request('http://example.test',{method:'POST',body:form}))).json();};
  const first=await upload();
  assert.equal(first.summary.productsCreated,2);assert.equal(first.summary.variantsCreated,5);assert.equal(first.summary.errored,4);
  const parent=products.find(p=>p.sku==='FIRST');
  assert.deepEqual(variants.filter(v=>v.productId===parent.id).map(v=>[v.size,v.inventory]),[['XS',1],['S',3],['M',5],['L',2]]);
  assert.equal(variants.some(v=>v.productId==='existing'),false);
  assert.ok(products.filter(p=>p.id!=='existing').every(p=>p.status==='DRAFT'));
  const replay=await upload();
  assert.equal(replay.summary.productsCreated,0);assert.equal(replay.summary.variantsCreated,0);
  assert.equal(products.length,3);assert.equal(variants.length,5);
});
