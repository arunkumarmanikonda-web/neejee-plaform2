import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { CatalogueGrid } from '@/components/product/ProductCard';
import { ShopSign } from '@/components/shop/ShopSign';
import { StudyShelf } from '@/components/shop/StudyShelf';
import { editHref, getEdit } from '@/lib/shop-edits';
import { readEdit } from '@/lib/shop-edit-catalog';
import { previewPricingEnabled, studyIdsFor } from '@/lib/shop-studies';
import { TextileGuide } from '@/components/shop/TextileGuide';
import { sareeVocabulary } from '@/lib/saree-vocabulary';
import { getPublicContact } from '@/lib/public-contact';

export const dynamic='force-dynamic';
type Props = {params: Promise<{slug:string}>;searchParams: Promise<{piece?:string;page?:string;colour?:string;sort?:string;textile?:string}>};
export async function generateMetadata(props: Props) {
  const params = await props.params;
  const edit = getEdit(params.slug);
  return edit ? {title:edit.name+' shop',description:edit.note,alternates:{canonical:editHref(edit.slug)}} : {};
}
export default async function Page(props: Props) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const edit = getEdit(params.slug);
  if (!edit) notFound();
  const colour = typeof searchParams.colour==='string' ? searchParams.colour.slice(0,100) : '';
  const sort = ['newest','name'].includes(searchParams.sort || '') ? searchParams.sort! : 'featured';
  const textile = typeof searchParams.textile==='string'?searchParams.textile.trim().slice(0,100):'';
  const data = await readEdit(edit, Number(searchParams.page || 1), colour, sort, textile).catch(() => null);
  const ids = studyIdsFor(edit.slug);
  const {email} = await getPublicContact();
  const preview = previewPricingEnabled();
  function url(c=colour, s=sort, page=1) {
    const q = new URLSearchParams();
    if(c) q.set('colour',c);
    if(textile) q.set('textile',textile);
    if(s!=='featured') q.set('sort',s);
    if(page>1) q.set('page',String(page));
    return '/edits/'+params.slug+(q.size?'?'+q:'');
  }
  return <><Header shop/><main className="house-collection">
    <ShopSign department={edit.slug}/><div className="nj-market house-shelf">
    {data && data.total > 0 ? <section className="nj-shelf" aria-label="Shop available pieces">
      <div className="nj-shelf-head"><div><h2>The collection</h2><p>{data.matches} {data.matches===1?'piece':'pieces'}</p></div></div>
      <div className="nj-tools"><div className="nj-filters" aria-label="Filter by colour"><Link href={url('')} aria-current={!colour}>All</Link>
        {data.colours.map(c=><Link key={c} href={url(c)} aria-current={colour===c}>{c}</Link>)}</div>
        <div className="nj-filters" aria-label="Sort collection">{[['featured','Featured'],['newest','Newest'],['name','A to Z']].map(([s,label])=><Link key={s} href={url(colour,s)} aria-current={sort===s}>{label}</Link>)}</div></div>
      {edit.slug==='sarees'&&<form className="nj-catalogue-search" action={editHref(edit.slug)}><label className="nj-textile-search">Textile or region<input name="textile" list="nj-live-textiles" defaultValue={textile} placeholder="e.g. Bandhani or Gujarat"/></label>
        <datalist id="nj-live-textiles">{sareeVocabulary.map(t=><option key={t.id} value={t.name}/>)}</datalist>
        {colour&&<input type="hidden" name="colour" value={colour}/>}<input type="hidden" name="sort" value={sort}/><button className="nj-piece-link">Find pieces</button>{textile&&<Link href={editHref(edit.slug)} className="nj-piece-link">Clear filters</Link>}</form>}
      <CatalogueGrid textiles={edit.slug==='sarees'||edit.slug==='suits'} products={data.pieces.map(p=>({...p,images:p.cover?[p.cover,...p.images.filter(i=>i!==p.cover)]:p.images}))}/>
      {!data.matches && <p className="nj-no-results">No pieces match this selection. <Link className="nj-text-link" href={editHref(edit.slug)}>See all pieces</Link></p>}
      {data.pages>1 && <nav className="nj-aisles" aria-label="Collection pages">{data.page>1&&<Link href={url(colour,sort,data.page-1)}>Previous</Link>}<span>Page {data.page} of {data.pages}</span>{data.page<data.pages&&<Link href={url(colour,sort,data.page+1)}>Next</Link>}</nav>}
      {edit.slug==='sarees'&&<TextileGuide/>}
    </section> : null}
    {ids.length>0 && (!data?.total || ids.includes(searchParams.piece || '')) ? <StudyShelf initialPiece={searchParams.piece} key={edit.slug} ids={ids} preview={preview} email={email}/> : !data?.total &&
      <section className="nj-empty"><h2>{data?'More pieces are on their way':'The catalogue is temporarily unavailable'}</h2><Link className="nj-primary" href="/products">Shop available pieces</Link></section>}
    <nav className="nj-aisles mt-7" aria-label="Help choosing">{ids.length ? <><Link href="/looks">Saree styling ideas</Link><Link href="/ai/mirror">Try on with Aaina</Link><Link href="/counter">Compare sarees</Link></> : <Link href="/ai/imagine">See it in my room</Link>}</nav>
  </div></main><Footer/></>;
}
