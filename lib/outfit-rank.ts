import { slots, type Slot, type StyleFacts, type StyleOption } from './stylebook';

export type Garment = StyleFacts & {id:string;name:string;image:string;slug:string;variant:string;study?:string;mirror:boolean};
const words=(s?:string|null)=>(s||'').toLowerCase().split(/[^a-z0-9]+/).filter(w=>w.length>2);
const shared=(a?:string|null,b?:string|null)=>words(a).some(w=>words(b).includes(w));
const swatches:[RegExp,string][]=[
  [/wine|burgundy|maroon|jamun/,'#77374c'],[/red|vermilion|scarlet|surkh/,'#a23830'],[/indigo|navy|neel/,'#354763'],[/teal|peacock/,'#27655f'],
  [/turmeric|mustard|haldi|yellow/,'#bc8c26'],[/pista|sage|olive/,'#909b70'],[/pink|rose|gulabi/,'#b77587'],[/ivory|cream|ecru|pearl/,'#eee3c9'],
  [/gold|brass/,'#bc985a'],[/silver/,'#adadb0'],[/tan|brown/,'#976943'],[/black/,'#292724'],[/white/,'#f3f1e8'],[/green/,'#467447'],[/blue/,'#3a5b87'],
];
function rgb(hex:string) {return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));}
function tone(f:StyleFacts & {name:string}) {
  if (f.hex && /^#[a-f0-9]{6}$/i.test(f.hex)) return f.hex;
  return swatches.find(([r])=>r.test((f.colour||f.name).toLowerCase()))?.[1];
}
export function describeSwatch(g:Garment,hex:string) {
  const base=tone(g);
  if(!base) return 'Compare this swatch with the saree photograph in daylight.';
  const a=rgb(base), b=rgb(hex);
  const gap=Math.sqrt(a.reduce((sum,v,i)=>sum+(v-b[i])**2,0));
  if(gap<90) return 'A tonal pairing. The two colours are close.';
  const neutral=Math.max(...b)-Math.min(...b)<36;
  if(neutral) return 'A neutral accent that lets the saree colour lead.';
  return gap>190?'A strong contrast against the saree’s main colour.':'A distinct accent beside the saree’s main colour.';
}
export function garmentScore(g:Garment,a:StyleOption) {
  const notes:{points:number;text:string}[]=[];
  const garment=[g.name,g.colour,g.description,g.material,g.technique].filter(Boolean).join(' ').toLowerCase();
  const acc=[a.name,a.colour,a.material,a.technique].filter(Boolean).join(' ').toLowerCase();
  const add=(points:number,text:string)=>notes.push({points,text});
  const gTone=tone(g), aTone=tone(a);
  if(gTone && aTone){
    const source=rgb(gTone),dest=rgb(aTone);
    const distance=Math.sqrt(source.reduce((s,n,i)=>s+(n-dest[i])**2,0));
    if(distance<112) add(24*(1-distance/210),'A tonal pairing with the saree’s '+(g.colour||'main colour')+'.');
  }
  const accents=swatches.filter(([r])=>r.test(g.description?.toLowerCase()||'')&&!r.test(g.colour?.toLowerCase()||''));
  if(accents.some(([r])=>r.test(acc))) add(32,'Picks up a second colour in the saree.');
  if(/gold|zari|brass/.test(garment) && /gold|brass/.test(acc)) add(30,'Echoes the warm metallic detail.');
  if(/silver|indigo|navy/.test(garment) && /silver|oxidised|oxidized/.test(acc)) add(21,'Cool silver sits well against this palette.');
  if(/ivory|ecru|pearl|tan/.test(acc)) add(12,'A quiet neutral that leaves the saree in focus.');
  if(/check|diamond|motif|brocade|floral|jamdani|but[ai]|ikat/.test(garment)&&/plain|matte|solid|stud|scoop|square.neck/.test(acc)) add(21,'A simpler finish gives the saree’s pattern room.');
  for(const [field,points,label] of [['craft',17,'craft'],['technique',15,'technique'],['region',12,'region'],['occasion',13,'occasion'],['material',9,'material']] as const){
    if(shared(g[field],a[field])) add(points,'The catalogue records a shared '+label+' ('+a[field]+').');
  }
  notes.sort((x,y)=>y.points-x.points);
  return {score:notes.reduce((n,x)=>n+x.points,0),reason:notes[0]?.text||'An available option to compare with your saree.'};
}
export function rankOutfit(g:Garment,options:StyleOption[]):StyleOption[] {
  return slots.flatMap(slot=>{
    const ranked=options.filter(o=>o.slot===slot).map(item=>({item,...garmentScore(g,item)})).sort((a,b)=>b.score-a.score||a.item.id.localeCompare(b.item.id));
    // Show up to four distinct designs/colours, preserving all of their size choices.
    const groups = new Map<string,StyleOption[]>();
    for (const {item,reason} of ranked) {
      const key=(item.productId||item.id)+'|'+(item.colour||'');
      if(!groups.has(key) && groups.size>=4) continue;
      groups.set(key,[...(groups.get(key)||[]),{...item,reason}]);
    }
    return [...groups.values()].flat();
  });
}
export function applyEditorialOrder(options:StyleOption[], order:Partial<Record<Slot,string[]>>) {
  return slots.flatMap(slot=>{
    const group=options.filter(o=>o.slot===slot);
    const pinned=Array.isArray(order?.[slot])?order[slot]!.flatMap(id=>group.find(o=>o.id===id)||[]):[];
    return [...new Map([...pinned,...group].map(o=>[o.id,o])).values()];
  });
}
