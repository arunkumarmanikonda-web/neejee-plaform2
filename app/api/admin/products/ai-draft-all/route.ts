import { NextResponse } from 'next/server';
import { getSession, requireRole } from '@/lib/auth';
import { draftMerchandise, editorialExtras, savedProductFacts } from '@/lib/catalog/narrative-service';
import { narrativeTitleIsFinal } from '@/lib/catalog/narrative-fields';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request:Request) {
  const user=await getSession();
  if (!requireRole(user,['ADMIN','SUPER_ADMIN','CONTENT_EDITOR'])) return NextResponse.json({error:'Unauthorized'},{status:401});
  const body=await request.json().catch(()=>null);
  if (!body || typeof body!=='object' || Array.isArray(body)) return NextResponse.json({error:'A product brief is required.'},{status:400});
  if (![body.name,body.categoryName,body.craft,body.material].some(v=>typeof v==='string' && v.trim())) {
    return NextResponse.json({error:'Add a working name, category, material or craft first.'},{status:400});
  }
  const facts=await savedProductFacts(body.productId);
  const input={...body,pieceFacts:{...facts,...body.pieceFacts}};
  const {draft,source}=await draftMerchandise(input,{rewrite:body.overwrite===true,feedback:body.feedback});
  const fields={...draft,...editorialExtras(input,draft)};
  const filled: string[]=[];
  const skipped: string[]=[];
  const changes:Record<string,string>={};
  for(const [field,text] of Object.entries(fields)) {
    const hadValue = typeof body[field]==='string' && body[field].trim();
    const workingName=field==='name' && !input.keepTitle && !narrativeTitleIsFinal(body.name);
    if (!text || text===hadValue || hadValue && !body.overwrite && !workingName) {skipped.push(field);continue;}
    changes[field]=text;
    filled.push(field);
  }
  return NextResponse.json({ok:true,source,configured:source==='ai',draft:changes,filled,skipped});
}
