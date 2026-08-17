import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fetchPrivateSellerObject } from '@/lib/storage';
import { sellerDocumentAdminUrl } from '@/lib/seller-onboarding/document-storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function safeStoragePath(value: string) {
  const path = String(value || '').trim().replace(/^\/+/, '');
  if (!path || path.includes('..') || path.includes('\\') || path.includes('\0')) return null;
  return path;
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || !['ADMIN', 'SUPER_ADMIN'].includes(session.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const storageKey = safeStoragePath(request.nextUrl.searchParams.get('path') || '');
  const fileName = String(request.nextUrl.searchParams.get('name') || 'document').trim().slice(0, 255) || 'document';
  if (!storageKey) {
    return NextResponse.json({ error: 'Invalid document reference' }, { status: 400 });
  }

  const canonicalUrl = sellerDocumentAdminUrl(storageKey, fileName);
  const document = await prisma.sellerDocument.findFirst({
    where: { fileUrl: canonicalUrl },
    select: { id: true, fileName: true, mimeType: true },
  });
  if (!document) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  try {
    const upstream = await fetchPrivateSellerObject(storageKey);
    if (!upstream.ok) {
      console.error('[admin.seller-documents.file] storage fetch failed', {
        documentId: document.id,
        status: upstream.status,
      });
      return NextResponse.json({ error: 'Document is unavailable' }, { status: upstream.status === 404 ? 404 : 502 });
    }

    const body = await upstream.arrayBuffer();
    const safeName = document.fileName.replace(/[\r\n"\\]/g, '_');
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': document.mimeType || upstream.headers.get('content-type') || 'application/octet-stream',
        'Content-Disposition': `inline; filename="${safeName}"`,
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('[admin.seller-documents.file] failed', {
      documentId: document.id,
      message: error instanceof Error ? error.message : 'unknown_error',
    });
    return NextResponse.json({ error: 'Document is unavailable' }, { status: 500 });
  }
}
