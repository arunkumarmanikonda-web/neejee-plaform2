import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { editorialLooks, selectedAccessories, slots, slotNames, type Slot, type StyleOption, type Styling } from '@/lib/stylebook';

async function editorialReference(pathname:string) {
  // Local editorial files travel with the function, including on protected previews.
  const image=await readFile(join(process.cwd(),'public',pathname));
  return 'data:image/webp;base64,'+image.toString('base64');
}

export type OwnPhotos = Partial<Record<Slot,string>>;
export function readOwnPhotos(value:unknown):OwnPhotos|null {
  if(value===undefined) return {};
  if(!value || typeof value!=='object'||Array.isArray(value)) return null;
  const own:OwnPhotos={};
  for(const [key,data] of Object.entries(value)) {
    if(!slots.includes(key as Slot) || typeof data!=='string' || data.length>650000 || !/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(data)) return null;
    const bytes=Buffer.from(data.slice(data.indexOf(',')+1),'base64');
    if(bytes.length<4 || bytes.at(-2)!==255 || bytes.at(-1)!==217) return null;
    own[key as Slot]=data;
  }
  return own;
}
export async function buildStyledInput(person:string,garment:string,style:Styling,stock:StyleOption[]=[],origin='',own:OwnPhotos={}) {
  const accessories=selectedAccessories(style,stock);
  const refs=slots.flatMap(slot=>{
    if(own[slot])return [{image:own[slot]!,name:'customer’s own '+slotNames[slot].toLowerCase(),source:'own'}];
    const a=accessories.find(x=>x.slot===slot);
    return a?[{image:a.image,name:a.name,source:a.productId?'catalogue':'study'}]:[];
  });
  const fabric=editorialLooks.some(look => look.image === garment) ? await editorialReference(garment) : garment;
  const details=await Promise.all(refs.map(item=>item.source==='own'?item.image:item.source==='catalogue'?new URL(item.image,origin).href:editorialReference(item.image)));
  const marks=refs.map((item,i)=>'Image '+(i+3)+' shows the '+item.name+' to put in its natural position on the person.');
  return {
    prompt:[
      'Make one realistic head-to-toe fitting photograph. Image 1 is the customer. Preserve their identity, complexion, body proportions, age and surroundings, with natural daylight if the input has it.',
      'Image 2 is the garment reference only. Dress the customer in the same garment, preserving its colour, motif, drape and border. Disregard the model, footwear, jewellery and setting in that reference.',
      ...marks,
      own.blouse || (style.blouse && style.blouse!=='none') ? 'Use the selected blouse under the saree, preserving its neckline, sleeve length and finish.' : 'Keep the blouse styling from the saree reference.',
      !own.shoe && style.shoe==='none'?'Keep the footwear from image 1.':'Keep the chosen shoes visible if the original framing permits.',
      !own.jewel && style.jewel==='none'?'Keep the jewellery from image 1.':'Use only the chosen jewellery.',
      'Preserve the original pose and framing where practical. Do not add extra accessories, labels, text or graphic elements.',
    ].join(' '),
    image_urls:[person,fabric,...details],num_images:1,output_format:'jpeg',aspect_ratio:'auto',
  };
}
