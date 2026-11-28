import {NextResponse} from 'next/server';
import {getSession,requireRole} from '@/lib/auth';
import {prisma} from '@/lib/prisma';

export const dynamic='force-dynamic';
export async function POST(req:Request) {
  if(!requireRole(await getSession(),['ADMIN','SUPER_ADMIN'])) return NextResponse.json({error:'Unauthorized'},{status:401});
  if(req.headers.get('origin')!==new URL(req.url).origin) return NextResponse.json({error:'Open the SMS settings page.'},{status:403});
  const body=await req.json().catch(()=>null);
  if(typeof body?.id!=='string') return NextResponse.json({error:'Choose a test message.'},{status:400});
  const log=await prisma.notificationLog.findFirst({where:{id:body.id,channel:'SMS',contextType:'ADMIN_TEST'},select:{id:true,providerId:true,status:true,recipient:true}});
  if(!log?.providerId) return NextResponse.json({error:'No provider reference for this test.'},{status:404});
  if(log.status==='DELIVERED' || log.status==='FAILED') return NextResponse.json({message:'Recorded delivery status: '+log.status});
  try {
    const response=await fetch('https://www.fast2sms.com/dev/dlr/'+encodeURIComponent(log.providerId),{
      headers:{authorization:process.env.FAST2SMS_API_KEY || ''},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(7000)});
    const data=await response.json();
    const group=Array.isArray(data?.data)?data.data.find((g:any)=>g.request_id===log.providerId):null;
    const report=Array.isArray(group?.delivery_status)?group.delivery_status.find((r:any)=>String(r.mobile).replace(/^91(?=\d{10}$)/,'')===log.recipient):null;
    const status=String(report?.status || '').toUpperCase();
    if(!response.ok || !['DELIVERED','FAILED','SENT'].includes(status)) return NextResponse.json({message:'No matching delivery report is available yet.'});
    if(status!=='SENT') await prisma.notificationLog.updateMany({where:{id:log.id,status:'SENT'},data:{status:status as 'DELIVERED'|'FAILED',
      ...(status==='DELIVERED'?{deliveredAt:new Date()}:{errorMessage:report.status_description || 'Provider reported failed delivery'})}});
    return NextResponse.json({message:'Fast2SMS delivery report: '+status});
  } catch {return NextResponse.json({error:'The Fast2SMS delivery report is unavailable.'},{status:503});}
}
