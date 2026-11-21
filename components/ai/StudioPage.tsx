import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { storageConfigured } from '@/lib/storage';
import { getSession } from '@/lib/auth';
import { aiMirrorConfigured } from '@/lib/ai';
import { findStudioPiece, studioShelf } from '@/lib/studio-catalog';
import { studioHref,type StudioMode } from '@/lib/studio';
import { StudioSession } from './StudioSession';
import { formatINR } from '@/lib/money';
import styles from './Studio.module.css';

export type StudioQuery = {product?:string;variant?:string;page?:string};
export async function StudioPage({mode,query}:{mode:StudioMode;query:StudioQuery}) {
  const mirror=mode==='mirror';
  const name=mirror?'AI Mirror':'AI Imagine';
  const page=Number.parseInt(query.page||'1',10);
  const shelf=await studioShelf(mode,Number.isFinite(page)?page:1);
  const selectedKey=typeof query.product==='string'?query.product.slice(0,200):'';
  const selected=selectedKey ? shelf.pieces.find(p=>p.id===selectedKey||p.slug===selectedKey) || await findStudioPiece(mode,selectedKey) : null;
  const session=selected ? await getSession() : null;
  const variant=selected?.variants.find(v=>v.id===query.variant) || null;
  return <><Header/><main className={styles.page}>
    <nav className={styles.nav} aria-label="Photo studios"><Link href="/">Neejee</Link><span>/</span>
      <Link href="/ai/mirror" aria-current={mirror?'page':undefined}>AI Mirror</Link>
      <Link href="/ai/imagine" aria-current={mirror?undefined:'page'}>AI Imagine</Link></nav>
    <div className={styles.heading}><div><p className={styles.eyebrow}>{mirror?'The fitting room':'Your room'}</p><h1>{name}</h1></div>
      <p>{mirror?'Choose something you’d like to wear. Use a photo of yourself to see the look.':'Start with a piece you like. See how it sits beside your bed, on your shelf, or in that corner by the window.'}</p></div>
    {selected ? <StudioSession key={selected.id+':'+(variant?.id||'')} mode={mode} piece={selected} initialVariant={variant?.id||''} signedIn={!!session} configured={aiMirrorConfigured() && storageConfigured()}/> :
      <section aria-label="Choose a piece" className={styles.shelf}>
        {selectedKey && <p role="status">That piece is currently unavailable for this preview.</p>}
        {shelf.pieces.length ? <><h2>Choose your piece</h2><div className={styles.grid}>{shelf.pieces.map(p=>
          <Link key={p.id} href={studioHref(mode,p.slug)}><img src={p.image} alt={p.name} loading="lazy"/><strong>{p.name}</strong><span>{formatINR(p.sellingPrice)}</span></Link>)}</div>
          {shelf.pages>1 && <nav aria-label="Collection pages">{shelf.current>1&&<Link href={studioHref(mode,undefined,null,shelf.current-1)}>Previous</Link>} Page {shelf.current} of {shelf.pages} {shelf.current<shelf.pages&&<Link href={studioHref(mode,undefined,null,shelf.current+1)}>Next</Link>}</nav>}</> :
          <div className={styles.empty}><h2>{mirror?'The first fitting edit is being prepared.':'The room edit is being refreshed.'}</h2>
            <p>{mirror?'Sarees and suits will appear here when an approved piece is ready to try. Visit the saree or suit edit for collection announcements.':'There are no home pieces available for a room preview today.'}</p>
            {mirror?<p><Link href="/edits/sarees">Explore sarees</Link> · <Link href="/edits/suits">Explore suits</Link></p>:<Link href="/edits/home">Explore objects for home</Link>}</div>}
      </section>}
  </main><Footer/></>;
}
