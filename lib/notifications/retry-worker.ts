import { orderWhatsAppEnabled, orderWhatsAppPhone } from './order-whatsapp';
import type { PrismaClient } from '@prisma/client';
import type { Channel, ChannelAdapter, DispatchRecord, NotificationEvent } from './types';
import { RETRY_NO_CONFIG, RETRY_RATE_LIMIT, RETRY_REASONS, currentOrderState, retryTime } from './retry-policy';

// A claimed attempt has no automatic replay after a crash. These providers do
// not offer an idempotency key, so an ambiguous submission needs reconciliation.
export async function retryOrderDispatch(
  dispatchId:string, db:Pick<PrismaClient,'order'|'notificationDispatch'>,
  adapters:Partial<Record<Channel,ChannelAdapter|null>>,
) {
  const now = new Date();
  const row = await db.notificationDispatch.findUnique({where:{id:dispatchId}});
  if (!row || row.status !== 'failed' || row.providerRequestId || !row.nextRetryAt || row.nextRetryAt > now
    || !RETRY_REASONS.includes(row.errorMessage || '')) return {ok:false, skipped:'not eligible'};
  const state = currentOrderState(row.event);
  const adapter = adapters[row.channel as Channel];
  const where = {id:row.id,status:'failed',attempt:row.attempt,providerRequestId:null,nextRetryAt:row.nextRetryAt,errorMessage:row.errorMessage};
  const order = row.orderId && state && adapter ? await db.order.findUnique({where:{id:row.orderId},select:{status:true,userId:true,user:{select:{phone:true,whatsappOptIn:true,notificationPref:{select:{whatsappOptIn:true}}}}}}) : null;
  if (row.channel === 'WHATSAPP' && (!orderWhatsAppEnabled() || !row.userId || order?.userId !== row.userId ||
    orderWhatsAppPhone(order?.user) !== row.recipient)) {
    await db.notificationDispatch.updateMany({where,data:{nextRetryAt:null}});
    return {ok:false,skipped:'WhatsApp recipient is no longer eligible'};
  }
  if (!adapter || !order || order.status !== state || row.attempt >= row.maxAttempts || now.getTime() - row.createdAt.getTime() > 24*3600_000) {
    await db.notificationDispatch.updateMany({where,data:{nextRetryAt:null}});
    return {ok:false,skipped:'expired or superseded'};
  }
  const attempt = row.attempt+1;
  const claim = await db.notificationDispatch.updateMany({where,data:{
    status:'queued',attempt,nextRetryAt:null,errorMessage:'Submission in progress. Check the provider receipt before manually resending.',
  }});
  if (claim.count !== 1) return {ok:false,skipped:'already claimed'};
  const finishWhere = {id:row.id,status:'queued',attempt};
  if (!adapter.isConfigured()) {
    await db.notificationDispatch.updateMany({where:finishWhere,data:{status:'failed',errorMessage:RETRY_NO_CONFIG,
      nextRetryAt:retryTime(row.event,RETRY_NO_CONFIG,attempt,row.maxAttempts,Date.now())}});
    return {ok:false,skipped:'provider unavailable'};
  }
  const dispatch: DispatchRecord = {
    id:row.id,channel:row.channel as Channel,event:row.event as NotificationEvent,templateName:row.templateName,
    recipient:row.recipient,userId:row.userId,orderId:row.orderId,cartId:row.cartId,
    variables:(row.payloadJson as Record<string,string>) || {},attempt,maxAttempts:row.maxAttempts,status:'queued',
  };
  const result = await adapter.send(dispatch);
  if (result.ok) {
    await db.notificationDispatch.updateMany({where:finishWhere,data:{status:'sent',sentAt:new Date(),errorMessage:null,
      providerRequestId:result.providerRequestId || null,providerResponseJson:result.providerResponse as any}});
    return {ok:true};
  }
  const reason = result.rateLimited ? RETRY_RATE_LIMIT : undefined;
  await db.notificationDispatch.updateMany({where:finishWhere,data:{status:'failed',errorMessage:reason || result.errorMessage,
    providerResponseJson:result.providerResponse as any,nextRetryAt:retryTime(row.event,reason,attempt,row.maxAttempts,Date.now(),result.retryAfterMs)}});
  return {ok:false};
}
