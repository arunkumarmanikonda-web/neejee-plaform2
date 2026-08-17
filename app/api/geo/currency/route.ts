import { NextRequest, NextResponse } from 'next/server';
import { currencyForCountry } from '@/lib/currency';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const country = request.headers.get('x-vercel-ip-country');
  return NextResponse.json(
    { currency: currencyForCountry(country) },
    {
      headers: {
        'Cache-Control': 'private, no-store, max-age=0',
        Vary: 'x-vercel-ip-country',
      },
    }
  );
}
