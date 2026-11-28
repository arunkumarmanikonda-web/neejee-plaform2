'use client';

import { type ReactNode } from 'react';
import Link from 'next/link';
import { usePhotoRail } from '@/components/gallery/usePhotoRail';
import { usePhotoPlayback } from '@/components/gallery/usePhotoPlayback';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import './tile-gallery.css';

export type PieceView = { src: string; label: string; focus?: string; zoom?: number };

export function catalogueViews(images: string[]): PieceView[] {
  const photos = [...new Set(images.filter(Boolean))];
  const views = photos.map((src,i) => ({ src, label: i ? 'Photo ' + (i+1) : 'Full view' }));
  return photos.length ? [...views, {src:photos[0],label:'Detail crop',focus:'50% 62%',zoom:2.3}] : views;
}

export function TileGallery({name, views, href, onOpen, children, detailView, eager = false, initialView = 0, autoCount = 0}: {
  name:string; views:PieceView[]; href?:string; onOpen?:(index:number)=>void; children?:ReactNode; detailView?: { index:number; label:string }; eager?:boolean; initialView?:number; autoCount?:number;
}) {
  const rail = usePhotoRail(views.length, initialView);
  const playback = usePhotoPlayback(Math.min(autoCount, views.length), rail.active, rail.go);
  return <div {...playback.regionProps} className="nj-photo nj-gallery" role="group" aria-roledescription="carousel"
    aria-label={'Photographs of '+name} onKeyDown={rail.onKeyDown}>
    <div className="photo-rail nj-photo-rail" {...rail.props}>
      {views.map((view, i) => {
        const picture = <img src={view.src} loading={eager && i===0 ? 'eager' : 'lazy'} decoding="async"
          alt={name+' · '+view.label} draggable={false}
          style={{transform:view.zoom?'scale('+view.zoom+')':undefined,transformOrigin:view.focus,objectPosition:view.focus}}/>;
        return <div data-slide="" key={view.src+'-'+i} aria-hidden={rail.active!==i}>
          {href ? <Link className="nj-image-open" href={href} tabIndex={rail.active===i ? 0 : -1} aria-label={'View '+name}>{picture}</Link>
            : <button type="button" className="nj-image-open" tabIndex={rail.active===i ? 0 : -1} onClick={()=>onOpen?.(i)} aria-label={'View '+name}>{picture}</button>}
        </div>;
      })}
      {!views.length && (href ? <Link href={href} className="nj-image-open">View piece</Link> : <button onClick={()=>onOpen?.(0)}>View piece</button>)}
    </div>
    {children}
    {playback.controls && <button type="button" className="nj-photo-playback" data-playback="" aria-label={(playback.paused ? 'Play' : 'Pause')+' photos of '+name} onClick={playback.toggle}>
      {playback.paused ? <Play size={15}/> : <Pause size={15}/>}
    </button>}
    {detailView && views[detailView.index] && <button type="button" className="loom-swatch-tab"
      aria-label={(rail.active===detailView.index ? 'Return to full view of ' : detailView.label+' of ')+name}
      onClick={()=>rail.go(rail.active===detailView.index ? 0 : detailView.index)}>
      <img src={views[rail.active===detailView.index ? 0 : detailView.index].src} width={32} height={32} alt="" loading="lazy" decoding="async"/>
      <span>{rail.active===detailView.index ? 'Full view' : detailView.label}</span>
    </button>}
    {views.length>1 && <div className="loom-gallery-nav">
      <button type="button" aria-label={'Previous photo of '+name} aria-disabled={rail.active===0} onClick={()=>rail.step(-1)}><ChevronLeft size={18}/></button>
      <span className="loom-gallery-caption" aria-live={playback.controls && !playback.paused ? "off" : "polite"} aria-atomic="true">{views[rail.active]?.label} <i>{rail.active+1}/{views.length}</i></span>
      <button type="button" aria-label={'Next photo of '+name} aria-disabled={rail.active===views.length-1} onClick={()=>rail.step(1)}><ChevronRight size={18}/></button>
    </div>}
  </div>;
}
