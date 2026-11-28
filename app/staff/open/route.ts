import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { canOpenAdminPage } from '@/lib/admin/shop-access';

export const dynamic = 'force-dynamic';
const destinations = new Map([
  ['dashboard','/admin'],['new','/admin/products/new'],['products','/admin/products'],
  ['inventory','/admin/inventory'],['orders','/admin/orders'],['settings','/admin/settings'],
]);
export async function GET(request: Request) {
  const url = new URL(request.url);
  const target = destinations.get(url.searchParams.get('screen') || 'dashboard') || '/admin';
  const user = await getSession();
  const destination = !user || !canOpenAdminPage(user.role,'/admin')
    ? '/login?next='+encodeURIComponent(target)
    : canOpenAdminPage(user.role,target) ? target : '/admin';
  const response = NextResponse.redirect(new URL(destination,url.origin));
  response.headers.set('Cache-Control','private, no-store');
  return response;
}
