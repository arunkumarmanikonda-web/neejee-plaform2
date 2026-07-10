import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
  request: Request,
  context: { params: { id: string } }
) {
  const user = await getSession();

  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let resolutionNote: string | null = null;

  try {
    const body = await request.json().catch(() => null);
    if (typeof body?.resolutionNote === 'string') {
      resolutionNote = body.resolutionNote.trim() || null;
    }

    const deadLetter = await prisma.erpDeadLetter.update({
      where: { id: context.params.id },
      data: {
        status: 'RESOLVED',
        resolutionNote,
        resolvedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      deadLetterId: deadLetter.id,
      status: deadLetter.status,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error?.message || 'Failed to resolve ERP dead-letter item',
      },
      { status: 500 }
    );
  }
}
