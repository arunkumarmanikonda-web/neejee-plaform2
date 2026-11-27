export function pixelHex(r:number,g:number,b:number) {
  return '#'+[r,g,b].map(n=>n.toString(16).padStart(2,'0')).join('');
}
export function suggestColours(data:Uint8ClampedArray) {
  const histogram=new Map<number,{count:number;r:number;g:number;b:number}>();
  for(let i=0;i<data.length;i+=16){
    if(data[i+3]<180) continue;
    const [r,g,b]=[data[i],data[i+1],data[i+2]];
    const key=(r>>5)*64+(g>>5)*8+(b>>5);
    const v=histogram.get(key)||{count:0,r:0,g:0,b:0};
    v.count++;v.r+=r;v.g+=g;v.b+=b;histogram.set(key,v);
  }
  return Array.from(histogram.values()).sort((a,b)=>b.count-a.count).slice(0,5).map(v=>pixelHex(Math.round(v.r/v.count),Math.round(v.g/v.count),Math.round(v.b/v.count)));
}
