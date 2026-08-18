import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';
import {
  fetchPrivateSellerDocument,
  privateSellerDocumentPathFromUrl,
} from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const STORAGE_PREFIX = 'seller-applications/intake/';

function safeDownloadName(value: string): string {
  const cleaned = String(value || 'seller-document')
    .replace(/[\r\n"\\/]/g, '_')
    .replace(/[\x00-\x1F\x7F]/g, '_')
    .trim();
  return cleaned || 'seller-document';
}

export async function GET(
  _request: Request,
  { params }: { params: { token: string } },
) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = String(params?.token || '').trim();
  if (!token || !/^[A-Za-z0-9_-]+$/.test(token)) {
    return NextResponse.json({ error: 'Invalid document reference' }, { status: 400 });
  }

  const fileUrl = `/api/admin/seller-documents/${token}`;
  const document = await prisma.sellerDocument.findFirst({
    where: { fileUrl },
    select: {
      fileName: true,
      fileUrl: true,
      mimeType: true,
    },
  });

  if (!document) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  const objectPath = privateSellerDocumentPathFromUrl(document.fileUrl);
  if (!objectPath || !objectPath.startsWith(STORAGE_PREFIX)) {
    return NextResponse.json({ error: 'Invalid document reference' }, { status: 400 });
  }

  try {
    const stored = await fetchPrivateSellerDocument(objectPath);
    if (!stored.ok) {
      if (stored.status === 404) {
        return NextResponse.json({ error: 'Document not found' }, { status: 404 });
      }
      console.error('[seller-document-download] storage response', stored.status);
      return NextResponse.json({ error: 'Unable to retrieve document' }, { status: 502 });
    }

    const body = await stored.arrayBuffer();
    const fileName = safeDownloadName(document.fileName);
    const contentType =
      document.mimeType || stored.headers.get('content-type') || 'application/octet-stream';

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
      },
    });
  } catch (error) {
    console.error('[seller-document-download]', error);
    return NextResponse.json({ error: 'Unable to retrieve document' }, { status: 500 });
  }
}
