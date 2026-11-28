'use client';
import Image from 'next/image';
import { Pause, Play } from 'lucide-react';
import { DetailViewer } from './DetailViewer';
import { usePhotoPlayback } from '@/components/gallery/usePhotoPlayback';
import './tile-gallery.css';

export function ProductPhotoGallery({product, galleryImages, activeImage, setActiveImage, onSale, discount}: {
  product:{name:string; arTryOnEligible?:boolean; aiTryOnEligible?:boolean; video?:string};
  galleryImages:string[]; activeImage:number; setActiveImage:(index:number)=>void; onSale:boolean; discount:number;
}) {
  const playback=usePhotoPlayback(galleryImages.length, activeImage, setActiveImage);
  return (
    <div {...playback.regionProps} role="group" aria-label={product.name+' photographs'} aria-roledescription="carousel">
          <div className="aspect-[4/5] bg-beige relative overflow-hidden">
            {galleryImages?.[activeImage] ? (
              <Image src={galleryImages[activeImage]} alt={product.name} fill priority sizes="(min-width:1024px) 50vw, 100vw" className="object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-mitti italic">No image</div>
            )}
            {playback.controls && <button type="button" data-playback="" className="nj-photo-playback" aria-label={(playback.paused ? 'Play' : 'Pause')+' photos of '+product.name} onClick={playback.toggle}>{playback.paused ? <Play size={16}/> : <Pause size={16}/>}</button>}
            <DetailViewer photos={galleryImages} selected={activeImage} onSelect={setActiveImage} name={product.name}/>
            {onSale && (
              <span className="absolute top-4 left-4 badge-founder">ON SALE · -{discount}%</span>
            )}
            {product.arTryOnEligible && (
              <span className="absolute top-20 right-4 bg-madder/85 text-ivory text-[10px] px-3 py-1 font-ui tracking-widest">✦ AR TRY-ON</span>
            )}
          </div>
          {product.video && (/^https?:\/\//.test(product.video) || /^\/(?!\/)/.test(product.video)) && <details className="mt-3 border-y border-mitti/20 py-3">
            <summary className="cursor-pointer font-ui text-sm">{product.aiTryOnEligible?'Watch the drape':'Watch the piece in motion'}</summary>
            {/youtu\.be|youtube\.com|vimeo\.com/i.test(product.video)
              ? <a className="inline-block my-2" href={product.video}>Open the original film</a>
              : <video className="mt-3 max-h-96 w-full bg-ivory" controls playsInline preload="none" src={product.video} aria-label={'Film of '+product.name}/>}
          </details>}
          {galleryImages?.length > 1 && (
            <div className="grid grid-cols-5 gap-2 mt-2">
              {galleryImages.map((img: string, i: number) => (
                <button key={i} aria-pressed={activeImage===i} aria-label={`View photograph ${i+1}`} onClick={() => setActiveImage(i)}
                  className={`aspect-square overflow-hidden bg-beige ${activeImage === i ? 'ring-2 ring-madder' : ''}`}>
                  <Image src={img} alt={`View ${i + 1}`} width={150} height={150} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
    </div>
  );
}
