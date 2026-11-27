import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession, requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
export async function PATCH(req:Request){
  const user=await getSession();
  if(!user||!requireRole(user,['ADMIN','SUPER_ADMIN'])) return NextResponse.json({error:'Staff access required.'},{status:user?403:401});
  const input=z.object({id:z.string().uuid()}).safeParse(await req.json().catch(()=>null));
  if(!input.success) return NextResponse.json({error:'Invalid reference.'},{status:400});
  await prisma.$transaction(async tx=>{
    const done=await tx.shopEnquiry.updateMany({where:{id:input.data.id,handledAt:null},data:{handledAt:new Date()}});
    if(done.count) await tx.financeAuditLog.create({data:{action:'UPDATE',entityType:'ShopEnquiry',entityId:input.data.id,userId:user.id,userRole:user.role,changesJson:JSON.stringify({state:'handled'})}});
  });
  return NextResponse.json({ok:true});
}
