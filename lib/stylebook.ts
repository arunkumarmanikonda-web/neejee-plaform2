import { studyTextiles } from './study-textiles';
export const editorialLooks = [
  {id:'sage',name:studyTextiles.sage.name,shade:'Pistachio',occasion:'A courtyard lunch',image:'/brand/lookbook/sage.webp',description:'A pale green drape with a sliver of gold. Pick up the border in your jhumkas, or go quieter with a single pearl.',shoe:'jutti-gold',jewel:'jewel-jhumka',colour:'#999e79'},
  {id:'rose',name:studyTextiles.rose.name,shade:'Gulabi',occasion:'An afternoon wedding',image:'/brand/lookbook/rose.webp',description:'Let the pink have the room. An ivory jutti keeps the foot light, and small pearls leave a little breathing space at the neck.',shoe:'jutti-ivory',jewel:'jewel-pearl',colour:'#bc7f80'},
  {id:'indigo',name:studyTextiles.indigo.name,shade:'Indigo',occasion:'Dinner after dusk',image:'/brand/lookbook/indigo.webp',description:'Inky blue brings silver into focus. Try a pendant against the dark drape and tan leather at the hem.',shoe:'jutti-tan',jewel:'jewel-silver',colour:'#47546c'},
  {id:'surkh',name:studyTextiles.surkh.name,shade:'Vermilion',occasion:'An evening celebration',image:'/brand/bazaar/surkh.webp',description:'The gold grid leaves room for a pair of jhumkas. Try antique gold at the hem.',shoe:'jutti-gold',jewel:'jewel-jhumka',colour:'#a4382a'},
  {id:'neel',name:studyTextiles.neel.name,shade:'Neel',occasion:'Lunch with friends',image:'/brand/bazaar/neel.webp',description:'Ivory diamonds on indigo pick up a silver pendant. Tan juttis soften the pairing.',shoe:'jutti-tan',jewel:'jewel-silver',colour:'#344d6a'},
  {id:'haldi',name:studyTextiles.haldi.name,shade:'Turmeric',occasion:'A daytime celebration',image:'/brand/bazaar/haldi.webp',description:'Give the maroon temple border room. Try an ivory jutti and a pair of pearl studs.',shoe:'jutti-ivory',jewel:'jewel-pearl',colour:'#bf8b25'},
] as const;
export const shoes = [
  {id:'jutti-gold',name:'Antique gold jutti'},
  {id:'jutti-ivory',name:'Ivory floral jutti'},
  {id:'jutti-tan',name:'Tan leather jutti'},
] as const;
export const jewels = [
  {id:'jewel-jhumka',name:'Gold jhumkas'},
  {id:'jewel-pearl',name:'Pearl studs'},
  {id:'jewel-silver',name:'Silver pendant'},
] as const;
export const slots = ['blouse','shoe','jewel'] as const;
export type Slot = typeof slots[number];
export const slotNames: Record<Slot,string> = {blouse:'Blouse',shoe:'Jutti',jewel:'Jewellery'};
export const blouses = [
  {id:'blouse-wine',name:'Wine scoop-neck blouse',image:'/brand/pairing/wine-blouse.webp'},
  {id:'blouse-ivory',name:'Ivory square-neck blouse',image:'/brand/pairing/ivory-blouse.webp'},
  {id:'blouse-teal',name:'Peacock blouse with gold piping',image:'/brand/pairing/teal-blouse.webp'},
];
export type StyleFacts = {colour?:string|null;hex?:string|null;material?:string|null;technique?:string|null;craft?:string|null;region?:string|null;occasion?:string|null;description?:string|null};
export type StyleOption = StyleFacts & {id:string;name:string;slot:Slot;image:string;href?:string;price?:string;productId?:string;slug?:string;size?:string|null;pricePaise?:number;reason?:string};
export const isAccessorySku=(id:unknown):id is string=>typeof id==='string' && /^sku-[a-zA-Z0-9_-]{1,100}$/.test(id);
export type Styling = {look:string;shoe:string;jewel:string;blouse?:string};
export function readStyling(value:unknown): Styling | null {
  if(!value || typeof value!=='object') return null;
  const {look,shoe,jewel,blouse}=value as Partial<Styling>;
  if(!editorialLooks.some(item=>item.id===look)) return null;
  if(shoe!=='none'&&!isAccessorySku(shoe)&&!shoes.some(item=>item.id===shoe)) return null;
  if(jewel!=='none'&&!isAccessorySku(jewel)&&!jewels.some(item=>item.id===jewel)) return null;
  if(blouse!==undefined && blouse!=='none' && !isAccessorySku(blouse) && !blouses.some(b=>b.id===blouse)) return null;
  return {look:look!,shoe:shoe!,jewel:jewel!,...(blouse?{blouse}:{})};
}
export function defaultStyling(id?:string):Styling {
  const look=editorialLooks.find(item=>item.id===id)||editorialLooks[0];
  return {look:look.id,shoe:look.shoe,jewel:look.jewel};
}
export function lookUrl(route:'/looks'|'/ai/mirror',selection:Styling,product?:string,variant?:string) {
  const params=new URLSearchParams(selection);
  if(product)params.set('product',product);
  if(variant)params.set('variant',variant);
  return route+'?'+params.toString();
}
export const accessoryImage=(id:string)=>'/brand/lookbook/'+id+'.webp';
export const editorialOptions:StyleOption[]=[
  ...blouses.map(item=>({...item,slot:'blouse' as const})),
  ...shoes.map(item=>({...item,slot:'shoe' as const,image:accessoryImage(item.id)})),
  ...jewels.map(item=>({...item,slot:'jewel' as const,image:accessoryImage(item.id)})),
];
export function selectedAccessories(s:Styling,stock:StyleOption[]=[]){
  const options=[...editorialOptions,...stock];
  return slots.map(slot=>options.find(item=>item.id===s[slot]&&item.slot===slot)).filter((item):item is StyleOption=>!!item);
}
export function allAccessoriesPresent(s:Styling,stock:StyleOption[]) {
  return selectedAccessories(s,stock).length===slots.filter(slot=>s[slot] && s[slot]!=='none').length;
}

export function getEditorialPiece(style:Styling) {
  const look=editorialLooks.find(item=>item.id===style.look)!;
  return {id:'look-'+look.id,slug:'look-'+look.id,name:look.name,image:look.image,images:[look.image],material:null,craft:null,category:'Saree styling study',mrp:0,sellingPrice:0,
    variants:[{id:'study-'+look.id,size:null,color:look.shade,image:look.image,inStock:false}]};
}
