import Link from 'next/link';
import type { EditSlug } from '@/lib/shop-edits';
import './shop.css';
import './dressing.css';

const signs = {
  entrance: ['निजी', 'The Neejee shop', 'Sarees, suit sets and objects for home.'],
  sarees: ['साड़ियाँ', 'The saree shop', 'Explore by colour, weave and region.'],
  suits: ['सूट', 'The suit shop', 'Kurta, trousers, dupatta. See them together.'],
  clothing: ['पहनावा', 'Sarees & suit sets', 'See the whole look, down to the jutti.'],
  home: ['घर', 'The home collection', 'Brass, pottery and objects for everyday rituals.'],
  furniture: ['फ़र्नीचर', 'Furniture', 'Explore pieces for the home.'],
} as const;

export function ShopSign({department}: {department: EditSlug | 'entrance'}) {
  const [hindi, title, subtitle] = signs[department];
  const domestic = department === 'home' || department === 'furniture';
  return <header className={'nj-shop-sign nj-sign-'+department + (domestic ? ' nj-home-sign' : '')}>
    <div className="nj-sign-copy"><div className="nj-sign-label"><img className="nj-shop-sprig" src="/brand/house/floral-sprig.svg" alt=""/><span lang="hi">{hindi}</span><h1>{title}</h1><p>{subtitle}</p></div></div>
    <div className="nj-sign-image"><img src={department==='furniture' ? '/brand/journey-furniture.webp' : domestic ? '/brand/house/home-objects.webp' : department === 'suits' ? '/brand/bazaar/wine-suit.webp' : '/brand/bazaar/counter-banner.webp'} alt={department==='furniture' ? 'A painted wooden bed with turned legs' : domestic ? 'A brass urli with marigolds, blue floral pottery and printed cotton on a wooden cabinet' : department === 'suits' ? 'A wine kurta and cream dupatta worn together' : 'Folded textiles with red, plum and turmeric borders spread across a shop counter'} width="1800" height="666" fetchPriority="high"/></div>
  </header>;
}
export function StoreAisles({active}:{active:string}) {
  const links = [['sarees','Sarees'],['suits','Suit sets'],['home','Home & objects']];
  return <nav aria-label="Shop departments" className="nj-aisles">
    {links.map(([id,label]) => <Link key={id} href={'/edits/'+id} aria-current={active===id?'page':undefined}>{label}</Link>)}
    <Link href="/looks" className="nj-looklink">Styling ideas</Link>
  </nav>;
}
