'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ShoppingBag, ZoomIn } from 'lucide-react';
import { ClothViewer } from './ClothViewer';
import { usePhotoRail } from '@/components/gallery/usePhotoRail';
import { studies } from '@/lib/shop-studies';
import { studyTextiles } from '@/lib/study-textiles';
import { changeSample, sampleShopping } from '@/lib/sample-bag';
import { defaultStyling, lookUrl } from '@/lib/stylebook';
import { studioHref } from '@/lib/studio';
import { formatINR } from '@/lib/money';
import type { editLead } from '@/lib/shop-edit-catalog';
import styles from './HouseCampaign.module.css';

type Photograph = { src: string; label: string; alt: string; display?: string; srcSet?: string };
type Feature = {
  id: string; name: string; alias?: string; hindi?: string; shade: string; description: string;
  price: number; photos: Photograph[]; swatch?: string; region?: string; styling?: string; productUrl?: string;
};

const campaignPhotos = {
  neel: { hindi:'नील', full:'/brand/campaign/neel-courtyard.webp', detail:'/brand/campaign/indigo-detail.webp', label:'Pallu detail' },
  surkh: { hindi:'सुर्ख़', full:'/brand/campaign/surkh-verandah.webp', detail:'/brand/study-views/surkh.webp', label:'Border detail' },
  haldi: { hindi:'हल्दी', full:'/brand/bazaar/haldi.webp', detail:'/brand/study-views/haldi.webp', label:'Border detail' },
};

const editorial = (['surkh','neel','haldi'] as const).map((id): Feature => {
  const saree = studies.find(piece => piece.id === id)!;
  const photos = campaignPhotos[id];
  const base = '/brand/counter/'+id;
  const srcSet = id === 'haldi' ? base+'-480.webp 480w, '+base+'-800.webp 588w' :
    base+'-480.webp 480w, '+base+'-800.webp 800w, '+base+'-1200.webp 1200w';
  return {
    id, name:saree.name, alias:saree.alias, hindi:photos.hindi, shade:saree.shade, price:saree.price,
    description:saree.caption, region:studyTextiles[id].region, styling:lookUrl('/ai/mirror',defaultStyling(id)), swatch:base+'-swatch.webp',
    photos:[
      {src:photos.full, display:base+'-800.webp', srcSet, label:'Full drape', alt:saree.shade+' saree shown from shoulder to hem.'},
      {src:photos.detail, display:base+'-detail.webp', label:photos.label, alt:id === 'neel' ? studyTextiles[id].pallu : studyTextiles[id].border},
    ],
  };
});

type Lead = Awaited<ReturnType<typeof editLead>>;
function featuredStock(piece: NonNullable<Lead>): Feature {
  const photos = [...new Set([piece.cover, ...piece.images].filter((src):src is string => Boolean(src)))].slice(0,3);
  return {
    id:piece.slug, name:piece.name, alias:piece.shortName && !piece.name.toLowerCase().includes(piece.shortName.toLowerCase()) ? piece.shortName : undefined,
    shade:piece.colour || '', price:piece.price, region:piece.region || undefined,
    description:piece.description?.trim() || piece.poeticLine?.trim() || [...new Set([piece.colour,piece.craft,piece.material].filter(Boolean))].join(' · '),
    photos:photos.map((src,i) => ({src,label:i ? 'View '+(i+1) : 'Main view',alt:piece.name+', view '+(i+1)})),
    productUrl:'/products/'+encodeURIComponent(piece.slug), styling:piece.mirror ? studioHref('mirror',piece.slug) : undefined,
  };
}

function RailPhoto({photo,first,preview}: {photo:Photograph;first:boolean;preview?:string}) {
  const [failure,setFailure] = useState<'original'|'unavailable'>();
  if (failure === 'unavailable') return <div className={styles.unavailable} role="status">
    <span>{photo.label} photograph unavailable</span><button type="button" onClick={()=>setFailure(undefined)}>Retry photo</button>
  </div>;
  const source = failure ? photo.src : preview || photo.display || photo.src;
  return <img className={styles.photo} src={source} srcSet={failure || preview ? undefined : photo.srcSet}
    sizes={photo.srcSet ? '(max-width: 760px) 100vw, (max-width: 1600px) 55vw, 880px' : undefined}
    alt={photo.alt} width={1200} height={800} draggable={false} loading={first ? 'eager' : 'lazy'}
    fetchPriority={first ? 'high' : 'low'} decoding="async"
    onError={()=>setFailure(source !== photo.src ? 'original' : 'unavailable')}/>;
}

function FeatureGallery({piece,onInspect}: {piece:Feature;onInspect:()=>void}) {
  const rail = usePhotoRail(piece.photos.length);
  const inspectLabel = piece.productUrl ? 'Look closer' : piece.id === 'neel' ? 'Unfold the pallu' : 'See the border';
  return <div className={styles.gallery}>
    <div className={styles.frame}>
      <div className={'photo-rail '+styles.track} {...rail.props} onKeyDown={rail.onKeyDown} role="group" aria-label={'Photographs of '+piece.name}>
        {piece.photos.map((photo,i)=><div data-slide="" key={photo.src} aria-hidden={rail.active!==i}>
          <RailPhoto photo={photo} first={i===0} preview={i>0 && rail.active!==i ? piece.swatch : undefined}/>
        </div>)}
      </div>
    </div>
    <div className={styles.galleryFoot}>
      {piece.photos.length>1 && <div className={styles.views} role="group" aria-label="Choose a photograph">
        {piece.photos.map((photo,i)=><button type="button" key={photo.src} aria-pressed={rail.active===i} onClick={()=>rail.go(i)}>{photo.label}</button>)}
      </div>}
      <button type="button" className={styles.inspect} onClick={onInspect} aria-haspopup="dialog"><ZoomIn aria-hidden size={16}/>{inspectLabel}</button>
    </div>
  </div>;
}

const swatchNotes: Record<string,string> = {
  surkh:'Gold checks', neel:'Ivory diamonds', haldi:'Temple border',
};

function CampaignPortrait() {
  const [failed,setFailed] = useState(false);
  const root = '/brand/surkh-campaign/';
  if (failed) return <img className={styles.fallbackPhoto} src="/brand/counter/surkh-800.webp" alt="Surkh in vermilion with a wine and gold border"/>;
  return <picture className={styles.portrait}>
    <source media="(max-width: 700px)" sizes="100vw"
      srcSet={root+'portrait-480.webp 480w, '+root+'portrait-768.webp 768w'}/>
    <img src={root+'courtyard-1440.webp'} srcSet={root+'courtyard-960.webp 960w, '+root+'courtyard-1440.webp 1440w, '+root+'courtyard-1672.webp 1672w'}
      sizes="(min-width: 1700px) 1400px, 90vw" width={1672} height={941} fetchPriority="high" loading="eager" decoding="async"
      onError={()=>setFailed(true)} alt="Surkh in the afternoon sun, its wine and gold pallu opened against rose plaster and green shutters."/>
  </picture>;
}

export function HouseCampaign({lead,preview,email}: {lead:Lead;preview:boolean;email:string}) {
  const [selected,setSelected] = useState(0);
  const [inspection,setInspection] = useState<number|null>(null);
  const trigger = useRef<HTMLElement|null>(null);
  const router = useRouter();
  const stock = lead?.cover ? featuredStock(lead) : null;
  const piece = stock || editorial[selected];
  const canSample = !stock && preview && sampleShopping;
  const campaignPortrait = !stock && piece.id==='surkh';
  const detailIndex = piece.photos.length>1 ? 1 : 0;
  const inspected = inspection === null ? null : piece.photos[inspection];

  function inspect(index:number) {
    trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setInspection(index);
  }

  return <section className={styles.campaign} data-colour={stock ? 'stock' : piece.id} aria-label="Featured saree">
    <div className={styles.stage} data-poster={campaignPortrait}>
      <div className={styles.visual}>
        {campaignPortrait ? <CampaignPortrait/> :
          <FeatureGallery key={piece.id} piece={piece} onInspect={()=>inspect(detailIndex)}/>}
      </div>
      <div className={styles.copy}>
        <div className={styles.nameGroup}>
          <p className={styles.department}><Link href="/edits/sarees">Sarees</Link>{piece.hindi && <><span aria-hidden="true"> / </span><span lang="hi">{piece.hindi}</span></>}</p>
          {piece.alias && <p className={styles.alias}>{piece.alias}</p>}
        </div>
        <div className={styles.details}>
          <h1 aria-live="polite" className={styles.title}>{piece.name}</h1>
          {piece.description && <p className={styles.line}>{piece.description}</p>}
          {stock && piece.region && <p className={styles.origin}>{piece.region}</p>}
          <div className={styles.actions}>
            {piece.productUrl ? <Link className={styles.primary} href={piece.productUrl}>Shop this saree · {formatINR(piece.price)}</Link> :
              canSample ? <button type="button" className={styles.primary} aria-label={'Add '+piece.name+' to bag'} onClick={()=>{changeSample(piece.id,1);router.push('/cart?bag=sample');}}>
                <ShoppingBag size={17} strokeWidth={1.5} aria-hidden/>Add to bag <span>·</span> {formatINR(piece.price)}</button> :
              <a className={styles.primary} href={'mailto:'+email+'?subject='+encodeURIComponent('Enquiry about '+piece.name)}>Enquire about this saree</a>}
            {piece.styling && <Link className={styles.secondary} href={piece.styling}>Style this saree in Aaina</Link>}
          </div>
          {campaignPortrait && <div className={styles.inspectLinks}>
            <button type="button" onClick={()=>inspect(0)} aria-haspopup="dialog">See the full drape</button>
            <span aria-hidden="true">·</span>
            <button type="button" onClick={()=>inspect(detailIndex)} aria-haspopup="dialog"><ZoomIn aria-hidden size={15}/>Inspect the border</button>
          </div>}
          {canSample && <small className={styles.preview}>Preview price</small>}
        </div>
      </div>
    </div>
    {!stock && <nav className={styles.swatchRail} aria-label="Choose a featured saree">
      {editorial.map((item,i)=><button type="button" key={item.id} aria-label={'View '+item.alias+', '+item.shade} aria-pressed={selected===i} onClick={()=>setSelected(i)}>
        <img src={item.swatch} width={72} height={54} alt=""/>
        <span><strong>{item.alias}</strong><small>{swatchNotes[item.id]}</small></span>
        {selected===i && <Check size={15} aria-hidden/>}
      </button>)}
    </nav>}
    {inspected && <ClothViewer name={piece.name} photo={inspected} label={inspected.label} styling={piece.styling} onClose={()=>{setInspection(null);trigger.current?.focus();}}/>}
  </section>;
}
