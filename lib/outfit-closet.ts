import {slots,type Slot} from './stylebook';

export type Dressing = {choices: Partial<Record<Slot,string>>; photos: Partial<Record<Slot,string>>};
export const blankDressing=():Dressing=>({choices:{},photos:{}});
const prefix='neejee.dressing.2.';
const memory=new Map<string,Dressing>();
export const lineKey=(product:string,variant:string)=>product+'~'+variant;
export function readDressing(key:string):Dressing {
  if(memory.has(key)) return memory.get(key)!;
  try {
    const stored=JSON.parse(sessionStorage.getItem(prefix+key)||'null');
    if(stored && Date.now()-stored.time < 4*3600000 && stored.state?.choices && stored.state?.photos) return stored.state;
    sessionStorage.removeItem(prefix+key);
  } catch {}
  return blankDressing();
}
export function saveDressing(key:string,state:Dressing) {
  memory.set(key,state);
  try {sessionStorage.setItem(prefix+key,JSON.stringify({time:Date.now(),state}));} catch {}
}
export function clearDressing(key:string){memory.delete(key);try{sessionStorage.removeItem(prefix+key);}catch{}}
export async function localWardrobePhoto(file:File) {
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||!file.size||file.size>15*1024*1024) throw Error('Choose a JPG, PNG or WebP image up to 15 MB.');
  const bitmap=await createImageBitmap(file);
  try{
    const scale=Math.min(1,820/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    const ctx=canvas.getContext('2d');if(!ctx)throw Error('This browser could not open the photo.');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
    const data=canvas.toDataURL('image/jpeg',0.75);
    if(data.length>650000 || !data.startsWith('data:image/jpeg;base64,')) throw Error('Please choose a smaller photo.');
    return data;
  }finally{bitmap.close();}
}
export const homeSlots=(value:string|undefined)=>slots.filter(slot=>(value||'').split(',').includes(slot));
