import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ProductCard } from '@/components/product/ProductCard';
import { ShopSign, StoreAisles } from '@/components/shop/ShopSign';
import { StudyShelf } from '@/components/shop/StudyShelf';
import { editHref, getEdit } from '@/lib/shop-edits';
import { readEdit } from '@/lib/shop-edit-catalog';
import { previewPricingEnabled, studyIdsFor } from '@/lib/shop-studies';
import { getPublicContact } from '@/lib/public-contact';

export const dynamic='force-dynamic';
type Props = {params:{slug:string};searchParams:{page?:string;colour?:string;sort?:string}};
export function generateMetadata({params}: Props) {
  const edit = getEdit(params.slug);
  return edit ? {title:edit.name+' shop',description:edit.note,alternates:{canonical:editHref(edit.slug)}} : {};
}
export default async function Page({params,searchParams}: Props) {
  const edit = getEdit(params.slug);
  if (!edit) notFound();
  const colour = typeof searchParams.colour==='string' ? searchParams.colour.slice(0,100) : '';
  const sort = ['newest','name'].includes(searchParams.sort || '') ? searchParams.sort! : 'featured';
  const data = await readEdit(edit, Number(searchParams.page || 1), colour, sort).catch(() => null);
  const ids = studyIdsFor(edit.slug);
  const {email} = await getPublicContact();
  const preview = previewPricingEnabled();
  function url(c=colour, s=sort, page=1) {
    const q = new URLSearchParams();
    if(c) q.set('colour',c);
    if(s!=='featured') q.set('sort',s);
    if(page>1) q.set('page',String(page));
    return '/edits/'+params.slug+(q.size?'?'+q:'');
  }
  return <><Header shop/><main className="nj-market">
    <ShopSign department={edit.slug}/><StoreAisles active={edit.slug}/>
    {data && data.total > 0 ? <section className="nj-shelf" aria-label="Shop available pieces">
      <div className="nj-shelf-head"><div><h2>On the counter</h2><p>{data.matches} {data.matches===1?'piece':'pieces'}</p></div></div>
      <div className="nj-tools"><div className="nj-filters" aria-label="Filter by colour"><Link href={url('')} aria-current={!colour}>All</Link>
        {data.colours.map(c=><Link key={c} href={url(c)} aria-current={colour===c}>{c}</Link>)}</div>
        <div className="nj-filters" aria-label="Sort collection">{[['featured','Featured'],['newest','Newest'],['name','A to Z']].map(([s,label])=><Link key={s} href={url(colour,s)} aria-current={sort===s}>{label}</Link>)}</div></div>
      <div className="nj-grid">{data.pieces.map(p=><ProductCard key={p.id} product={{...p,images:p.cover?[p.cover,...p.images.filter(i=>i!==p.cover)]:p.images}}/>)}</div>
      {!data.matches && <p className="nj-no-results">No pieces in this colour. <Link className="nj-text-link" href={url('')}>See all colours</Link></p>}
      {data.pages>1 && <nav className="nj-aisles" aria-label="Collection pages">{data.page>1&&<Link href={url(colour,sort,data.page-1)}>Previous</Link>}<span>Page {data.page} of {data.pages}</span>{data.page<data.pages&&<Link href={url(colour,sort,data.page+1)}>Next</Link>}</nav>}
    </section> : ids.length>0 ? <StudyShelf key={edit.slug} ids={ids} preview={preview} email={email}/> :
      <section className="nj-empty"><h2>{data?'Enquire about a piece':'The catalogue is temporarily unavailable'}</h2><p>{data?'Tell us what you have in mind for your home.':'Please try again or get in touch with the shop.'}</p><a href={'mailto:'+email+'?subject='+encodeURIComponent(edit.name+' enquiry')} className="nj-text-link mt-3">Ask the shop ↗</a> · <Link className="nj-text-link" href="/products">Browse all pieces</Link></section>}
    <nav className="nj-aisles mt-7" aria-label="Help choosing">{ids.length ? <><Link href="/looks">Juttis & jewellery ↗</Link><Link href="/ai/mirror">Aaina ↗</Link><Link href="/counter">Compare sarees ↗</Link></> : <Link href="/ai/imagine">See it in my room ↗</Link>}</nav>
  </main><Footer/></>;
}
