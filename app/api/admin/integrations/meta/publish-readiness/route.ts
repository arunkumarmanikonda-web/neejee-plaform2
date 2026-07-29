import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED = ['ADMIN', 'SUPER_ADMIN', 'MARKETING_MANAGER', 'MARKETING_OPERATOR'];

export async function GET() {
  const session = await getSession();
  if (!session || !ALLOWED.includes(session.role as any)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const connections = await prisma.socialConnection.findMany({
    where: { status: 'ACTIVE' },
    include: {
      pages: true,
      instagramAccounts: true,
    },
  });

  const pages = connections.flatMap((item) => item.pages);
  const instagramAccounts = connections.flatMap((item) => item.instagramAccounts);

  const summary = {
    facebookConnected: connections.some((item) => item.provider === 'FACEBOOK'),
    instagramConnected: instagramAccounts.length > 0 || connections.some((item) => item.provider === 'INSTAGRAM'),
    pagesTotal: pages.length,
    instagramTotal: instagramAccounts.length,
    facebookPostReady: pages.some((page) => page.canPost),
    instagramPublishReady: instagramAccounts.some((account) => account.canPublish),
    instagramCommentReady: instagramAccounts.some((account) => account.canCommentModerate),
    warnings: [] as string[],
  };

  if (!summary.facebookConnected) summary.warnings.push('No active Facebook business connection');
  if (!summary.pagesTotal) summary.warnings.push('No Facebook Pages discovered yet');
  if (!summary.instagramTotal) summary.warnings.push('No Instagram professional accounts discovered yet');
  if (!summary.facebookPostReady) summary.warnings.push('Facebook Page posting scopes are not yet publish-ready');
  if (!summary.instagramPublishReady) summary.warnings.push('Instagram publish scopes are not yet publish-ready');
  if (!summary.instagramCommentReady) summary.warnings.push('Instagram comment-management scopes are not yet ready');

  return NextResponse.json({ summary });
}