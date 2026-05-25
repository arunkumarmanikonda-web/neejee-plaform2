import { NextResponse } from 'next/server';
import { searchProducts, products } from '@/lib/data';

// PRODUCTION: replace with Algolia / Typesense
//   const index = algolia.initIndex('products');
//   const { hits } = await index.search(query, { hitsPerPage: 12 });
export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get('q') || '';
  if (!q || q.length < 2) {
    return NextResponse.json({
      results: [],
      suggestions: ['Banarasi', 'Phulkari', 'Kanjeevaram', 'Attar', 'Jhumkas', 'Pashmina'],
    });
  }
  const results = searchProducts(q).slice(0, 12);
  return NextResponse.json({ results, count: results.length, query: q });
}
