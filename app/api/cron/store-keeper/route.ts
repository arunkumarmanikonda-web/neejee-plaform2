import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { runKeeper } from '@/lib/keeper';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function GET(req:Request) {
  if (!process.env.CRON_SECRET || req.headers.get('authorization') !== 'Bearer '+process.env.CRON_SECRET)
    return NextResponse.json({error:'Unauthorized'},{status:401});
  const result = await runKeeper();
  if (result.repairs) for (const path of ['/','/journal','/sitemap.xml']) revalidatePath(path);
  return NextResponse.json(result);
}
