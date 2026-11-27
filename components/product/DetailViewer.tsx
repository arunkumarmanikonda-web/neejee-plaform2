'use client';
import { useRef, useState } from 'react';

export function DetailViewer({ photos, selected, onSelect, name }: {
  photos: string[]; selected: number; onSelect: (index:number)=>void; name: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [zoom, setZoom] = useState(false);
  if (!photos[selected]) return null;
  function change(index: number) { setZoom(false); onSelect(index); }
  return <>
    <button type="button" className="absolute bottom-3 right-3 bg-ivory text-kohl border border-mitti/40 px-4 py-3 font-ui text-sm" onClick={()=>{setZoom(false);dialog.current?.showModal();}}>Look closely</button>
    <dialog ref={dialog} aria-label={name+' photograph viewer'} className="m-auto w-[94vw] max-w-4xl max-h-[94dvh] bg-ivory text-kohl p-4 backdrop:bg-black/70">
      <div className="flex justify-between items-center gap-4 mb-3"><h2 className="font-display text-lg">{name}</h2><button type="button" className="underline px-2 py-2" onClick={()=>dialog.current?.close()}>Close</button></div>
      <div tabIndex={0} aria-label="Photograph. Scroll to explore while enlarged." className="overflow-auto h-[58dvh] bg-beige">
        <img src={photos[selected]} alt={name+', photograph '+(selected+1)} style={zoom?{width:'200%',maxWidth:'none',height:'auto'}:{width:'100%',height:'100%',objectFit:'contain'}}/>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 mt-3 font-ui text-sm"><button type="button" className="underline p-2" aria-pressed={zoom} onClick={()=>setZoom(!zoom)}>{zoom?'Fit to screen':'Enlarge detail'}</button>
        <span aria-live="polite">{selected+1} of {photos.length}</span>
        {photos.length>1&&<div className="flex gap-2"><button type="button" className="underline p-2" onClick={()=>change((selected+photos.length-1)%photos.length)}>Previous</button><button type="button" className="underline p-2" onClick={()=>change((selected+1)%photos.length)}>Next</button></div>}
      </div>
    </dialog>
  </>;
}
