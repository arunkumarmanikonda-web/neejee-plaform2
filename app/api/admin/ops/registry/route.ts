import { NextRequest, NextResponse } from 'next/server';
import { CRUD_ENTITIES, searchCrudEntities } from '../../../../admin/ops/_lib/entities';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
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
