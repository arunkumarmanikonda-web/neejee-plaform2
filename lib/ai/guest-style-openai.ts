import sharp from 'sharp';
import {prisma} from '@/lib/prisma';

export const openAiStyleAvailable=()=>!!process.env.OPENAI_API_KEY?.trim();
export async function makeStyleImage(prompt:string,refs:string[]):Promise<Buffer>{
  const response=await fetch('https://api.openai.com/v1/images/edits',{
    method:'POST',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(175000),
    headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY!.trim(),'Content-Type':'application/json'},
    body:JSON.stringify({model:process.env.OPENAI_STYLE_IMAGE_MODEL?.trim()||'gpt-image-1.5',
      prompt,images:refs.map(image_url=>({image_url})),n:1,quality:'medium',size:'auto',output_format:'jpeg'}),
  });
  const json=await response.json().catch(()=>null);
  if(!response.ok){
    const raw=String(json?.error?.code||json?.error?.type||'rejected').toLowerCase();
    const code=/^[a-z0-9_]{1,70}$/.test(raw)?raw:'rejected';
    throw Error('openai_'+response.status+'_'+code);
  }
  const image=json?.data?.[0]?.b64_json;
  if(typeof image!=='string'||image.length<100||image.length>20000000)throw Error('openai_invalid_output');
  return sharp(Buffer.from(image,'base64'),{limitInputPixels:16000000}).rotate()
    .resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).jpeg({quality:88}).toBuffer();
}
export async function finishOpenAiStyle(owner:string,id:string,prompt:string,refs:string[]){
  try{
    const jpg=await makeStyleImage(prompt,refs);
    await prisma.$executeRaw`update private.guest_style_job set result_jpeg=${jpg} where owner_hash=${owner} and id=${id}::uuid and expires_at>now()`;
  }catch(e){
    const reason=e instanceof Error&&/^openai_[a-z0-9_]+$/.test(e.message)?e.message:'openai_transport';
    console.warn('guest_style_edit',reason);
    await prisma.$executeRaw`update private.guest_style_job set state='failed',failure_code=${reason} where owner_hash=${owner} and id=${id}::uuid`;
  }
}
