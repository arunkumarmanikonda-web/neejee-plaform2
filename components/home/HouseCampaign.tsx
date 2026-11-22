'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, ShoppingBag } from 'lucide-react';
import { usePhotoRail } from '@/components/gallery/usePhotoRail';
import { studies } from '@/lib/shop-studies';
import { changeSample, sampleShopping } from '@/lib/sample-bag';
import { defaultStyling, lookUrl } from '@/lib/stylebook';
import { studioHref } from '@/lib/studio';
import { formatINR } from '@/lib/money';
import type { editLead } from '@/lib/shop-edit-catalog';
import styles from './HouseCampaign.module.css';

type Photograph = { src: string; label: string; alt: string };
type Feature = {
  id: string;
  name: string;
  shade: string;
  description: string;
  price: number;
  photos: Photograph[];
  styling?: string;
  productUrl?: string;
};

const photographs = {
  neel: [
    {src:'/brand/campaign/neel-courtyard.webp',label:'Full drape',alt:'The Neel saree worn full-length, its ivory dot pattern and striped edge visible against indigo.'},
    {src:'/brand/campaign/indigo-detail.webp',label:'Pallu detail',alt:'Ivory dotted diamonds and parallel stripes across the indigo pallu.'},
  ],
  surkh: [
    {src:'/brand/campaign/surkh-verandah.webp',label:'Full drape',alt:'The Surkh saree worn full-length, with a vermilion checked body and a broad wine border.'},
    {src:'/brand/study-views/surkh.webp',label:'Border detail',alt:'The wine and gold floral border beside the fine checks of Surkh.'},
  ],
};
const editorial = (['neel','surkh'] as const).map((id):Feature => {
  const saree = studies.find(piece => piece.id===id)!;
  return { id, name:saree.name, shade:saree.shade, price:saree.price,
    description:id==='neel' ? 'An indigo saree with an ivory Bandhani motif and striped pallu.' : 'A vermilion saree with a Gharchola check and a wine-coloured floral border.',
    photos:photographs[id], styling:lookUrl('/ai/mirror',defaultStyling(id)),
  };
});

type Lead = Awaited<ReturnType<typeof editLead>>;

function featuredStock(piece: NonNullable<Lead>): Feature {
  const photos = [...new Set([piece.cover, ...piece.images].filter((src):src is string=>Boolean(src)))].slice(0, 3);
  return {
    id:piece.slug, name:piece.name, shade:piece.colour || '', price:piece.price,
    description:[...new Set([piece.colour, piece.craft, piece.material, piece.region].filter(Boolean))].join(' · '),
    photos:photos.map((src, i)=>({src,label:i===0 ? 'Main view' : 'View '+(i+1),alt:piece.name+', view '+(i+1)})),
    productUrl:'/products/'+encodeURIComponent(piece.slug),
    styling:piece.mirror ? studioHref('mirror',piece.slug) : undefined,
  };
}

function FeatureGallery({ piece, visible, priority }: { piece: Feature; visible: boolean; priority: boolean }) {
  const rail = usePhotoRail(piece.photos.length);
  const { go } = rail;
  useEffect(() => { if (!visible) go(0); }, [visible, go]);
  return <div className={styles.album} data-visible={visible} aria-hidden={!visible}
    ref={element=>{element?.toggleAttribute('inert',!visible);}} role="group" aria-label={'Photographs of '+piece.name} onKeyDown={rail.onKeyDown}>
    <div className={'photo-rail '+styles.track} {...rail.props}>
      {piece.photos.map((photo, i)=><div data-slide="" key={photo.src} aria-hidden={rail.active!==i}>
        <img src={photo.src} alt={photo.alt} draggable={false} width={1500} height={1000}
          className={styles.photo} fetchPriority={priority && i===0 ? 'high' : 'auto'} decoding="async"/>
      </div>)}
    </div>
    {piece.photos.length>1 && <div className={styles.views} role="group" aria-label="Choose a photograph">
      <Camera size={16} strokeWidth={1.5} aria-hidden="true"/>
      {piece.photos.map((photo, i)=><button type="button" key={photo.src} aria-pressed={rail.active===i} onClick={()=>rail.go(i)}>{photo.label}</button>)}
    </div>}
  </div>;
}

export function HouseCampaign({ lead, preview, email }: { lead: Lead; preview: boolean; email: string }) {
  const [selected,setSelected] = useState(0);
  const router = useRouter();
  const stock = lead?.cover ? featuredStock(lead) : null;
  const piece = stock || editorial[selected];
  const alternate = editorial[1-selected];
  const canSample = !stock && preview && sampleShopping;

  function addToBag() {
    changeSample(piece.id, 1);
    router.push('/cart?bag=sample');
  }

  return <section className={styles.campaign} aria-label="Featured saree">
    <div className={styles.spread}>
      <div className={styles.gallery}>
        {(stock ? [stock] : editorial).map((feature, index)=><FeatureGallery key={feature.id} piece={feature} visible={feature.id===piece.id} priority={index===0}/>)}
      </div>
      <div className={styles.paper}>
        <div className={styles.copy}>
          <p className={styles.kicker}>The saree edit</p>
          <h1 aria-live="polite" aria-atomic="true" className={styles.title} data-catalogue={!!stock}>{piece.name}</h1>
          {piece.description && <p className={styles.line}>{piece.description}</p>}
          {(stock || canSample) && <p className={styles.price}>{formatINR(piece.price)}{canSample && <small>Preview price</small>}</p>}
          <div className={styles.actions}>
            {piece.productUrl ? <Link className={styles.primary} href={piece.productUrl}>Shop this saree</Link> :
              canSample ? <button type="button" className={styles.primary} aria-label={'Add '+piece.name+' to bag'} onClick={addToBag}><ShoppingBag size={17} strokeWidth={1.5}/>Add to bag</button> :
              <a className={styles.primary} href={'mailto:'+email+'?subject='+encodeURIComponent('Enquiry about '+piece.name)}>Enquire about this saree</a>}
            {piece.styling && <Link className={styles.secondary} href={piece.styling}>Try on with Aaina</Link>}
          </div>
        </div>
        {!stock && <button className={styles.other} type="button" onClick={()=>setSelected(1-selected)} aria-label={'See '+alternate.name+', the '+alternate.shade.toLowerCase()+' saree'}>
          <img src={alternate.photos[1].src} alt="" width={70} height={65} draggable={false}/>
          <span><small>Also in this edit</small><strong>View {alternate.name}<i> · {alternate.shade}</i></strong></span>
        </button>}
      </div>
    </div>
  </section>;
}
