import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { orderShippingAddress } from '@/lib/checkout/order-shipping-address';

export const dynamic = 'force-dynamic';
const select = { id:true, name:true, phone:true, line1:true, line2:true, city:true, state:true, pincode:true, country:true } as const;

export async function GET() {
  const session = await getSession();
  if (!session?.id) return NextResponse.json({error:'Sign in to see saved addresses.'},{status:401});
  const rows = await prisma.address.findMany({
    where:{userId:session.id}, select,
    orderBy:[{isDefault:'desc'},{id:'desc'}], take:100,
  });
  const seen = new Set<string>();
  const addresses = rows.filter(row => {
    const key = JSON.stringify([row.name,row.phone,row.line1,row.line2 || '',row.city,row.state,row.pincode,row.country]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return NextResponse.json({addresses},{headers:{'Cache-Control':'private, no-store'}});
}

export async function POST(request:Request) {
  const session = await getSession();
  if (!session?.id) return NextResponse.json({error:'Sign in to save an address.'},{status:401});
  const body = await request.json().catch(() => null);
  let data;
  try { data = orderShippingAddress(session.id,body,body?.phone); }
  catch { return NextResponse.json({error:'Check the recipient, mobile number and complete Indian delivery address.'},{status:400}); }
  const address = await prisma.address.create({data, select});
  return NextResponse.json({address},{status:201,headers:{'Cache-Control':'private, no-store'}});
}
