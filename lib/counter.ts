import { studioHref } from '@/lib/studio';

export type CounterCloth = {
  id: string;
  name: string;
  description: string;
  image: string;
  detailImage?: string;
  alt: string;
  palette: string[];
  kind: 'archive' | 'shop';
  href: string;
  credit?: string;
  price?: string;
  mirrorHref?: string;
};

export const shades = [
  { name: 'Jamun', hex: '#48263f' },
  { name: 'Alta red', hex: '#883441' },
  { name: 'Haldi yellow', hex: '#d6a63d' },
  { name: 'Leaf green', hex: '#727644' },
  { name: 'Indigo', hex: '#3c5073' },
  { name: 'Old rose', hex: '#c48785' },
  { name: 'Unbleached cotton', hex: '#e5d8b9' },
];

export type CounterState = { colour: string; one: string; two: string };
export type CounterMode = 'mine' | 'ask' | 'reply';
export type CounterLink = CounterState & { mode: CounterMode; pick: string };

export function safeHex(input: unknown) {
  return typeof input === 'string' && /^#[a-f0-9]{6}$/i.test(input) ? input.toLowerCase() : '';
}
export function safePieceId(input: unknown) {
  return typeof input === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(input) ? input : '';
}
export const shadeName = (hex:string) => shades.find(s=>s.hex===hex)?.name || hex.toUpperCase();
export function readCounter(q: URLSearchParams): CounterLink {
  const one=safePieceId(q.get('one')), second=safePieceId(q.get('two'));
  const two=one===second?'':second;
  const pick=safePieceId(q.get('pick'));
  const mode=q.get('mode');
  return {one,two,colour:safeHex('#'+(q.get('c')||'')),mode:mode==='ask'||mode==='reply'?mode:'mine',pick:pick && (pick===one||pick===two)?pick:''};
}
export function counterHref(state: CounterState, mode: CounterMode='mine', pick='') {
  const q=new URLSearchParams();
  if (safeHex(state.colour)) q.set('c',state.colour.slice(1));
  if (safePieceId(state.one)) q.set('one',state.one);
  if (safePieceId(state.two) && state.two!==state.one) q.set('two',state.two);
  if (mode!=='mine') q.set('mode',mode);
  if (mode==='reply' && pick && (pick===state.one||pick===state.two)) q.set('pick',pick);
  return '/counter'+(q.size?'?'+q.toString():'');
}
export function pickupLink(id:string) {
  return '/counter?one='+encodeURIComponent('v-'+id);
}
export function productLinks(slug:string,id:string,mirror:boolean) {
  return {href:'/products/'+encodeURIComponent(slug)+'?variant='+encodeURIComponent(id),mirrorHref:mirror?studioHref('mirror',slug,id):undefined};
}

// Linear-light sRGB distance. These are photographic colour suggestions.
function channels(hex:string) {
  return [1,3,5].map(i=>{const v=parseInt(hex.slice(i,i+2),16)/255;return v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4;});
}
export function rankedCloths(items: CounterCloth[], hex: string, contrast=false) {
  const rgb=channels(safeHex(hex)||shades[0].hex);
  const scored=items.map(item=>{
    const distances=item.palette.filter(safeHex).map(tone=>channels(tone).reduce((sum,n,i)=>sum+[0.3,0.5,0.2][i]*(n-rgb[i])**2,0));
    // The body of the cloth carries more visual weight than fine border or zari accents.
    const score = distances.length ? 0.85 * distances[0] + 0.15 * Math.min(...distances) : null;
    return {item,score};
  });
  return scored.sort((a,b)=>{
    if(a.score===null||b.score===null) return a.score===null ? Number(b.score!==null) : -1;
    return contrast ? b.score-a.score : a.score-b.score;
  }).map(s=>s.item);
}
export function firstPair(items:CounterCloth[], colour:string, preferDifferent=false) {
  const available=items.filter(item=>item.kind==='shop');
  const groups=[...rankedCloths(available,colour,preferDifferent),...rankedCloths(items.filter(item=>item.kind==='archive'),colour,preferDifferent)];
  return [groups[0]?.id||'',groups[1]?.id||''] as const;
}
