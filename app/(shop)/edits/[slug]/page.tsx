import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { NewsletterForm } from '@/components/ui/NewsletterForm';
import { EditorialCredit } from '@/components/home/EditorialCredit';
import { ProductCard } from '@/components/product/ProductCard';
import { editHref,getEdit,shopEdits } from '@/lib/shop-edits';
import { readEdit } from '@/lib/shop-edit-catalog';
import { studioHref } from '@/lib/studio';

export const dynamic='force-dynamic';
type Props={params:{slug:string};searchParams:{page?:string}};
export function generateMetadata({params}:Props) {
  const edit=getEdit(params.slug);
  if(!edit) return {};
  return {title:edit.title,description:edit.note,alternates:{canonical:editHref(edit.slug)}};
}
export default async function Page({params,searchParams}:Props) {
  const edit=getEdit(params.slug);
  if(!edit) notFound();
  const {pieces,page,pages,total}=await readEdit(edit,parseInt(searchParams.page||'1',10));
  const room=edit.slug==='home'||edit.slug==='furniture';
  const guide=edit.slug==='sarees'?[
    ['The drape','Look at the full length, the pallu and the border. A close-up tells you about the weave. A full drape tells you how the pattern reads when worn.'],
    ['The blouse','Check whether the saree comes with an unstitched blouse piece, a stitched blouse or the saree alone. Styling photographs can show a separate blouse.'],
    ['The fabric','Check the fibre, length and care instructions for the particular saree, especially if you plan to wear it often.']
  ]:edit.slug==='suits'?[
    ['The set','Check which pieces come together: kurta, trousers or salwar, and dupatta. Each set can be different.'],
    ['The fit','Compare the garment measurements with a kurta you already like. Check bust, hip, sleeve and finished length in the same units.'],
    ['The finish','Check whether the set arrives stitched, semi-stitched or as dress material, along with lining and care details.']
  ]:edit.slug==='clothing'?[['The cloth','Start with fibre, weave and how you would like to wear a piece. Open a saree or suit for more specific guidance.']]:[['The scale','Compare the dimensions with the shelf, table or corner where the piece will sit.'],['In your room','Pieces marked for AI Imagine can be previewed in a photograph of your own room.']];
  return <><Header/><main className="max-w-7xl mx-auto px-6 lg:px-12 pb-4">
    <nav aria-label="Shop edits" className="flex flex-wrap items-center gap-5 border-b border-mitti/25 py-5 font-ui text-sm">
      <Link href="/">Neejee</Link>{shopEdits.map(e=><Link key={e.slug} aria-current={edit.slug===e.slug?'page':undefined} className={edit.slug===e.slug?'underline underline-offset-4 text-madder':''} href={editHref(e.slug)}>{e.name}</Link>)}</nav>
    <header className="grid md:grid-cols-2 gap-6 lg:gap-14 items-center my-10 lg:my-16">
      <div><h1 className="font-display text-5xl lg:text-7xl text-kohl">{edit.title}</h1><p className="font-body text-xl leading-relaxed text-mitti mt-4 max-w-md">{edit.note}</p></div>
      <figure><img className={edit.slug==='suits'?'w-full h-72 object-contain bg-beige':'w-full h-52 md:h-64 object-cover'} src={edit.image} alt={edit.alt} width="960" height="600"/><EditorialCredit slug={edit.slug}/></figure></header>
    {edit.slug==='clothing'&&<nav aria-label="Sarees and suit sets" className="flex gap-3 mb-8"><Link className="btn-outline" href="/edits/sarees">Sarees</Link><Link className="btn-outline" href="/edits/suits">Suits</Link></nav>}
    {!room&&<Link className="inline-block text-madder underline mb-6" href="/looks">Style a look with juttis and jewellery</Link>}
    {total ? <section aria-label="Available pieces"><h2 className="font-display text-3xl mb-6">In the edit <span className="font-ui text-base text-mitti">({total})</span></h2>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-5 gap-y-9">{pieces.map(piece=><div key={piece.id}><ProductCard product={{...piece,images:piece.cover?[piece.cover,...piece.images.filter(i=>i!==piece.cover)]:piece.images}}/>
        {piece.aiTryOnEligible&&<Link className="inline-block mt-2 font-ui text-sm text-madder underline underline-offset-4" href={studioHref('mirror',piece.slug)}>Try this in AI Mirror</Link>}</div>)}</div>
      {pages>1&&<nav aria-label="Edit pages" className="flex gap-4 mt-8">{page>1&&<Link href={editHref(edit.slug)+'?page='+(page-1)}>Previous</Link>} Page {page} of {pages} {page<pages&&<Link href={editHref(edit.slug)+'?page='+(page+1)}>Next</Link>}</nav>}</section> :
      <section className="bg-beige p-6 md:p-9 max-w-2xl" aria-labelledby="first-look"><h2 id="first-look" className="font-display text-3xl">The {edit.slug==='home'?'home':edit.slug==='clothing'?'saree and suit':edit.slug==='furniture'?'furniture':edit.slug==='sarees'?'saree':'suit'} edit is being prepared.</h2>
        <p className="font-body my-3">Join Neejee’s email list for collection announcements and notes from the shop.</p>
        <NewsletterForm source={'edit-'+edit.slug}/><p className="font-ui text-xs text-mitti mt-2">Unsubscribe at any time.</p></section>}
    <section className="my-12 max-w-3xl"><h2 className="font-display text-3xl mb-4">{room?'Choosing a piece for home':edit.slug==='sarees'?'Choosing your saree':edit.slug==='clothing'?'Choosing a garment':'Choosing your suit'}</h2>
      {guide.map(([heading,body])=><details key={heading} className="border-y border-mitti/20 py-3 -mt-px"><summary className="cursor-pointer font-ui font-medium">{heading}</summary><p className="mt-2 font-body leading-relaxed">{body}</p></details>)}</section>
    <Link className="font-ui text-madder underline underline-offset-4" href={room?'/ai/imagine':'/ai/mirror'}>{room?'Explore AI Imagine':'Visit the AI Mirror fitting room'}</Link>

  </main><Footer/></>;
}
