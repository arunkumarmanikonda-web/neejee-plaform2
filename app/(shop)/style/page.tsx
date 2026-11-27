import Link from 'next/link';
import {Header} from '@/components/layout/Header';
import {Footer} from '@/components/layout/Footer';
import {PairingRoom} from '@/components/styling/PairingRoom';
import {getPairBoard} from '@/lib/pairing-catalog';
export const dynamic='force-dynamic';
export const metadata={title:'Style your piece in Aaina | Neejee',robots:{index:false,follow:false}};
export default async function StylePage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const raw=await searchParams;
  const read=(key:string)=>typeof raw[key]==='string'?raw[key].slice(0,180):undefined;
  const board=await getPairBoard({product:read('product'),variant:read('variant'),study:read('study')}).catch(()=>null);
  return <><Header shop/><main>{board?<PairingRoom key={board.anchor.id+'~'+board.anchor.variant} board={board} initialOptions={Object.fromEntries(board.slots.map(slot=>[slot,read(slot)]))}/>:
    <section className="max-w-3xl mx-auto px-6 py-16"><h1 className="font-display text-4xl">This piece is unavailable for styling</h1>
      <p className="my-4">Your cart is still here.</p><div className="flex gap-3"><Link className="btn-primary" href="/cart">View cart</Link><Link className="btn-outline" href="/checkout">Continue to checkout</Link></div></section>}</main><Footer/></>;
}
