import type { EditSlug } from '@/lib/shop-edits';
const credits = {
  clothing:{name:'Dan Ruth',title:'Silk Looms, Varanasi',source:'https://commons.wikimedia.org/wiki/File:Silk_Looms,_Varanasi.jpg',licence:'CC BY 2.0',licenceUrl:'https://creativecommons.org/licenses/by/2.0/'},
  furniture:{name:'© Yann Forget / Wikimedia Commons',title:'Decorated bed, Crafts Museum, Delhi',source:'https://commons.wikimedia.org/wiki/File:Decorated_bed,_Crafts_Museum,_Delhi.jpg',licence:'CC BY-SA 4.0',licenceUrl:'https://creativecommons.org/licenses/by-sa/4.0/'},
  sarees:{name:'Lasta2020',title:'Sari Border in red and gold',source:'https://commons.wikimedia.org/wiki/File:Sari_Border_in_red_and_gold.jpg',licence:'CC BY-SA 4.0',licenceUrl:'https://creativecommons.org/licenses/by-sa/4.0/'},
  suits:{name:'Shivani rajput',title:'Shivani rajput in salwar',source:'https://commons.wikimedia.org/wiki/File:Shivani_rajput_in_salwar.jpg',licence:'CC BY-SA 4.0',licenceUrl:'https://creativecommons.org/licenses/by-sa/4.0/'},
  home:{name:'Ravindraboopathi',title:'Chettinadu study Room',source:'https://commons.wikimedia.org/wiki/File:Chettinadu_study_Room.jpeg',licence:'CC BY-SA 3.0',licenceUrl:'https://creativecommons.org/licenses/by-sa/3.0/'},
} as const;
export function EditorialCredit({slug}:{slug:EditSlug}) {
  const credit=credits[slug];
  return <p id="photograph" className="scroll-mt-24 font-ui text-xs leading-relaxed text-mitti mt-2">Editorial photograph · <a className="underline" href={credit.source}>{credit.title} by {credit.name}</a> · <a className="underline" href={credit.licenceUrl}>{credit.licence}</a> · {slug==='furniture'?'resized':'cropped and resized'} for this edit.</p>;
}
