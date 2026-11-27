export const styleHref = (product: string, variant?: string | null) =>
  '/style?' + new URLSearchParams({product, ...(variant ? {variant} : {})}).toString();
export const studyStyleHref = (study: string) => '/style?' + new URLSearchParams({study}).toString();

export const pairingSlots = {
  blouse: {label:'Blouse', words:['blouse','choli']},
  jewellery: {label:'Jewellery', words:['jewel','jhum','earring','necklace','pendant','bangle','bracelet']},
  footwear: {label:'Footwear', words:['footwear','jutti','juti','jooti','mojari','shoe','sandal']},
  accessory: {label:'Accessories', words:['accessor','potli','handbag','clutch','belt','stole','bag','dupatta']},
  lamp: {label:'Lamp', words:['lamp','lighting','lantern']},
  frame: {label:'Picture frame', words:['picture frame','photo frame','frame']},
  wall: {label:'Wall hanging', words:['wall hanging','tapestry','wall art','wall decor','wall décor']},
  rug: {label:'Rug or carpet', words:['rug','carpet','dhurrie','durrie','kilim']},
  object: {label:'Tabletop object', words:['vase','bowl','objet','figurine','artefact','artifact','urli','tabletop','sculpture','ceramic']},
  table: {label:'Table', words:['table','console','desk','nightstand']},
} as const;
export type PairSlot = keyof typeof pairingSlots;
export type PairPiece = {id:string; slug:string; variant:string; name:string; image:string; price:number; option:string; reason?:string};
export type PairBoard = {anchor:PairPiece; mode:'fashion'|'room'; slots:PairSlot[]; options:Partial<Record<PairSlot,PairPiece[]>>; study:boolean};
export const wordsFor = (text:string) => text.toLowerCase().replace(/[-_/]/g,' ');
export function slotFor(text:string): PairSlot | undefined {
  const value=wordsFor(text);
  return (Object.keys(pairingSlots) as PairSlot[]).find(key=>pairingSlots[key].words.some(word=>value.includes(word)));
}
export function slotsFor(mode:PairBoard['mode'], anchor:string):PairSlot[] {
  const own=slotFor(anchor);
  const slots:PairSlot[]=mode==='room'?['lamp','frame','object','wall','rug','table']:['blouse','jewellery','footwear','accessory'];
  return slots.filter(key=>key!==own && !(mode==='fashion' && /suit|kurta|salwar/i.test(anchor) && key==='blouse'));
}
