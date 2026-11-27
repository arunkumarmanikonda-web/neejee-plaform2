import {createHash,randomBytes} from 'node:crypto';
import sharp from 'sharp';
import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {prisma} from '@/lib/prisma';
import {guestRenderingConfigured,GuestRenderError,guestRenderResult,startGuestRender} from '@/lib/ai/guest-style-service';
import {getPairBoard} from '@/lib/pairing-catalog';
import {pairingSlots,type PairSlot} from '@/lib/pairing';

export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=60;
const cookie='nj_style_guest';
const headers={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'};
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers});
const hash=(s:string)=>createHash('sha256').update('neejee-style/'+s).digest('hex');
const owner=(req:NextRequest)=>{const id=req.cookies.get(cookie)?.value;return id&&/^[a-f0-9]{64}$/.test(id)?hash(id):null;};
const photo=z.string().max(650000).regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/);
const slot=z.enum(Object.keys(pairingSlots) as [PairSlot,...PairSlot[]]);
const schema=z.object({id:z.string().uuid(),product:z.string().max(180).optional(),variant:z.string().max(150).optional(),
  study:z.string().max(100).optional(),background:photo.optional(),consent:z.literal(true),
  layers:z.array(z.object({slot,variant:z.string().max(150).optional(),photo:photo.optional()}).refine(x=>!!x.variant!==!!x.photo)).max(6)});
type Job={state:string;provider_id:string|null;old:boolean};
async function job(ownerHash:string,id:string){
  const [row]=await prisma.$queryRaw<Job[]>`select state,provider_id,created_at < now()-interval '70 seconds' as old
    from private.guest_style_job where owner_hash=${ownerHash} and id=${id}::uuid and expires_at>now()`;
  return row;
}
function publicImage(src:string) {
  if (src.startsWith('/')&&!src.startsWith('//')) return new URL(src,process.env.NEXT_PUBLIC_SITE_URL||'https://www.neejee.com').href;
  const url=new URL(src);if(url.protocol!=='https:')throw Error('Invalid catalogue image');return url.href;
}
async function cleanPhoto(data:string) {
  const bytes=Buffer.from(data.slice(data.indexOf(',')+1),'base64');
  if(bytes.readUInt16BE(0)!==0xffd8)throw Error('Invalid photo');
  const image=await sharp(bytes,{limitInputPixels:3000000,failOn:'error'}).rotate().resize({width:900,height:900,fit:'inside',withoutEnlargement:true}).jpeg({quality:82}).toBuffer();
  return 'data:image/jpeg;base64,'+image.toString('base64');
}
async function readInput(req:NextRequest){
  if(!req.body)throw Error('Empty request');
  const reader=req.body.getReader(),buffers:Uint8Array[]=[];let length=0;
  for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;
    if(length>4000000){await reader.cancel();throw Error('Photos too large');}buffers.push(value);}
  return schema.parse(JSON.parse(Buffer.concat(buffers).toString('utf8')));
}
function sameShopOrigin(req:NextRequest){
  if(req.headers.get('sec-fetch-site')==='cross-site')return false;
  const origin=req.headers.get('origin');if(!origin)return false;
  if(origin===req.nextUrl.origin)return true;
  try{
    const source=new URL(origin),protocol=(req.headers.get('x-forwarded-proto')?.split(',')[0]||req.nextUrl.protocol).trim().replace(/:$/,'');
    return source.host===req.headers.get('host')&&source.protocol===protocol+':';
  }catch{return false;}
}
export async function POST(req:NextRequest){
  if(!sameShopOrigin(req) || !req.headers.get('content-type')?.includes('application/json'))return json({error:'Open the styling page again.'},403);
  const identity=owner(req);
  if(!identity)return json({error:'Enable this site’s cookies to create a rendered preview.'},401);
  if(!guestRenderingConfigured())return json({error:'Photo rendering is unavailable. Your styling board and checkout are ready.'},503);
  const data=await readInput(req).catch(()=>null);
  if(!data||(!data.background&&!data.layers.length)||new Set(data.layers.map(i=>i.slot)).size!==data.layers.length)return json({error:'Choose a photo or a pairing and confirm permission.'},400);
  try {
    const prior=await job(identity,data.id);
    if(prior)return json({id:data.id},202);
    const board=await getPairBoard(data);
    if(!board?.anchor.image)return json({error:'This piece is no longer available for styling.'},409);
    const refs:string[]=[];const labels:string[]=[];
    if(data.background){refs.push(await cleanPhoto(data.background));labels.push(board.mode==='room'?'the customer’s room. Preserve its architecture and other furniture':'the customer. Preserve their identity, complexion, body proportions and pose');}
    refs.push(publicImage(board.anchor.image));labels.push('the exact main piece, '+board.anchor.name+'. Preserve colour, material, pattern, borders and silhouette');
    for(const layer of data.layers){
      if(!board.slots.includes(layer.slot))return json({error:'These pieces cannot be paired here.'},400);
      const item=board.options[layer.slot]?.find(x=>x.variant===layer.variant);
      if(!layer.photo&&!item)return json({error:'A selected piece has sold out. Refresh your choices.'},409);
      refs.push(layer.photo?await cleanPhoto(layer.photo):publicImage(item!.image));
      labels.push('the chosen '+pairingSlots[layer.slot].label+(item?', '+item.name:' from the customer’s photo')+'. Preserve its design and remove the reference background');
    }
    const ip=req.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim()||'shared';
    const reserved=await prisma.$transaction(async tx=>{
      await tx.$executeRaw`delete from private.guest_style_job where expires_at<now()`;
      const inserted=await tx.$executeRaw`insert into private.guest_style_job(owner_hash,id) values(${identity},${data.id}::uuid) on conflict do nothing`;
      if(!inserted)return 'existing';
      for(const [value,limit] of [[identity,5],[hash('network/'+ip),17],[hash('whole-shop'),101]] as const) {
        const [quota]=await tx.$queryRaw<{allowed:boolean}[]>`select allowed from private.record_auth_login_failure(${value},${limit}::int,86400,86400)`;
        if(!quota?.allowed){await tx.$executeRaw`delete from private.guest_style_job where owner_hash=${identity} and id=${data.id}::uuid`;return 'limited';}
      }
      return 'new';
    });
    if(reserved==='limited')return json({error:'Today’s photo preview limit has been reached. You can keep styling or check out.'},429);
    if(reserved==='existing')return json({id:data.id},202);
    const scene=board.mode==='room'?(data.background?'Place the selected pieces in the supplied room in plausible positions.':'Make a realistic Indian interior vignette around the main piece.'):(data.background?'Dress the person in the main piece and selected accessories.':'Show the main garment and selected accessories worn together in a realistic editorial fitting.');
    const prompt=scene+' '+labels.map((s,i)=>'Image '+(i+1)+' is '+s+'.').join(' ')+' Match light and scale. Keep the main piece and pairings visible. Do not add text, new products or a collage border.';
    try{
      const providerId=await startGuestRender(prompt,refs);
      await prisma.$executeRaw`update private.guest_style_job set state='queued',provider_id=${providerId} where owner_hash=${identity} and id=${data.id}::uuid`;
      return json({id:data.id},202);
    }catch(e){
      const code=e instanceof GuestRenderError?e.message.slice(0,120):'job_record';
      await prisma.$executeRaw`update private.guest_style_job set state='failed',failure_code=${code} where owner_hash=${identity} and id=${data.id}::uuid`;
      return json({error:'Photo rendering is unavailable right now. You can arrange these pieces on your photo below.'},502);
    }
  }catch{return json({error:'The studio could not open these photos. Please try another photo or continue to checkout.'},503);}
}
export async function GET(req:NextRequest) {
  if(req.nextUrl.searchParams.get('session')==='1'){
    const res=json({ready:true});if(!owner(req))res.cookies.set(cookie,randomBytes(32).toString('hex'),{httpOnly:true,secure:req.nextUrl.protocol==='https:',sameSite:'lax',path:'/api/styling/preview',maxAge:86400});return res;
  }
  const identity=owner(req),id=req.nextUrl.searchParams.get('id');
  if(!identity||!z.string().uuid().safeParse(id).success)return json({error:'Preview unavailable.'},404);
  try{
    const row=await job(identity,id!);if(!row)return json({error:'This preview has expired.'},404);
    if(row.state==='failed'||(row.state==='pending'&&row.old))return json({error:'The preview could not be completed.'},502);
    if(!row.provider_id)return json({pending:true},202);
    const media=await guestRenderResult(row.provider_id);
    if(!media)return json({pending:true},202);
    return new Response(media.body,{headers:{...headers,'X-Content-Type-Options':'nosniff','Content-Type':media.headers.get('content-type')!}});
  }catch{return json({error:'The studio is temporarily unavailable.'},502);}
}
