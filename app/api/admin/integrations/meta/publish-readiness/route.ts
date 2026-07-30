import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED = ['ADMIN', 'SUPER_ADMIN', 'MARKETING_MANAGER', 'MARKETING_OPERATOR'];

function emptySummary() {
  return {
    facebookConnected: false,
    instagramConnected: false,
    pagesTotal: 0,
    instagramTotal: 0,
    facebookPostReady: false,
    instagramPublishReady: false,
    instagramCommentReady: false,
    warnings: ['Meta social connection tables are not available in this deployment yet.'],
  };
}

export async function GET() {
  const session = await getSession();
  if (!session || !ALLOWED.includes(session.role as any)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = prisma as any;
  if (typeof db?.socialConnection?.findMany !== 'function') {
    return NextResponse.json({ summary: emptySummary(), degraded: true });
  }

  const connections = await db.socialConnection.findMany({
    where: { status: 'ACTIVE' },
    include: {
      pages: true,
      instagramAccounts: true,
    },
  });

  const pages = connections.flatMap((item: any) => item.pages);
  const instagramAccounts = connections.flatMap((item: any) => item.instagramAccounts);

  const summary = {
    facebookConnected: connections.some((item: any) => item.provider === 'FACEBOOK'),
    instagramConnected: instagramAccounts.length > 0 || connections.some((item: any) => item.provider === 'INSTAGRAM'),
    pagesTotal: pages.length,
    instagramTotal: instagramAccounts.length,
    facebookPostReady: pages.some((page: any) => page.canPost),
    instagramPublishReady: instagramAccounts.some((account: any) => account.canPublish),
    instagramCommentReady: instagramAccounts.some((account: any) => account.canCommentModerate),
    warnings: [] as string[],
  };

  if (!summary.facebookConnected) summary.warnings.push('No active Facebook business connection');
  if (!summary.pagesTotal) summary.warnings.push('No Facebook Pages discovered yet');
  if (!summary.instagramTotal) summary.warnings.push('No Instagram professional accounts discovered yet');
  if (!summary.facebookPostReady) summary.warnings.push('Facebook Page posting scopes are not yet publish-ready');
  if (!summary.instagramPublishReady) summary.warnings.push('Instagram publish scopes are not yet publish-ready');
  if (!summary.instagramCommentReady) summary.warnings.push('Instagram comment-management scopes are not yet ready');

  return NextResponse.json({ summary, degraded: false });
}
