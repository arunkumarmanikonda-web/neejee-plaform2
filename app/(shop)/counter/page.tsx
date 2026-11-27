import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { CounterStudio } from '@/components/counter/CounterStudio';
import { readCounter,type CounterCloth } from '@/lib/counter';
import { archiveCloths } from '@/lib/counter-archive';
import { getPublicContact } from '@/lib/public-contact';
import { getCounterStock } from '@/lib/counter-shop';

export const dynamic='force-dynamic';
export const metadata={title:'The saree counter | Neejee',description:'Bring a blouse colour, unfold two pieces and ask someone whose eye you trust.',alternates:{canonical:'/counter'}};
export default async function Page({searchParams}:{searchParams:Record<string,string|string[]|undefined>}) {
  const q=new URLSearchParams();
  for(const key of ['c','one','two','mode','pick','start']){const v=searchParams[key];if(typeof v==='string')q.set(key,v);}
  const link=readCounter(q);
  const contact = await getPublicContact();
  let stock:CounterCloth[]=[],stockError=false;
  try {stock=await getCounterStock([link.one,link.two]);} catch {stockError=true;}
  return <><Header/><CounterStudio contactEmail={contact.email} key={q.toString()} link={link} items={[...stock,...archiveCloths]} photoStart={q.get('start')==='photo'} stockError={stockError}/><Footer/></>;
}
