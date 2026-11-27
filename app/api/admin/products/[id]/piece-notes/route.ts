import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getSession, requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { notesPageType, notesSlug, notesTemplate, readPieceFacts } from '@/lib/catalog/piece-notes';

export const dynamic = 'force-dynamic';
type Context = {params: Promise<{id:string}>};
const conflict = () => NextResponse.json({error:'The notes changed. Reload them before saving.'},{status:409});
async function check(id:string) {
  const user = await getSession();
  if (!requireRole(user,['ADMIN','SUPER_ADMIN','CONTENT_EDITOR'])) return NextResponse.json({error:'Sign in as a catalogue editor.'},{status:403});
  if (!(await prisma.product.findUnique({where:{id},select:{id:true}}))) return NextResponse.json({error:'Piece not found.'},{status:404});
  return {user};
}
export async function GET(_req:Request, props:Context) {
  const params = await props.params;
  const denied = await check(params.id);
  if (denied instanceof NextResponse) return denied;
  const page = await prisma.cmsPage.findFirst({where:{slug:notesSlug(params.id),pageType:notesPageType,template:notesTemplate},select:{sections:true,updatedAt:true}});
  return NextResponse.json({facts:readPieceFacts(page?.sections),version:page?.updatedAt.toISOString()??null});
}
export async function PATCH(req:Request, props:Context) {
  const params = await props.params;
  const denied = await check(params.id);
  if (denied instanceof NextResponse) return denied;
  const body = await req.json().catch(()=>null);
  if (!body || !body.facts || typeof body.facts!=='object' || Array.isArray(body.facts) || !(body.version===null || (typeof body.version==='string' && Number.isFinite(Date.parse(body.version))))) return NextResponse.json({error:'Invalid piece notes.'},{status:400});
  const slug = notesSlug(params.id);
  const data = {sections:readPieceFacts(body.facts),status:'PUBLISHED' as const,publishedAt:new Date()};
  try {
    const page = await prisma.$transaction(async tx=>{
      const select = {updatedAt:true};
      let saved;
      if (body.version===null) {
        saved = await tx.cmsPage.create({data:{...data,slug,title:'Piece notes · '+params.id,pageType:notesPageType,template:notesTemplate},select});
      } else {
        const changed = await tx.cmsPage.updateMany({where:{slug,pageType:notesPageType,template:notesTemplate,updatedAt:new Date(body.version)},data});
        if (!changed.count) return null;
        saved = await tx.cmsPage.findUniqueOrThrow({where:{slug},select});
      }
      await tx.financeAuditLog.create({data:{entityType:'ProductPieceNotes',entityId:params.id,action:body.version===null?'CREATE':'UPDATE',userId:denied.user?.id,userRole:denied.user?.role,fullSnapshot:JSON.stringify(data.sections)}});
      return saved;
    });
    return page ? NextResponse.json({version:page.updatedAt.toISOString()}) : conflict();
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code==='P2002') return conflict();
    throw e;
  }
}
