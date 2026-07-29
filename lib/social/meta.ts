export type MetaConnectKind = 'facebook' | 'instagram';

export type MetaTokenResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
};

export type MetaPermission = {
  permission: string;
  status: string;
};

export type MetaPage = {
  id: string;
  name: string;
  category?: string;
  picture?: { data?: { url?: string } };
  access_token?: string;
  tasks?: string[];
  instagram_business_account?: {
    id: string;
    username?: string;
    name?: string;
    profile_picture_url?: string;
    biography?: string;
    followers_count?: number;
    media_count?: number;
  };
};

const GRAPH_VERSION = 'v24.0';

const DEFAULT_SCOPES = [
  'public_profile',
  'email',
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_metadata',
  'pages_manage_posts',
  'pages_read_user_content',
  'pages_manage_engagement',
  'business_management',
  'instagram_basic',
  'instagram_content_publish',
  'instagram_manage_comments',
];

function getBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_CANONICAL_BASE_URL ||
    'http://localhost:3000'
  ).replace(/\/$/, '');
}

export function getMetaRedirectUri(kind: MetaConnectKind) {
  return `${getBaseUrl()}/api/admin/integrations/meta/connect/callback?kind=${kind}`;
}

export function getMetaOAuthUrl(kind: MetaConnectKind, state: string) {
  const appId = process.env.FACEBOOK_APP_ID;
  if (!appId) throw new Error('FACEBOOK_APP_ID not configured');

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: getMetaRedirectUri(kind),
    response_type: 'code',
    scope: DEFAULT_SCOPES.join(','),
    state,
  });

  return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
}

async function graphJson(url: string) {
  const res = await fetch(url, { cache: 'no-store' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((json as any)?.error?.message || `Graph API ${res.status}`);
  }
  return json as any;
}

export async function exchangeCodeForShortLivedUserToken(code: string, kind: MetaConnectKind) {
  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (!appId || !appSecret) throw new Error('FACEBOOK_APP_ID / FACEBOOK_APP_SECRET not configured');

  const params = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: getMetaRedirectUri(kind),
    code,
  });

  return graphJson(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token?${params.toString()}`) as Promise<MetaTokenResponse>;
}

export async function exchangeForLongLivedUserToken(accessToken: string) {
  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (!appId || !appSecret) throw new Error('FACEBOOK_APP_ID / FACEBOOK_APP_SECRET not configured');

  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: accessToken,
  });

  return graphJson(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token?${params.toString()}`) as Promise<MetaTokenResponse>;
}

export async function getMetaMe(accessToken: string) {
  const params = new URLSearchParams({
    fields: 'id,name,email',
    access_token: accessToken,
  });
  return graphJson(`https://graph.facebook.com/${GRAPH_VERSION}/me?${params.toString()}`);
}

export async function getMetaPermissions(accessToken: string): Promise<string[]> {
  const params = new URLSearchParams({ access_token: accessToken });
  const json = await graphJson(`https://graph.facebook.com/${GRAPH_VERSION}/me/permissions?${params.toString()}`) as { data?: MetaPermission[] };
  return (json.data || [])
    .filter((item) => item.status === 'granted')
    .map((item) => item.permission);
}

export async function getManagedPages(accessToken: string): Promise<MetaPage[]> {
  const params = new URLSearchParams({
    fields: 'id,name,category,picture{url},access_token,tasks,instagram_business_account{id,username,name,profile_picture_url,biography,followers_count,media_count}',
    access_token: accessToken,
  });
  const json = await graphJson(`https://graph.facebook.com/${GRAPH_VERSION}/me/accounts?${params.toString()}`) as { data?: MetaPage[] };
  return json.data || [];
}

export function getInstagramAccountsFromPages(pages: MetaPage[]) {
  return pages
    .filter((page) => page.instagram_business_account?.id)
    .map((page) => ({
      instagramBusinessId: page.instagram_business_account!.id,
      username: page.instagram_business_account?.username || null,
      name: page.instagram_business_account?.name || null,
      profilePictureUrl: page.instagram_business_account?.profile_picture_url || null,
      biography: page.instagram_business_account?.biography || null,
      followersCount: page.instagram_business_account?.followers_count ?? null,
      mediaCount: page.instagram_business_account?.media_count ?? null,
      linkedPageId: page.id,
    }));
}

export function summarizeReadiness(
  pages: MetaPage[],
  instagramAccounts: Array<{ instagramBusinessId: string; linkedPageId: string | null }>,
  scopes: string[],
) {
  const pagePostScopes = scopes.includes('pages_manage_posts') || scopes.includes('pages_manage_engagement');
  const instagramPublishScopes = scopes.includes('instagram_content_publish');
  const instagramCommentScopes = scopes.includes('instagram_manage_comments');

  return {
    totalPages: pages.length,
    totalInstagramAccounts: instagramAccounts.length,
    hasAnyFacebookPage: pages.length > 0,
    hasAnyInstagramProfessional: instagramAccounts.length > 0,
    canPublishFacebook: pages.length > 0 && pagePostScopes,
    canPublishInstagram: instagramAccounts.length > 0 && instagramPublishScopes,
    canModerateInstagramComments: instagramAccounts.length > 0 && instagramCommentScopes,
    grantedScopes: scopes,
  };
}