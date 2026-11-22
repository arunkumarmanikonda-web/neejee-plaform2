import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { outfitFor, sareeWhere } from '@/lib/outfit-catalog';
import { getStyleAccessories } from '@/lib/style-accessories';
import { isAccessorySku } from '@/lib/stylebook';

export const dynamic='force-dynamic';
const valid=(v:string|null)=>v && /^[a-zA-Z0-9_-]{1,100}$/.test(v)?v:'';
export async function GET(request:Request) {
  const q=new URL(request.url).searchParams;
  try{
    if(q.has('lines')){
      const ids=[...new Set((q.get('lines')||'').split(',').map(valid).filter(Boolean))].slice(0,60);
      const rows=ids.length?await prisma.product.findMany({where:{AND:[sareeWhere,{id:{in:ids}}]},select:{id:true}}):[];
      return NextResponse.json({ids:rows.map(p=>p.id)});
    }
    if(q.has('accessory')){
      const id=q.get('accessory');
      if(!isAccessorySku(id))return NextResponse.json({error:'Choose an available piece.'},{status:400});
      const [option]=await getStyleAccessories([id],true);
      return option?NextResponse.json({option}):NextResponse.json({error:'This option has sold out.'},{status:409});
    }
    const key=valid(q.get('study')||q.get('product'));
    if(!key)return NextResponse.json({error:'Choose a saree first.'},{status:400});
    const data=await outfitFor(key,valid(q.get('variant')),q.has('study'));
    return data?NextResponse.json(data):NextResponse.json({error:'This saree or colour is no longer available for styling.'},{status:404});
  }catch {return NextResponse.json({error:'The styling counter is temporarily unavailable. You can continue to checkout.'},{status:503});}
}
