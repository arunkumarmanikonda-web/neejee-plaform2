import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      disabled: true,
      phase: 'phase0',
      message: 'Admin SMS test route is disabled in Phase 0.'
    },
    { status: 403 }
  );
}

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      disabled: true,
      phase: 'phase0',
      message: 'Admin SMS test route is disabled in Phase 0.'
    },
    { status: 403 }
  );
}
