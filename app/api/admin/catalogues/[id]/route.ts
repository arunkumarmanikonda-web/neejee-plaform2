import { NextResponse } from 'next/server';
import { getSession, requireRole, type SessionRole } from '@/lib/auth';
import { deleteCatalogueProject, getCatalogueProject, updateCatalogueProject } from '@/lib/catalogue-builder/storage';
import { z } from 'zod';

type Context = { params: Promise<{ id: string }> };
const editors: SessionRole[] = ['SUPER_ADMIN','ADMIN','CONTENT_EDITOR'];
const missing = () => NextResponse.json({error:'Catalogue project not found'}, {status:404});
const denied = () => NextResponse.json({error:'Access denied'}, {status:403});
const shortText = z.string().max(8000);
const copyFields = z.object({
  title: shortText, slug: shortText, founderName: shortText, preNote: shortText, endingNote: shortText,
  heroHeading: shortText, heroSubheading: shortText, sectionIntro: shortText, seoTitle: shortText.nullable(),
  seoDesc: shortText.nullable(), productNarratives: z.record(z.string(),shortText), productPullQuotes: z.record(z.string(),shortText),
}).partial();
const edit = z.object({
  title: z.string().trim().min(1).max(240), slug: z.string().trim().min(1).max(240),
  status: z.enum(['DRAFT','PREVIEW','PUBLISHED','ARCHIVED']),
  config: z.object({brandName:shortText, includeFounderNotes:z.boolean(), includeClosingPage:z.boolean(),coverImage:shortText.nullable()}).partial(),
  selection: z.object({productIds:z.array(z.string().max(240)).max(500), categorySlug:shortText.nullable(),categoryPath:shortText.nullable(),limit:z.number().int().positive().nullable()}).partial(),
  copy:copyFields,
}).partial();

export async function GET(_req: Request, ctx: Context) {
  if (!requireRole(await getSession(),editors)) return denied();
  const project = await getCatalogueProject((await ctx.params).id);
  return project ? NextResponse.json({project}) : missing();
}
export async function PATCH(req: Request, ctx: Context) {
  if (!requireRole(await getSession(),editors)) return denied();
  const input = edit.safeParse(await req.json().catch(()=>null));
  if (!input.success) return NextResponse.json({error:'Check the catalogue fields and try again.'},{status:400});
  const {id} = await ctx.params;
  try {
    const saved = await updateCatalogueProject(id,input.data);
    return saved ? NextResponse.json({project:await getCatalogueProject(saved.id)}) : missing();
  } catch (error) {
    if ((error as {code?:string}).code === 'P2002') return NextResponse.json({error:'This catalogue address is already in use.'},{status:409});
    throw error;
  }
}
export async function DELETE(_req: Request, ctx: Context) {
  if (!requireRole(await getSession(),['SUPER_ADMIN','ADMIN'])) return denied();
  const removed = await deleteCatalogueProject((await ctx.params).id);
  return removed ? NextResponse.json({ok:true}) : missing();
}
