export const editorialLooks = [
  {id:'sage',name:'A little pistachio',shade:'Pistachio',occasion:'A courtyard lunch',image:'/brand/lookbook/sage.webp',description:'A pale green drape with a sliver of gold. Pick up the border in your jhumkas, or go quieter with a single pearl.',shoe:'jutti-gold',jewel:'jewel-jhumka',colour:'#999e79'},
  {id:'rose',name:'Gulabi hour',shade:'Gulabi',occasion:'An afternoon wedding',image:'/brand/lookbook/rose.webp',description:'Let the pink have the room. An ivory jutti keeps the foot light, and small pearls leave a little breathing space at the neck.',shoe:'jutti-ivory',jewel:'jewel-pearl',colour:'#bc7f80'},
  {id:'indigo',name:'Blue after dark',shade:'Indigo',occasion:'Dinner after dusk',image:'/brand/lookbook/indigo.webp',description:'Inky blue brings silver into focus. Try a pendant against the dark drape and tan leather at the hem.',shoe:'jutti-tan',jewel:'jewel-silver',colour:'#47546c'},
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
export type StyleOption = {id:string;name:string;slot:'shoe'|'jewel';image:string;href?:string;price?:string;productId?:string};
export const isAccessorySku=(id:unknown):id is string=>typeof id==='string' && /^sku-[a-zA-Z0-9_-]{1,100}$/.test(id);
export type Styling = {look:string;shoe:string;jewel:string};
export function readStyling(value:unknown): Styling | null {
  if(!value || typeof value!=='object') return null;
  const {look,shoe,jewel}=value as Partial<Styling>;
  if(!editorialLooks.some(item=>item.id===look)) return null;
  if(shoe!=='none'&&!isAccessorySku(shoe)&&!shoes.some(item=>item.id===shoe)) return null;
  if(jewel!=='none'&&!isAccessorySku(jewel)&&!jewels.some(item=>item.id===jewel)) return null;
  return {look:look!,shoe:shoe!,jewel:jewel!};
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
  ...shoes.map(item=>({...item,slot:'shoe' as const,image:accessoryImage(item.id)})),
  ...jewels.map(item=>({...item,slot:'jewel' as const,image:accessoryImage(item.id)})),
];
export function selectedAccessories(s:Styling,stock:StyleOption[]=[]){
  const options=[...editorialOptions,...stock];
  return (['shoe','jewel'] as const).map(slot=>options.find(item=>item.id===s[slot]&&item.slot===slot)).filter((item):item is StyleOption=>!!item);
}
export function allAccessoriesPresent(s:Styling,stock:StyleOption[]) {
  return selectedAccessories(s,stock).length===[s.shoe,s.jewel].filter(id=>id!=='none').length;
}

export function getEditorialPiece(style:Styling) {
  const look=editorialLooks.find(item=>item.id===style.look)!;
  return {id:'look-'+look.id,slug:'look-'+look.id,name:look.name,image:look.image,images:[look.image],material:null,craft:null,category:'Saree styling study',mrp:0,sellingPrice:0,
    variants:[{id:'study-'+look.id,size:null,color:look.shade,image:look.image,inStock:false}]};
}
