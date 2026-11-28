import {prisma} from '@/lib/prisma';
import { makeStyleImage } from './openai-image';
export { makeStyleImage, openAiStyleAvailable } from './openai-image';
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
