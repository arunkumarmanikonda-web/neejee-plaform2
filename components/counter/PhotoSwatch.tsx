'use client';

import { useEffect, useRef, useState } from 'react';
import { safeHex } from '@/lib/counter';
import styles from './Counter.module.css';

function pixelHex(r:number,g:number,b:number) {
  return '#'+[r,g,b].map(n=>n.toString(16).padStart(2,'0')).join('');
}
function suggestColours(data:Uint8ClampedArray) {
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

export function PhotoSwatch({onPick,onPhoto}:{onPick:(hex:string)=>void;onPhoto:(photo:string)=>void}) {
  const canvas=useRef<HTMLCanvasElement>(null);
  const input=useRef<HTMLInputElement>(null);
  const image=useRef<HTMLImageElement>();
  const serial=useRef(0);
  const source=useRef('');
  const [palette,setPalette]=useState<string[]>([]);
  const [status,setStatus]=useState('');
  const [present,setPresent]=useState(false);
  useEffect(()=>()=>{serial.current++;if(source.current) URL.revokeObjectURL(source.current);},[]);
  function clear() {
    serial.current++;if(source.current) URL.revokeObjectURL(source.current);
    source.current='';image.current=undefined;setPresent(false);setPalette([]);onPhoto('');
    if(input.current)input.current.value='';setStatus('');
  }
  async function load(file?:File) {
    if(!file)return;
    if(!['image/jpeg','image/png','image/webp','image/avif'].includes(file.type)||file.size>16*1024*1024){setStatus('Choose a JPG, PNG, WebP or AVIF image under 16 MB.');return;}
    const sequence=++serial.current, url=URL.createObjectURL(file);
    try {
      const img=new Image();img.src=url;await img.decode();
      if(sequence!==serial.current){URL.revokeObjectURL(url);return;}
      const node=canvas.current;const context=node?.getContext('2d',{willReadFrequently:true});
      if(!node||!context)throw Error();
      const ratio=Math.min(1,600/Math.max(img.naturalWidth,img.naturalHeight));
      node.width=Math.max(1,Math.round(img.naturalWidth*ratio));node.height=Math.max(1,Math.round(img.naturalHeight*ratio));
      context.clearRect(0,0,node.width,node.height);context.drawImage(img,0,0,node.width,node.height);
      const matches=suggestColours(context.getImageData(0,0,node.width,node.height).data);
      if(!matches.length)throw Error();
      const old=source.current;source.current=url;image.current=img;
      setPalette(matches);setPresent(true);onPhoto(url);if(old)URL.revokeObjectURL(old);
      onPick(matches[0]);setStatus('Tap the part you want to match, or choose a sampled colour below.');
    } catch {URL.revokeObjectURL(url);if(sequence===serial.current)setStatus('This image could not be read. Try another photograph.');}
    finally { if(input.current)input.current.value=''; }
  }
  function sample(event:React.MouseEvent<HTMLCanvasElement>) {
    const node=event.currentTarget, rect=node.getBoundingClientRect();
    const x=Math.max(0,Math.min(node.width-1,Math.floor((event.clientX-rect.left)*node.width/rect.width)));
    const y=Math.max(0,Math.min(node.height-1,Math.floor((event.clientY-rect.top)*node.height/rect.height)));
    const rgba=node.getContext('2d')?.getImageData(x,y,1,1).data;
    if(rgba && rgba[3]>120)onPick(pixelHex(rgba[0],rgba[1],rgba[2]));
  }
  return <div className={styles.photoInput}>
    <label className={styles.fileButton}><span>{present?'Choose another photo':'Choose a photograph'}</span><input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/avif" onChange={e=>void load(e.currentTarget.files?.[0])}/></label>
    <p>Your photograph stays in this tab. Only the colour goes on a shared card.</p>
    <canvas hidden={!present} ref={canvas} onClick={sample} aria-label="Your photograph for colour sampling"/>
    {status&&<p role="status">{status}</p>}
    {present&&<><div className={styles.photoColours}>{palette.filter(safeHex).map(hex=><button type="button" key={hex} style={{background:hex}} title={hex} aria-label={'Use sampled colour '+hex} onClick={()=>onPick(hex)}/>)}</div><button className={styles.textButton} onClick={clear}>Remove my photograph</button></>}
  </div>;
}
