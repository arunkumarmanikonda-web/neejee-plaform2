// Server-side cart persistence. Client-side cart (Zustand) syncs with this for logged-in users.
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { products } from '@/lib/data';

// In-memory dev store. Production: Prisma `Cart` + `CartItem` models.
const carts: Record<string, any[]> = {};

export async function GET() {
  const user = await getSession();
  const key = user?.id || 'guest';
  return NextResponse.json({ items: carts[key] || [] });
}

export async function POST(request: Request) {
  const user = await getSession();
  const key = user?.id || 'guest';
  const { productId, quantity } = await request.json();
  const product = products.find(p => p.id === productId);
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  if (product.inventory < quantity) return NextResponse.json({ error: 'Insufficient stock' }, { status: 400 });

  carts[key] = carts[key] || [];
  const existing = carts[key].find((i: any) => i.productId === productId);
  if (existing) existing.quantity += quantity;
  else carts[key].push({ productId, quantity, price: product.sellingPrice });

  return NextResponse.json({ success: true, items: carts[key] });
}

export async function DELETE(request: Request) {
  const user = await getSession();
  const key = user?.id || 'guest';
  const { productId } = await request.json();
  carts[key] = (carts[key] || []).filter((i: any) => i.productId !== productId);
  return NextResponse.json({ success: true });
}
