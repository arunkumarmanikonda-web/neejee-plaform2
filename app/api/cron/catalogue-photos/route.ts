import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { runAiPhotoJob } from '@/lib/ai-photo-studio/generate';
import { intakePrefix } from '@/lib/catalog/creation-intake';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== 'Bearer ' + process.env.CRON_SECRET) {
    return NextResponse.json({error:'Unauthorized'},{status:401});
  }
  // A killed worker may have submitted its provider request. A staff retry is explicit.
  const stale = { id:{startsWith:intakePrefix}, status:'RUNNING' as const, startedAt:{lt:new Date(Date.now()-12*60*1000)} };
  await prisma.aiPhotoJob.updateMany({where:{...stale,variants:{none:{}}},data:{status:'FAILED',completedAt:new Date(),errorMessage:'Worker interrupted. Retry from the saved product.'}});
  await prisma.aiPhotoJob.updateMany({where:{...stale,variants:{some:{}}},data:{status:'COMPLETED',completedAt:new Date(),errorMessage:'Some options are ready for review.'}});
  const next = await prisma.aiPhotoJob.findFirst({
    where:{id:{startsWith:intakePrefix},productId:{not:null},status:'QUEUED'},orderBy:{createdAt:'asc'},select:{id:true},
  });
  return NextResponse.json({processed:next ? await runAiPhotoJob(next.id) : null});
}
