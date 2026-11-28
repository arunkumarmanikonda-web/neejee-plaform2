import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getSession, requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { aisensyAdapter } from '@/lib/notifications/channels/aisensy';
import { orderWhatsAppEnabled } from '@/lib/notifications/order-whatsapp';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!requireRole(await getSession(), ['SUPER_ADMIN'])) return NextResponse.json({error:'Unauthorized'}, {status:403});
  if (req.headers.get('origin') !== new URL(req.url).origin) return NextResponse.json({error:'Open this test from store settings.'}, {status:403});
  if (!orderWhatsAppEnabled()) return NextResponse.json({error:'AiSensy order notifications are disabled or missing a campaign key.'}, {status:503});

  const body = await req.json().catch(()=>null);
  const digits = String(body?.phone || '').replace(/[\s()+-]/g,'');
  const recipient = /^[6-9]\d{9}$/.test(digits) ? '91'+digits : digits;
  if (!/^91[6-9]\d{9}$/.test(recipient)) return NextResponse.json({error:'Enter a valid Indian mobile number.'}, {status:400});

  // Never repeat an ambiguous submission on refresh or a double click.
  const day = new Date().toISOString().slice(0,10);
  const id = 'wa_test_' + createHash('sha256').update(day+':'+recipient).digest('hex');
  const variables = {firstName:'Neejee tester', orderNumber:'TEST-NEEJEE', itemsSummary:'Test message only (no purchase)', totalRupees:'0', paymentMethod:'Test only'};
  const claim = await prisma.notificationDispatch.createMany({data:[{
    id,channel:'WHATSAPP',event:'ADMIN_WHATSAPP_TEST',templateName:'order_placed',recipient,
    payloadJson:variables,status:'queued',attempt:1,maxAttempts:1,
  }],skipDuplicates:true});
  if (!claim.count) {
    const previous = await prisma.notificationDispatch.findUnique({where:{id},select:{status:true}});
    return NextResponse.json({message:'A test is already recorded for this number today. Current status: '+(previous?.status || 'unknown')+'.'});
  }

  const result = await aisensyAdapter.send({id,channel:'WHATSAPP',event:'ORDER_PLACED',templateName:'order_placed',recipient,variables,status:'queued',attempt:1});
  if (!result.ok) {
    await prisma.notificationDispatch.update({where:{id},data:{status:'failed',errorMessage:result.errorMessage || 'Submission unconfirmed'}});
    return NextResponse.json({error:'AiSensy did not confirm the test. Check the campaign key and live status.'},{status:502});
  }
  await prisma.notificationDispatch.update({where:{id},data:{status:'sent',providerRequestId:result.providerRequestId || null,sentAt:new Date()}});
  return NextResponse.json({message:'AiSensy accepted the test. Check the order_placed campaign report for delivery.'});
}
