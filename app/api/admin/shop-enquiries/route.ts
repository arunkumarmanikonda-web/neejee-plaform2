import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession, requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
async function handle(req:Request,native:boolean){
  const user=await getSession();
  if(!user||!requireRole(user,['ADMIN','SUPER_ADMIN'])) return NextResponse.json({error:'Staff access required.'},{status:user?403:401});
  const origin = req.headers.get('origin');
  const site = req.headers.get('sec-fetch-site');
  if (site === 'cross-site') return NextResponse.json({error:'Invalid request origin.'},{status:403});
  if (origin && !(origin === 'null' && site === 'same-origin')) {
    let sameOrigin = false;
    try {
      const sender = new URL(origin), target = new URL(req.url);
      sameOrigin = sender.origin === target.origin || (sender.host === req.headers.get('host') &&
        (sender.protocol === 'https:' || (process.env.NODE_ENV !== 'production' && sender.protocol === 'http:')));
    } catch {}
    if (!sameOrigin) return NextResponse.json({error:'Invalid request origin.'},{status:403});
  }
  const body=native?await req.formData().then(data=>Object.fromEntries(data)).catch(()=>null):await req.json().catch(()=>null);
  const input=z.object({id:z.string().uuid()}).safeParse(body);
  if(!input.success) return NextResponse.json({error:'Invalid reference.'},{status:400});
  await prisma.$transaction(async tx=>{
    const done=await tx.shopEnquiry.updateMany({where:{id:input.data.id,handledAt:null},data:{handledAt:new Date()}});
    if(done.count) await tx.financeAuditLog.create({data:{action:'UPDATE',entityType:'ShopEnquiry',entityId:input.data.id,userId:user.id,userRole:user.role,changesJson:JSON.stringify({state:'handled'})}});
  });
  return native ? NextResponse.redirect(new URL('/admin/enquiries',req.url),303) : NextResponse.json({ok:true});
}

export function POST(req:Request){return handle(req,true);}
export function PATCH(req:Request){return handle(req,false);}
