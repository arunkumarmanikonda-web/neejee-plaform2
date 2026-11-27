import { getSession } from '@/lib/auth';
import { canOpenAdminPage } from '@/lib/admin/shop-access';
import { NextRequest, NextResponse } from 'next/server';
import { CRUD_ENTITIES, searchCrudEntities } from '../../../../admin/ops/_lib/entities';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user || !canOpenAdminPage(user.role, '/admin/ops')) {
    return NextResponse.json({error: 'Staff access required'}, {status: user ? 403 : 401});
  }
  const query = request.nextUrl.searchParams.get('q') ?? '';
  const entities = searchCrudEntities(query);

  return NextResponse.json({
    ok: true,
    query,
    total: entities.length,
    entities,
    allEntitiesTotal: CRUD_ENTITIES.length,
  });
}
