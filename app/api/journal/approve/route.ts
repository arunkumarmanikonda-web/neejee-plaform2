// Magic-link approve endpoint — clicked from the review email.
// GET /api/journal/approve?token=<64-hex-token>
// Anyone with the token can approve (intentional: easy for Nidhi on phone).
// Renders a small HTML confirmation page so the user gets a visible result.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { publishDraftToJournal } from '@/lib/journal/auto-curate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function htmlPage(title: string, message: string, ctaHref?: string, ctaLabel?: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:Georgia,serif;background:#F4EFE6;color:#1a1714;margin:0;padding:48px 16px;text-align:center;}
.card{max-width:520px;margin:0 auto;background:#fff;border:1px solid #d9cfc1;padding:36px;}
h1{font-size:22px;margin:0 0 12px 0;}p{line-height:1.6;font-size:15px;}
a.btn{display:inline-block;margin-top:20px;background:#8B2E2A;color:#fff;padding:12px 24px;font-family:Helvetica,sans-serif;font-size:12px;letter-spacing:2px;text-decoration:none;text-transform:uppercase;}
.label{font-family:Helvetica,sans-serif;font-size:10px;letter-spacing:3px;color:#8B2E2A;text-transform:uppercase;margin-bottom:8px;}</style>
</head><body><div class="card"><div class="label">NEEJEE · Journal</div><h1>${title}</h1><p>${message}</p>${ctaHref ? `<a class="btn" href="${ctaHref}">${ctaLabel || 'Continue'}</a>` : ''}</div></body></html>`;
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') || '';
  if (!token || token.length < 16) {
    return new NextResponse(htmlPage('Invalid link', 'This approval link is missing or malformed.'), {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
  const draft = await prisma.journalDraft.findUnique({ where: { approvalToken: token } });
  if (!draft) {
    return new NextResponse(htmlPage('Link expired', 'This approval link is no longer valid.'), {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
  if (draft.status === 'PUBLISHED' && draft.publishedPageId) {
    const page = await prisma.cmsPage.findUnique({ where: { id: draft.publishedPageId } });
    const url = page ? `/journal/${page.slug}` : '/journal';
    return new NextResponse(htmlPage('Already published', `"${escapeHtml(draft.title)}" was already published.`, url, 'Open journal'), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
  if (draft.status === 'REJECTED') {
    return new NextResponse(htmlPage('Already rejected', `"${escapeHtml(draft.title)}" was previously rejected. To revisit, open the admin draft list.`, '/admin/journal', 'Open admin'), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
  try {
    const { slug } = await publishDraftToJournal(draft.id, null);
    return new NextResponse(
      htmlPage('Published', `"${escapeHtml(draft.title)}" is now live in The Journal.`, `/journal/${slug}`, 'Read it'),
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  } catch (e: any) {
    return new NextResponse(htmlPage('Something went wrong', escapeHtml(e?.message || 'Publish failed.')), {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
