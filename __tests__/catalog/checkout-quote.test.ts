import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateCheckoutPricing } from '../../lib/checkout/pricing';

test('shipping quotes apply exact SKU, regional tariff, coupon and payment rules before any order write', async () => {
  const state = globalThis as typeof globalThis & {prisma?: unknown};
  const prior = state.prisma;
  const found = {id:'p1',name:'Saree',status:'ACTIVE',sellingPrice:120000,salePrice:null,codEligible:false,
    variants:[{id:'v1',inventory:4,sellingPrice:100000}]};
  const zone = {id:'z1',name:'Local',active:true,isDefault:false,states:[],pincodeExact:['201301'],
    pincodePrefixes:[],freeAboveSubtotalPaise:250000,standardPaise:4500,expressPaise:7500,inclusive:false};
  const reads = {product:{findMany:async () => [found]},shippingZone:{findMany:async () => [zone]},
    coupon:{findUnique:async () => ({id:'c1',type:'FREE_SHIPPING',active:true})}};
  state.prisma = reads;
  const input = {items:[{productId:'p1',variantId:'v1',quantity:2}],address:{pincode:'201301',state:'UP'},shipping:'EXPRESS' as const};
  try {
    const local=await calculateCheckoutPricing(input,null);
    assert.equal(local.subtotal,200000); assert.equal(local.total,207500);
    assert.deepEqual(local.rates,{STANDARD:4500,EXPRESS:7500}); assert.equal(local.codAvailable,false);
    const waived=await calculateCheckoutPricing({...input,couponCode:'SHIP',giftWrap:true},null);
    assert.deepEqual(waived.rates,{STANDARD:0,EXPRESS:0}); assert.equal(waived.total,215000);
    const free=await calculateCheckoutPricing({...input,items:[{...input.items[0],quantity:3}]},null);
    assert.equal(free.shippingPaise,0); assert.equal(free.total,300000);
    const inclusive=await calculateCheckoutPricing({...input,address:{pincode:'110001',state:'Delhi'}},null);
    assert.deepEqual(inclusive.rates,{STANDARD:15000,EXPRESS:25000});
    await assert.rejects(calculateCheckoutPricing({...input,items:[{...input.items[0],quantity:10}]},null),/Only 4/);
    reads.shippingZone.findMany=async () => { throw new Error('DB timeout'); };
    await assert.rejects(calculateCheckoutPricing(input,null),/DB timeout/);
  } finally { if(prior===undefined) delete state.prisma; else state.prisma=prior; }
});
