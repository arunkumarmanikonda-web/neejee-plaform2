import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { encryptToken } from '@/lib/social/token-crypto';
import {
  exchangeCodeForShortLivedUserToken,
  exchangeForLongLivedUserToken,
  getInstagramAccountsFromPages,
  getManagedPages,
  getMetaMe,
  getMetaPermissions,
  summarizeReadiness,
  type MetaConnectKind,
} from '@/lib/social/meta';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED = ['ADMIN', 'SUPER_ADMIN', 'MARKETING_MANAGER', 'MARKETING_OPERATOR'];

function redirectWithError(req: NextRequest, code: string) {
  return NextResponse.redirect(new URL(`/admin/integrations/meta?error=${encodeURIComponent(code)}`, req.url));
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !ALLOWED.includes(session.role as any)) {
    return redirectWithError(req, 'unauthorized');
  }

  const code = req.nextUrl.searchParams.get('code') || '';
  const state = req.nextUrl.searchParams.get('state') || '';
  const kind = ((req.nextUrl.searchParams.get('kind') || 'facebook').toLowerCase() === 'instagram'
    ? 'instagram'
    : 'facebook') as MetaConnectKind;

  if (!code || !state) {
    return redirectWithError(req, 'missing_code_or_state');
  }

  const cookie = req.cookies.get('neejee-meta-oauth')?.value || '';
  let parsed: any = null;
  try { parsed = cookie ? JSON.parse(cookie) : null; } catch {}

  if (!parsed || parsed.state !== state || parsed.userId !== session.id) {
    return redirectWithError(req, 'state_mismatch');
  }

  try {
    const shortLived = await exchangeCodeForShortLivedUserToken(code, kind);
    const longLived = await exchangeForLongLivedUserToken(shortLived.access_token);
    const accessToken = longLived.access_token || shortLived.access_token;

    const [me, grantedScopes, pages] = await Promise.all([
      getMetaMe(accessToken),
      getMetaPermissions(accessToken),
      getManagedPages(accessToken),
    ]);

    const instagramAccounts = getInstagramAccountsFromPages(pages);
    const readiness = summarizeReadiness(pages, instagramAccounts, grantedScopes);

    const provider = kind === 'instagram' ? 'INSTAGRAM' : 'FACEBOOK';
    const expiresAt = longLived.expires_in
      ? new Date(Date.now() + longLived.expires_in * 1000)
      : shortLived.expires_in
        ? new Date(Date.now() + shortLived.expires_in * 1000)
        : null;

    const connection = await prisma.socialConnection.upsert({
      where: {
        provider_providerUserId: {
          provider,
          providerUserId: String(me.id),
        },
      },
      update: {
        displayName: me.name || null,
        metaUserName: me.name || null,
        metaUserEmail: me.email || null,
        status: 'ACTIVE',
        accessTokenEnc: encryptToken(accessToken),
        tokenType: longLived.token_type || shortLived.token_type || null,
        scopes: grantedScopes,
        tokenExpiresAt: expiresAt,
        lastSyncedAt: new Date(),
        lastError: null,
      },
      create: {
        provider,
        providerUserId: String(me.id),
        displayName: me.name || null,
        metaUserName: me.name || null,
        metaUserEmail: me.email || null,
        status: 'ACTIVE',
        accessTokenEnc: encryptToken(accessToken),
        tokenType: longLived.token_type || shortLived.token_type || null,
        scopes: grantedScopes,
        tokenExpiresAt: expiresAt,
        lastSyncedAt: new Date(),
        createdByUserId: session.id,
      },
    });

    await prisma.socialPageConnection.deleteMany({
      where: { socialConnectionId: connection.id },
    });

    if (pages.length) {
      await prisma.socialPageConnection.createMany({
        data: pages.map((page: any, index: number) => ({
          socialConnectionId: connection.id,
          pageId: String(page.id),
          pageName: page.name || 'Untitled Page',
          pageAccessTokenEnc: page.access_token ? encryptToken(page.access_token) : null,
          category: page.category || null,
          pictureUrl: page.picture?.data?.url || null,
          tasks: Array.isArray(page.tasks) ? page.tasks : [],
          canPost: Array.isArray(page.tasks)
            ? (page.tasks.includes('CREATE_CONTENT') || page.tasks.includes('MODERATE') || page.tasks.includes('MANAGE'))
            : false,
          canRead: true,
          isPrimary: index === 0,
          linkedInstagramId: page.instagram_business_account?.id || null,
          lastSyncedAt: new Date(),
          lastError: null,
        })),
      });
    }

    await prisma.instagramBusinessConnection.deleteMany({
      where: { socialConnectionId: connection.id },
    });

    if (instagramAccounts.length) {
      await prisma.instagramBusinessConnection.createMany({
        data: instagramAccounts.map((ig: any) => ({
          socialConnectionId: connection.id,
          instagramBusinessId: ig.instagramBusinessId,
          username: ig.username || null,
          name: ig.name || null,
          profilePictureUrl: ig.profilePictureUrl || null,
          biography: ig.biography || null,
          followersCount: ig.followersCount ?? null,
          mediaCount: ig.mediaCount ?? null,
          linkedPageId: ig.linkedPageId || null,
          accountType: 'PROFESSIONAL',
          isPublishReady: Boolean(readiness.canPublishInstagram),
          canCommentModerate: Boolean(readiness.canModerateInstagramComments),
          canPublish: Boolean(readiness.canPublishInstagram),
          lastSyncedAt: new Date(),
          lastError: null,
        })),
      });
    }

    const response = NextResponse.redirect(new URL('/admin/integrations/meta?connected=1', req.url));
    response.cookies.set('neejee-meta-oauth', '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      expires: new Date(0),
    });
    return response;
  } catch (error: any) {
    console.error('[meta.callback]', error);
    const response = redirectWithError(req, error?.message || 'meta_callback_failed');
    response.cookies.set('neejee-meta-oauth', '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      expires: new Date(0),
    });
    return response;
  }
}