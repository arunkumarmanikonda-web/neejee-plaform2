import { NextResponse } from 'next/server';
import { getSession, requireRole } from '@/lib/auth';
import { products } from '@/lib/data';

export async function GET() {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ products });
}

export async function POST(request: Request) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await request.json();
  // PRODUCTION: validate with Zod + prisma.product.create
  const newProduct = { ...body, id: 'p_' + Math.random().toString(36).slice(2, 8) };
  products.push(newProduct);
  return NextResponse.json({ success: true, product: newProduct });
}
