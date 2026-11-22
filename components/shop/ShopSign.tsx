import Link from 'next/link';
import type { EditSlug } from '@/lib/shop-edits';
import './shop.css';

const signs = {
  entrance: ['निजी', 'The Neejee shop', 'Sarees, suit sets and objects for home.'],
  sarees: ['साड़ियाँ', 'The saree shop', 'Find your colour. Unfold the border.'],
  suits: ['सूट', 'The suit shop', 'Kurta, trousers, dupatta. See them together.'],
  clothing: ['पहनावा', 'Sarees & suit sets', 'See the whole look, down to the jutti.'],
  home: ['घर', 'Objects for home', 'Find a piece for your corner of the house.'],
  furniture: ['फ़र्नीचर', 'Furniture', 'Explore pieces for the home.'],
} as const;

export function ShopSign({department}: {department: EditSlug | 'entrance'}) {
  const [hindi, title, subtitle] = signs[department];
  const domestic = department === 'home' || department === 'furniture';
  return <header className={'nj-shop-sign' + (domestic ? ' nj-home-sign' : '')}>
    <div className="nj-sign-copy"><span lang="hi">{hindi}</span><h1>{title}</h1><p>{subtitle}</p></div>
    <div className="nj-sign-image"><img src={domestic ? '/brand/studio-imagine.webp' : '/brand/bazaar/counter-banner.webp'} alt={domestic ? 'A wooden chest in an Indian interior' : 'Folded textiles with red, plum and turmeric borders spread across a shop counter'} width="1800" height="666" fetchPriority="high"/></div>
  </header>;
}
export function StoreAisles({active}:{active:string}) {
  const links = [['sarees','Sarees'],['suits','Suit sets'],['home','Home & objects']];
  return <nav aria-label="Shop departments" className="nj-aisles">
    {links.map(([id,label]) => <Link key={id} href={'/edits/'+id} aria-current={active===id?'page':undefined}>{label}</Link>)}
    <Link href="/looks" className="nj-looklink">Style a look <span aria-hidden="true">↗</span></Link>
  </nav>;
}
