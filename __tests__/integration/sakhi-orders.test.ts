import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { orderQuestion, answerOrder } from '../../lib/sakhi-orders';
import { styleBrief } from '../../lib/sakhi-advice';

test('Sakhi separates personal order questions, general policy and style preferences', async () => {
  assert.equal(orderQuestion('What is your return policy?', 'NEE-EXAMPLE1'), null);
  assert.equal(orderQuestion('mera order kahan hai')?.number, undefined);
  assert.ok(orderQuestion('मेरा ऑर्डर कहाँ है?'));
  assert.equal(orderQuestion('Was it shipped?', 'NEE-EXAMPLE1')?.number,'NEE-EXAMPLE1');
  assert.equal(orderQuestion('where is NEE-OTHER123?', 'NEE-EXAMPLE1')?.number,'NEE-OTHER123');
  const reply=await answerOrder(undefined,orderQuestion('Where is my order?')!, async()=>{throw Error('Guest lookup attempted');});
  assert.ok(reply.links.some(link=>link.href==='/help/track'));
  assert.deepEqual(styleBrief('what jewellery goes with a green silk saree for a wedding?'),{topic:'jewellery',colour:'green',fabric:'silk',occasion:'wedding',language:'English'});
});

const origin=process.env.NEEJEE_LOCAL_COD_TEST_URL;
test('signed-in Sakhi reads the shopper’s order and a guest receives the verification link', {skip:!origin},async()=>{
  const local=(url:string)=>['127.0.0.1','localhost','[::1]'].includes(new URL(url).hostname);
  assert.ok(local(origin!) && local(process.env.DATABASE_URL!));
  const db=new PrismaClient(), marker=randomUUID(), email='sakhi-'+marker+'@example.test', password=randomUUID();
  const number='NEE-'+marker.slice(0,8).toUpperCase();
  try {
    const customer=await db.user.create({data:{email,passwordHash:await bcrypt.hash(password,4)}});
    await db.order.create({data:{userId:customer.id,orderNumber:number,total:432100,subtotal:432100,status:'SHIPPED',paymentStatus:'PAID',courier:'Fixture courier'}});
    const post=async(path:string,body:object,cookie='')=>fetch(origin+path,{method:'POST',headers:{'Content-Type':'application/json',cookie},body:JSON.stringify(body)});
    const session=await post('/api/auth/login',{email,password});
    assert.equal(session.status,200);
    const cookie=session.headers.getSetCookie().find(value=>value.startsWith('neejee-session='))?.split(';')[0];
    assert.ok(cookie);
    const mine=await (await post('/api/pitari',{message:'Where is my order?'},cookie)).json();
    assert.equal(mine.order,number);
    assert.match(mine.text,/Fixture courier/);
    assert.match(mine.text,/₹4,321/);
    const guest=await (await post('/api/pitari',{message:'Where is my order?',order:number})).json();
    assert.equal(guest.order,undefined);
    assert.ok(guest.links.some((link:{href:string})=>link.href==='/help/track'));
    const other=await db.user.create({data:{email:'other-'+email}});
    const second='NEE-'+randomUUID().slice(0,8).toUpperCase();
    await db.order.create({data:{userId:other.id,orderNumber:second,total:123400,subtotal:123400}});
    const missing=await (await post('/api/pitari',{message:'Where is '+second+'?'},cookie)).json();
    assert.equal(missing.order,undefined);
    assert.match(missing.text,/couldn’t find/);
  } finally {
    const customerEmails=[email,'other-'+email];
    await db.order.deleteMany({where:{user:{email:{in:customerEmails}}}});
    await db.user.deleteMany({where:{email:{in:customerEmails}}});
    await db.$disconnect();
  }
});
