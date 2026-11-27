import { NextResponse } from 'next/server';
import { getSession, requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { intakeJobId } from '@/lib/catalog/creation-intake';
import { runAiPhotoJob } from '@/lib/ai-photo-studio/generate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;
type Context = {params: Promise<{id: string}>};

async function requestJob(productId: string) {
  const user = await getSession();
  if (!user || !requireRole(user, ['SUPER_ADMIN', 'ADMIN', 'CONTENT_EDITOR', 'MARKETING_MANAGER', 'MARKETING_OPERATOR'])) {
    return {error: NextResponse.json({error:'Staff access required.'},{status:user ? 403 : 401})};
  }
  const job = await prisma.aiPhotoJob.findUnique({
    where:{id:intakeJobId(productId)},
    select:{id:true, productId:true, status:true, updatedAt:true, variants:{select:{url:true,sceneNote:true},orderBy:{createdAt:'asc'}}},
  });
  return {job:job?.productId === productId ? job : null,canReview:['SUPER_ADMIN','ADMIN'].includes(user.role)};
}
export async function GET(_request: Request, props: Context) {
  const params = await props.params;
  const result = await requestJob(params.id);
  if (result.error) return result.error;
  return NextResponse.json({job:result.job,canReview:result.canReview});
}
export async function POST(request: Request, props: Context) {
  const params = await props.params;
  const result = await requestJob(params.id);
  if (result.error) return result.error;
  const job = result.job;
  if (!job) return NextResponse.json({error:'No intake job for this product.'},{status:404});
  const retry = (await request.json().catch(() => null))?.retry === true;
  if (retry && job.status === 'FAILED' && !job.variants.length) {
    await prisma.aiPhotoJob.updateMany({where:{id:job.id,status:'FAILED',updatedAt:job.updatedAt},
      data:{status:'QUEUED',startedAt:null,completedAt:null,errorMessage:null}});
  }
  await runAiPhotoJob(job.id);
  return GET(request,props);
}
