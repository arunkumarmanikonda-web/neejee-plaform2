import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Lookbook } from '@/components/looks/Lookbook';
import { defaultStyling, readStyling } from '@/lib/stylebook';
import { aiMirrorConfigured } from '@/lib/ai';
import { storageConfigured } from '@/lib/storage';
import { getStyleAccessories } from '@/lib/style-accessories';
import { getCounterStock } from '@/lib/counter-shop';

export const dynamic='force-dynamic';
export const metadata={title:'Saree styling ideas · Blouses, juttis & jewellery | Neejee',alternates:{canonical:'/looks'}};
export default async function Page({searchParams:q}:{searchParams:Record<string,string|undefined>}) {
  const selected=readStyling(q)||defaultStyling(q.look);
  const variant=typeof q.variant==='string'?q.variant.slice(0,100):'';
  const product=typeof q.product==='string'?q.product.slice(0,180):'';
  const items=await getCounterStock(variant?['v-'+variant]:[]).catch(()=>[]);
  const accessories=await getStyleAccessories([selected.shoe,selected.jewel,selected.blouse||'none']).catch(()=>[]);
  return <><Header/><main><Lookbook personalMirror={aiMirrorConfigured()&&storageConfigured()} accessories={accessories} key={JSON.stringify([selected,product,variant])} initial={selected} items={items} product={product} variant={variant} standalone/></main><Footer/></>;
}
