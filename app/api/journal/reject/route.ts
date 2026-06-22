// Magic-link reject endpoint — clicked from the review email.
// GET /api/journal/reject?token=<token>[&note=...]

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { rejectDraft } from '@/lib/journal/auto-curate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function htmlPage(title: string, message: string, ctaHref?: string, ctaLabel?: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:Georgia,serif;background:#F4EFE6;color:#1a1714;margin:0;padding:48px 16px;text-align:center;}
.card{max-width:520px;margin:0 auto;background:#fff;border:1px solid #d9cfc1;padding:36px;}
h1{font-size:22px;margin:0 0 12px 0;}p{line-height:1.6;font-size:15px;}
a.btn{display:inline-block;margin-top:20px;background:#1a1714;color:#fff;padding:12px 24px;font-family:Helvetica,sans-serif;font-size:12px;letter-spacing:2px;text-decoration:none;text-transform:uppercase;}
.label{font-family:Helvetica,sans-serif;font-size:10px;letter-spacing:3px;color:#8B2E2A;text-transform:uppercase;margin-bottom:8px;}</style>
</head><body><div class="card"><div class="label">NEEJEE · Journal</div><h1>${title}</h1><p>${message}</p>${ctaHref ? `<a class="btn" href="${ctaHref}">${ctaLabel || 'Continue'}</a>` : ''}</div></body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') || '';
  const note = req.nextUrl.searchParams.get('note') || 'Rejected via email link';
  if (!token || token.length < 16) {
    return new NextResponse(htmlPage('Invalid link', 'This rejection link is missing or malformed.'), {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
  const draft = await prisma.journalDraft.findUnique({ where: { approvalToken: token } });
  if (!draft) {
    return new NextResponse(htmlPage('Link expired', 'This rejection link is no longer valid.'), {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
  if (draft.status === 'PUBLISHED') {
    return new NextResponse(htmlPage('Cannot reject', `"${escapeHtml(draft.title)}" has already been published.`, '/admin/journal', 'Open admin'), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
  if (draft.status === 'REJECTED') {
    return new NextResponse(htmlPage('Already rejected', `"${escapeHtml(draft.title)}" was already rejected.`, '/admin/journal', 'Open admin'), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
  try {
    await rejectDraft(draft.id, null, note);
    return new NextResponse(
      htmlPage('Rejected', `"${escapeHtml(draft.title)}" has been rejected. A fresh draft will be generated next Monday.`, '/admin/journal', 'Open admin'),
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  } catch (e: any) {
    return new NextResponse(htmlPage('Something went wrong', escapeHtml(e?.message || 'Reject failed.')), {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}
