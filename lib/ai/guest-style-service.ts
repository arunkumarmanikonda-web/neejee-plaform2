import { falKey } from './fal-key';
// Store only opaque job identifiers and fixed diagnostics. Uploaded photos never enter a log.
const falQueue='https://queue.fal.run/fal-ai/nano-banana-2';
const replicate='https://api.replicate.com/v1';
const idPattern=/^[a-zA-Z0-9_-]{1,150}$/;
type Provider='fal'|'replicate';
type Issue={provider:Provider;code:string;retryable:boolean};
export class GuestRenderError extends Error {
  constructor(public readonly issues:Issue[]){super(issues.map(x=>x.provider+'_'+x.code).join('.'));}
}
const credential=(provider:Provider)=>(provider==='fal'?falKey():process.env.REPLICATE_API_TOKEN)?.trim();
export const guestRenderingConfigured=()=>!!(credential('fal')||credential('replicate'));
function auth(provider:Provider){return {Authorization:(provider==='fal'?'Key ':'Bearer ')+credential(provider)};}
function reason(provider:Provider,status:number,body:unknown):Issue{
  const text=JSON.stringify(body||{}).toLowerCase();
  const kind=/credit|billing|balance|exhausted|insufficient funds|locked account/.test(text)?'billing':
    /unauthorized|invalid.*key|authentication|invalid.*token/.test(text)?'authentication':
    /safety|moderation|prohibited|nsfw/.test(text)?'content':'response';
  return {provider,code:status+'_'+kind,retryable:kind!=='content'&&[400,401,402,403,404,405,410,429,503].includes(status)};
}
async function submit(provider:Provider,prompt:string,refs:string[]){
  const fal=provider==='fal';
  const url=fal?falQueue+'/edit':replicate+'/models/google/nano-banana/predictions';
  const input=fal?{prompt,image_urls:refs,num_images:1,output_format:'jpeg',resolution:'1K'}:{input:{prompt,image_input:refs,output_format:'jpg'}};
  let response:Response;
  try{response=await fetch(url,{method:'POST',redirect:'error',signal:AbortSignal.timeout(18000),
    headers:{...auth(provider),'Content-Type':'application/json',...(fal?{'X-Fal-Store-IO':'0','X-Fal-Object-Lifecycle-Preference':'{"expiration_duration_seconds":3600}'}:{})},
    body:JSON.stringify(input)});}catch{throw new GuestRenderError([{provider,code:'transport',retryable:false}]);}
  const body=await response.json().catch(()=>null);
  if(!response.ok)throw new GuestRenderError([reason(provider,response.status,body)]);
  const id=fal?body?.request_id:body?.id;
  if(typeof id!=='string'||!idPattern.test(id))throw new GuestRenderError([{provider,code:'invalid_job',retryable:false}]);
  return fal?id:'rep:'+id;
}
export async function startGuestRender(prompt:string,refs:string[]){
  const issues:Issue[]=[];
  for(const provider of ['fal','replicate'] as const){
    if(!credential(provider))continue;
    try{return await submit(provider,prompt,refs);}
    catch(e){
      if(!(e instanceof GuestRenderError))throw e;
      issues.push(...e.issues);console.warn('guest_style_submit',provider,e.issues[0].code);
      // Do not duplicate an ambiguous submission or forward a moderated request.
      if(!e.issues[0].retryable)break;
    }
  }
  throw new GuestRenderError(issues);
}
export async function guestRenderResult(job:string):Promise<Response|null>{
  const isRep=job.startsWith('rep:'),provider=isRep?'replicate':'fal',id=isRep?job.slice(4):job;
  if(!idPattern.test(id))throw Error('Invalid job');
  const init={headers:auth(provider),cache:'no-store' as const,redirect:'error' as const,signal:AbortSignal.timeout(15000)};
  const endpoint=isRep?replicate+'/predictions/'+id:falQueue+'/requests/'+id;
  const r=await fetch(endpoint+(isRep?'':'/status'),init);const data=await r.json().catch(()=>null);
  if(!r.ok)throw new GuestRenderError([reason(provider,r.status,data)]);
  let output:string|undefined;
  if(isRep){
    if(['starting','processing'].includes(data?.status))return null;
    if(data?.status!=='succeeded')throw Error('Prediction failed');
    output=Array.isArray(data.output)?data.output[0]:data.output;
  }else{
    if(['IN_QUEUE','IN_PROGRESS'].includes(data?.status))return null;
    if(data?.status!=='COMPLETED')throw Error('Prediction failed');
    const result=await fetch(endpoint,init);if(!result.ok)throw Error('Result unavailable');
    output=(await result.json()).images?.[0]?.url;
  }
  if(!output)throw Error('Image unavailable');
  const image=new URL(output),domain=isRep?'replicate.delivery':'fal.media';
  if(image.protocol!=='https:'||!(image.hostname===domain||image.hostname.endsWith('.'+domain)))throw Error('Invalid output');
  const media=await fetch(image,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!media.ok||!['image/jpeg','image/png','image/webp'].includes(media.headers.get('content-type')?.split(';')[0]||''))throw Error('Invalid image');
  return media;
}
