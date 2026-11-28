import {NextResponse} from 'next/server';
import {getSession,requireRole} from '@/lib/auth';
import {fast2smsWebhook} from '@/lib/notifications/fast2sms-webhook';
import {prisma} from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export async function POST(request:Request) {
  if(!requireRole(await getSession(),['SUPER_ADMIN'])) return NextResponse.json({error:'Unauthorized'},{status:401});
  if(process.env.VERCEL_ENV !== 'production' || request.headers.get('origin') !== 'https://www.neejee.com' || new URL(request.url).hostname !== 'www.neejee.com') {
    return NextResponse.json({error:'Open production settings at www.neejee.com.'},{status:403});
  }
  try {
    const result = await prisma.$transaction(async tx => {
      const [lock] = await tx.$queryRaw<{locked:boolean}[]>`SELECT pg_try_advisory_xact_lock(719284105) AS locked`;
      if (!lock.locked) return {ok:false,state:'Another registration is running. Check the connection again.'};
      return fast2smsWebhook(true);
    },{timeout:20000});
    return NextResponse.json({message:result.state},{status:result.ok?200:409});
  } catch {return NextResponse.json({error:'Registration could not be confirmed. Check provider connections.'},{status:503});}
}
