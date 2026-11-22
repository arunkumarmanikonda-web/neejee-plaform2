import type { ReactNode } from 'react';
import type { ProductCardData } from '@/components/product/ProductCard';
import type { editLead } from '@/lib/shop-edit-catalog';
import { studies, type Study } from '@/lib/shop-studies';
import { studyTextiles } from '@/lib/study-textiles';
import { buildPricing } from '@/lib/catalog/pricing-read';
import { formatINR } from '@/lib/money';
import './home-print.css';

export const homeStudyIds = ['haldi', 'wine-suit', 'sage', 'indigo-suit'];

type PrintPiece = {
  name: string;
  caption: string;
  image?: string;
  alias?: string;
  price?: string;
  href?: string;
};

function cataloguePiece(piece: ProductCardData): PrintPiece {
  const facts = [piece.colours?.join(' / '), piece.craft || piece.technique, piece.material, piece.region || piece.state];
  return {
    name:piece.name, alias:piece.shortName || undefined, caption:piece.poeticLine || [...new Set(facts.filter(Boolean))].join(' · '),
    price: formatINR(buildPricing(piece).effectivePrice), image: piece.images[0],
    href: '/products/' + encodeURIComponent(piece.slug),
  };
}

function collectionPiece(piece: Study, preview: boolean): PrintPiece {
  return { name:piece.name, alias:piece.alias, caption:piece.caption, image:piece.image, price:preview ? formatINR(piece.price) : undefined };
}

function Sheet({ children, label }: { children:ReactNode; label:string }) {
  return <section className="folio-sheet" aria-label={label}>
    <div className="folio-mast">
      <img src={process.env.NEEJEE_SIGNATURE_SRC || '/brand/identity/lockup.svg'} alt="NEEJEE · Found. Personal." width={688} height={163}/>
    </div>
    {children}
  </section>;
}

function Shelf({ title, pieces, note }: { title:string; pieces:PrintPiece[]; note?:string }) {
  if (!pieces.length) return null;
  const single = pieces.length === 1;
  return <Sheet label={title}>
    <h2 className="folio-heading">{title}</h2>
    {note && <p className="folio-subtitle">{note}</p>}
    <div className={'folio-shelf' + (single ? ' folio-solo' : '')}>
      {pieces.map((p, i)=><article key={p.href || p.name + i} className="folio-card">
        {p.image && <img className="folio-product-image" src={p.image} alt={p.name}/>}
        <div className="folio-ticket">
          {p.alias && <p className="folio-kicker">{p.alias}</p>}
          <h3>{p.href ? <a href={p.href}>{p.name}</a> : p.name}</h3>
          {p.caption && <p className="folio-copy">{p.caption}</p>}
          {p.price && <p className="folio-price">{p.price}</p>}
        </div>
      </article>)}
    </div>
  </Sheet>;
}

type Props = {
  lead:Awaited<ReturnType<typeof editLead>>;
  fashion:ProductCardData[] | null;
  curated:ProductCardData[];
  arrivals:ProductCardData[];
  founderNote:string | null;
  preview:boolean;
};

export function HomePrint({lead,fashion,curated,arrivals,founderNote,preview}:Props) {
  const neel = studies.find(piece=>piece.id === 'neel')!;
  const stock = lead?.cover ? lead : null;
  const hero = stock ? {
    title:stock.name, alias:stock.shortName || '', image:stock.cover!, price:formatINR(stock.price), detail:'',
    description:stock.description?.trim() || stock.poeticLine?.trim() || [...new Set([stock.colour,stock.craft,stock.material,stock.region].filter(Boolean))].join(' · '),
  } : {
    title:neel.name, alias:neel.alias, image:'/brand/campaign/neel-courtyard.webp',
    price:preview ? formatINR(neel.price) : '', description:neel.detail, detail:studyTextiles.neel.reference,
  };
  const items = fashion ? fashion.map(cataloguePiece) : homeStudyIds.map(id=>collectionPiece(studies.find(p=>p.id===id)!,preview));
  const founder = founderNote?.trim().split(/\n\s*\n/)[0];
  return <div className="neejee-home-print">
    <Sheet label="The saree edit">
      <div className="folio-feature">
        <img className="folio-hero-image" src={hero.image} alt={hero.title}/>
        <div className="folio-feature-copy">
          <p className="folio-kicker">{hero.alias ? 'The saree edit · '+hero.alias : 'The saree edit'}</p>
          <h1>{hero.title}</h1>
          {hero.description && <p className="folio-story">{hero.description}</p>}
          {hero.detail && <p className="folio-reference">{hero.detail}</p>}
          {hero.price && <p className="folio-hero-price">{hero.price}{!stock && <small>Preview price</small>}</p>}
        </div>
      </div>
      <div className="folio-foot"><p><strong>Aaina</strong> Try a saree with your own blouse, juttis or jewellery.</p>
        {founder && <p><strong>Nidhi’s note</strong> {founder}</p>}
      </div>
    </Sheet>
    <Shelf title="Sarees &amp; suit sets" pieces={items} note={fashion ? undefined : preview ? 'Collection preview · Sample prices' : 'Collection preview · Enquiries welcome'}/>
    {curated.length>0 && <Shelf title="From the founder’s edit" pieces={curated.slice(0,4).map(cataloguePiece)}/>}
    {curated.length>4 && <Shelf title="From the founder’s edit" pieces={curated.slice(4).map(cataloguePiece)}/>}
    {arrivals.length>0 && <Shelf title="Just arrived" pieces={arrivals.map(cataloguePiece)}/>}
  </div>;
}
