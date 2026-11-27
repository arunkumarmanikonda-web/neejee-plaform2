import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateInvoiceAmounts } from '../../lib/finance/checkout-tax';
import { postOrderToInvoice } from '../../lib/finance/post-order';
import { invalidateIssuerCache } from '../../lib/finance/legal-entity';

test('captured order, posted invoice, nested payment and GST ledger reconcile exactly; repeated posting uses the issued record', async () => {
  const globalDb = globalThis as typeof globalThis & {prisma?: unknown};
  const previousDb = globalDb.prisma;
  const previousState = process.env.NEEJEE_STATE_CODE;
  process.env.NEEJEE_STATE_CODE = '09';
  const dated = new Date('2026-06-01T00:00:00Z');
  const items = [{productId:'saree',variantId:'red',quantity:2,price:10500,total:21000,gstRate:5,hsnCode:'EXAMPLE'}];
  const snapshot = {version:1,items,shipping:{amount:1180,gstRate:18,hsnCode:null},wrap:{amount:1500,gstRate:5,hsnCode:null},coupon:123,points:456,total:23101};
  const order = {id:'o',orderNumber:'example',userId:'u',subtotal:21000,total:23101,discount:123,pointsValue:456,shipping:1180,
    giftWrap:true,tax:calculateInvoiceAmounts(snapshot).tax,checkoutTaxSnapshot:snapshot,createdAt:dated,updatedAt:dated,
    paymentStatus:'PAID',paymentMethod:'RAZORPAY',address:{country:'IN',state:'Uttar Pradesh'},
    items:items.map(line=>({...line,product:{id:line.productId,name:'A saree',gstRate:18,hsnCode:'CHANGED',updatedAt:dated}}))};
  let numberCount=0;
  let invoice:any=null;
  let ledger:Array<{type:string;amountPaise:number}>=[];
  globalDb.prisma={
    order:{findUnique:async()=>order},
    legalEntity:{findUnique:async()=>({country:'India',state:'UP',gstin:'09ABCDE1234F1Z0'})},
    purchaseCost:{findMany:async()=>[]}, customer:{findUnique:async()=>({id:'c'})},
    invoiceNumberCounter:{upsert:async()=>({lastValue:++numberCount})},periodLock:{findUnique:async()=>null},
    salesInvoice:{
      findUnique:async()=>invoice,
      create:async({data}:any)=>{invoice={...data,lines:data.lines.create};return invoice;},
      update:async({data}:any)=>{Object.assign(invoice,data);return invoice;},
    },
    revenueEntry:{createMany:async({data}:any)=>{ledger=data;return {count:data.length};}},
  };
  try {
    invalidateIssuerCache();
    const created=await postOrderToInvoice(order.id);
    assert.equal(created.totalPaise,23101);assert.equal(invoice.totalPaise,order.total);
    assert.equal(invoice.paidPaise,order.total);assert.equal(invoice.payments.create.amountPaise,order.total);
    assert.equal(invoice.lines.reduce((s:number,l:any)=>s+l.totalPaise,0),order.total);
    assert.equal(invoice.cgstPaise+invoice.sgstPaise,order.tax);assert.equal(invoice.igstPaise,0);
    assert.equal(invoice.lines[0].gstRatePercent,5);assert.equal(invoice.lines[0].hsnSac,'EXAMPLE');
    assert.equal(ledger.reduce((s,l)=>s+l.amountPaise,0),order.total);
    assert.ok(ledger.some(entry=>entry.type==='SHIPPING_REVENUE'));
    assert.ok(ledger.some(entry=>entry.type==='DISCOUNT'&&entry.amountPaise<0));
    order.address.state='Maharashtra';order.tax=0;
    const again=await postOrderToInvoice(order.id);
    assert.equal(again.alreadyExisted,true);assert.equal(numberCount,1);assert.equal(invoice.placeOfSupply,'09');
    invoice=null;
    await assert.rejects(postOrderToInvoice(order.id),/recorded GST disagree/);assert.equal(numberCount,1);
    order.tax=calculateInvoiceAmounts(snapshot).tax;order.paymentStatus='PENDING';order.paymentMethod='COD';
    await postOrderToInvoice(order.id);
    assert.equal(invoice.paidPaise,0);assert.equal(invoice.payments,undefined);assert.equal(invoice.igstPaise,order.tax);
    assert.equal(invoice.cgstPaise+invoice.sgstPaise,0);assert.equal(invoice.totalPaise,order.total);
  } finally {
    invalidateIssuerCache();
    if(previousDb===undefined) delete globalDb.prisma;else globalDb.prisma=previousDb;
    if(previousState===undefined) delete process.env.NEEJEE_STATE_CODE;else process.env.NEEJEE_STATE_CODE=previousState;
  }
});
