import { renderHtmlToPdfBuffer } from '@/lib/catalogue-builder/pdf';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;

export async function GET() {
  if (process.env.VERCEL_ENV !== 'preview') return new Response(null, { status: 404 });
  const html = '<!doctype html><html><head><style>@page{size:A4;margin:1cm}section{break-after:page}</style></head><body><section><h1>NEEJEE renderer check</h1></section><h2>Second page</h2></body></html>';
  const pdf = await renderHtmlToPdfBuffer(html);
  const source = pdf.toString('latin1');
  const pages = (source.match(/\/Type\s*\/Page\b/g) || []).length;
  const ok = source.startsWith('%PDF-') && source.trimEnd().endsWith('%%EOF') && pages === 2;
  return Response.json({ ok, bytes: pdf.length, pages }, { status: ok ? 200 : 502, headers: { 'Cache-Control': 'no-store' } });
}
