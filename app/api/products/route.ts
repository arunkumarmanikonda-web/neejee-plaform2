import { NextResponse } from 'next/server';
import { products } from '@/lib/data';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const category = url.searchParams.get('category');
  const search = url.searchParams.get('q');

  let filtered = products;
  if (category) filtered = filtered.filter(p => p.categorySlug === category);
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.craft.toLowerCase().includes(q) ||
      p.region.toLowerCase().includes(q)
    );
  }
  return NextResponse.json({ products: filtered, count: filtered.length });
}
