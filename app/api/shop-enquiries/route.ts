import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { studies } from '@/lib/shop-studies';

const form = z.object({
  requestId:z.string().uuid(), piece:z.string().max(80),
  email:z.string().trim().email().max(254).toLowerCase(), message:z.string().trim().max(600),
});
const reply = (id:string) => NextResponse.json({reference:'NJ-'+id.slice(0,8).toUpperCase()}, {headers:{'Cache-Control':'no-store'}});

export async function POST(req:Request) {
  const native = req.headers.get('content-type')?.includes('application/x-www-form-urlencoded') === true;
  const payload = native ? await req.formData().then(data=>Object.fromEntries(data)).catch(()=>null) : await req.json().catch(()=>null);
  const input = form.safeParse(payload);
  if (!input.success || !studies.some(piece=>piece.id === input.data.piece))
    return NextResponse.json({error:'Please check the piece and email address.'},{status:400});
  const {requestId,piece,email,message} = input.data;
  try {
    const key = createHash('sha256').update('neejee-enquiry:'+(req.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim()||email)).digest('hex');
    const [limit] = await prisma.$queryRaw<Array<{allowed:boolean;retry_after:number}>>`
      select allowed,retry_after from private.record_auth_login_failure(${key},16,900,900)
    `;
    if (!limit?.allowed) return NextResponse.json({error:'Too many requests. Please try again later.'},{status:429,headers:{'Retry-After':String(limit?.retry_after||900)}});
    const saved = await prisma.shopEnquiry.upsert({where:{id:requestId},create:{id:requestId,pieceId:piece,email,message},update:{},select:{email:true,pieceId:true,message:true}});
    if (saved.email!==email || saved.pieceId!==piece || saved.message!==message)
      return NextResponse.json({error:'Please start a fresh enquiry.'},{status:409});
    if (native) {
      const url=new URL('/enquire/received',req.url);
      url.searchParams.set('ref','NJ-'+requestId.slice(0,8).toUpperCase());
      return NextResponse.redirect(url,{status:303,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
    }
    return reply(requestId);
  } catch {
    return NextResponse.json({error:'Your enquiry could not be confirmed. Please try again.'},{status:503});
  }
}
