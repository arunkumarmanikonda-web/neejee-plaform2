import { NextResponse } from 'next/server';
import { getSession, requireRole } from '@/lib/auth';
import { falKey } from '@/lib/ai/fal-key';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

async function read(service: string, url: string, authorization: string, evaluate: (data: any) => string) {
  if (!authorization) return { service, state:'Missing credential' };
  try {
    const result = await fetch(url, { headers:{Authorization:authorization}, redirect:'error', cache:'no-store', signal:AbortSignal.timeout(7000) });
    if (!result.ok) {
      const state = result.status === 401 ? 'Credential rejected' : result.status === 402 ? 'Billing required' :
        result.status === 403 ? 'Access restricted for this check' : 'Provider returned an error';
      return {service, state, http:result.status};
    }
    return {service, state:evaluate(await result.json()), http:result.status};
  } catch { return {service, state:'Provider could not be reached'}; }
}

export async function GET() {
  if (!requireRole(await getSession(), ['SUPER_ADMIN','ADMIN'])) return NextResponse.json({error:'Unauthorized'}, {status:401});
  const fal = falKey(), email = process.env.RESEND_API_KEY?.trim(), app = process.env.FACEBOOK_APP_ID?.trim(), secret = process.env.FACEBOOK_APP_SECRET?.trim();
  const sender = (process.env.EMAIL_FROM || 'hello@neejee.com').match(/@([^>\s]+)/)?.[1]?.toLowerCase();
  const active = {socialConnection:{status:'ACTIVE',OR:[{tokenExpiresAt:null},{tokenExpiresAt:{gt:new Date()}}]}};
  const providers = await Promise.all([
    read('fal.ai','https://api.fal.ai/v1/models/pricing?endpoint_id=fal-ai/nano-banana-2/edit',fal ? 'Key '+fal : '', d => Array.isArray(d.prices) && d.prices.length ? 'Model pricing available' : 'Model pricing unavailable'),
    read('Resend','https://api.resend.com/domains',email ? 'Bearer '+email : '',d =>
      d.data?.some((x:{name:string;status:string})=>x.name?.toLowerCase()===sender && x.status==='verified') ? 'Sending domain verified' : 'Sending domain verification not confirmed'),
    read('Meta app','https://graph.facebook.com/v24.0/'+encodeURIComponent(app || '')+'?fields=id',app && secret ? 'Bearer '+app+'|'+secret : '',d=>d.id===app ? 'App credentials accepted' : 'App ID did not match'),
  ]);
  const [facebook,instagram]=await Promise.all([
    prisma.socialPageConnection.count({where:{...active,canPost:true}}),
    prisma.instagramBusinessConnection.count({where:active}),
  ]).catch(()=>[null,null]);
  return NextResponse.json({providers,facebook,instagram}, {headers:{'Cache-Control':'private, no-store'}});
}
