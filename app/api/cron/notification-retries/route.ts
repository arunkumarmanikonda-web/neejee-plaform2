import { NextResponse } from 'next/server';
import { cronAuthorized } from '@/lib/cron/authorize';
import { prisma } from '@/lib/prisma';
import { retryDispatch } from '@/lib/notifications/dispatcher';
import { RETRY_REASONS } from '@/lib/notifications/retry-policy';

export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=60;

export async function GET(request:Request) {
  if (!cronAuthorized(request)) return NextResponse.json({error:'Unauthorized'},{status:401});
  const rows = await prisma.notificationDispatch.findMany({
    where:{status:'failed',errorMessage:{in:RETRY_REASONS},nextRetryAt:{lte:new Date()},providerRequestId:null},
    select:{id:true},orderBy:[{nextRetryAt:'asc'},{id:'asc'}],take:8,
  });
  const results = await Promise.allSettled(rows.map(row => retryDispatch(row.id)));
  const failed=results.filter(r=>r.status==='rejected').length;
  const sent=results.filter(r=>r.status==='fulfilled' && r.value.ok).length;
  return NextResponse.json({examined:rows.length,sent,failed}, {status:failed ? 503 : 200});
}
