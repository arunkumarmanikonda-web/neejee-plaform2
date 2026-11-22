import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { editorialLooks, selectedAccessories, type StyleOption, type Styling } from '@/lib/stylebook';

async function editorialReference(pathname:string) {
  // Local editorial files travel with the function, including on protected previews.
  const image=await readFile(join(process.cwd(),'public',pathname));
  return 'data:image/webp;base64,'+image.toString('base64');
}

export async function buildStyledInput(person:string,garment:string,style:Styling,stock:StyleOption[]=[],origin='') {
  const accessories=selectedAccessories(style,stock);
  const fabric=editorialLooks.some(look => look.image === garment) ? await editorialReference(garment) : garment;
  const details=await Promise.all(accessories.map(item=>item.productId ? new URL(item.image,origin).href : editorialReference(item.image)));
  const marks=accessories.map((item,i)=>'Image '+(i+3)+' shows the '+item.name+' to put in its natural position on the person.');
  return {
    prompt:[
      'Make one realistic head-to-toe fitting photograph. Image 1 is the customer. Preserve their identity, complexion, body proportions, age and surroundings, with natural daylight if the input has it.',
      'Image 2 is the garment reference only. Dress the customer in the same garment, preserving its colour, motif, drape and border. Disregard the model, footwear, jewellery and setting in that reference.',
      ...marks,
      style.shoe==='none'?'Keep the footwear from image 1.':'Keep the chosen shoes visible if the original framing permits.',
      style.jewel==='none'?'Keep the jewellery from image 1.':'Use only the chosen jewellery.',
      'Preserve the original pose and framing where practical. Do not add extra accessories, labels, text or graphic elements.',
    ].join(' '),
    image_urls:[person,fabric,...details],num_images:1,output_format:'jpeg',aspect_ratio:'auto',
  };
}
