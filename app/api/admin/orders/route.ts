import { NextResponse } from 'next/server';
import { getSession, requireRole } from '@/lib/auth';

const MOCK_ORDERS = [
  { id: 'NEE-AB4521', customer: 'Priya R.', email: 'priya@example.com', date: '2026-05-20T08:14:00Z', total: 2450000, items: 1, status: 'PACKED', payment: 'PAID', pincode: '400018' },
  { id: 'NEE-AB4520', customer: 'Aanya M.', email: 'aanya@example.com', date: '2026-05-20T07:42:00Z', total: 320000, items: 1, status: 'SHIPPED', payment: 'PAID', pincode: '110001' },
  { id: 'NEE-AB4519', customer: 'Mira S.', email: 'mira@example.com', date: '2026-05-19T18:30:00Z', total: 1875000, items: 2, status: 'DELIVERED', payment: 'PAID', pincode: '560034' },
  { id: 'NEE-AB4518', customer: 'Tara K.', email: 'tara@example.com', date: '2026-05-19T14:15:00Z', total: 720000, items: 1, status: 'PACKED', payment: 'PAID', pincode: '600028' },
  { id: 'NEE-AB4517', customer: 'Riya P.', email: 'riya@example.com', date: '2026-05-19T11:00:00Z', total: 180000, items: 1, status: 'CONFIRMED', payment: 'PAID', pincode: '500032' },
  { id: 'NEE-AB4516', customer: 'Neha G.', email: 'neha@example.com', date: '2026-05-18T22:45:00Z', total: 16800000, items: 1, status: 'PROCESSING_HIGH_VALUE', payment: 'PAID', pincode: '400050' },
];

export async function GET(request: Request) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  let orders = MOCK_ORDERS;
  if (status) orders = orders.filter(o => o.status === status);
  return NextResponse.json({ orders, count: orders.length });
}
