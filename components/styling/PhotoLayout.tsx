'use client';
import {useState} from 'react';
import ui from './PairingRoom.module.css';
export type PhotoLayer={id:string;name:string;src:string};
type Placement={x:number;y:number;width:number};
const bound=(n:number,min:number,max:number)=>Math.min(max,Math.max(min,n));
export function PhotoLayout({background,items,room}:{background?:string;items:PhotoLayer[];room:boolean}){
  const [custom,setCustom]=useState<Record<string,Placement>>({}),[active,setActive]=useState('');
  const selected=items.find(i=>i.id===active)||items[0];
  const placement=(id:string):Placement=>custom[id]||{x:id===items[0].id?41:72,y:id===items[0].id?55:22+48*(Math.max(0,items.findIndex(i=>i.id===id)-1)/Math.max(1,items.length-2)),width:id===items[0].id?48:25};
  const position=selected?placement(selected.id):null;
  if(!selected||!position)return null;
  function adjust(id:string,change:Partial<Placement>){setCustom(prev=>({...prev,[id]:{...placement(id),...prev[id],...change}}));}
  return <details className={ui.layout}><summary>Arrange the photos yourself</summary><p>{room?'Place pieces on your room photo or on the plain board.':'Compare the proportions on your photo or on the plain board.'} Drag a piece to move it.</p>
    <div className={ui.canvas} aria-label="Interactive photo arrangement">
      {background&&<img src={background} alt={room?'Room background':'Photo background'} className={ui.backdrop}/>}
      {items.map(i=>{const pos=placement(i.id);return <button key={i.id} type="button" className={ui.layer} aria-label={'Position '+i.name} aria-pressed={selected.id===i.id}
        style={{left:pos.x+'%',top:pos.y+'%',width:pos.width+'%',zIndex:selected.id===i.id?2:1}}
        onClick={()=>setActive(i.id)}
        onPointerDown={e=>{setActive(i.id);e.currentTarget.setPointerCapture(e.pointerId);}}
        onPointerMove={e=>{if(!e.currentTarget.hasPointerCapture(e.pointerId)||!e.buttons)return;
          const rect=e.currentTarget.parentElement!.getBoundingClientRect();adjust(i.id,{x:bound(100*(e.clientX-rect.left)/rect.width,5,95),y:bound(100*(e.clientY-rect.top)/rect.height,5,95)});}}
        onPointerUp={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}}>
        <img src={i.src} alt="" draggable={false}/></button>;})}
    </div>
    <label className={ui.option}>Adjust piece<select value={selected.id} onChange={e=>setActive(e.target.value)}>{items.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select></label>
    <div className={ui.sliders}>{([['width','Size',12,92],['x','Across',5,95],['y','Up or down',5,95]] as const).map(([key,label,min,max])=>
      <label key={key}>{label}<input type="range" min={min} max={max} value={position[key]} onChange={e=>adjust(selected.id,{[key]:Number(e.target.value)})}/></label>)}</div>
    <button type="button" className={ui.remove} onClick={()=>setCustom({})}>Reset positions</button>
  </details>;
}
