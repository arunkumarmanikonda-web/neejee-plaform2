import { NextRequest, NextResponse } from 'next/server';
import { getSession, requireRole } from '@/lib/auth';
import { storageConfigured } from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const KEYS = [
  'NEXT_PUBLIC_BASE_URL','NEXT_PUBLIC_SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_STORAGE_BUCKET',
  'RAZORPAY_KEY_ID','RAZORPAY_KEY_SECRET','SHIPROCKET_EMAIL','SHIPROCKET_PASSWORD','AISENSY_API_KEY','AISENSY_NUMBER',
  'RESEND_API_KEY','OPENAI_API_KEY','FAL_KEY','REPLICATE_API_TOKEN','FACEBOOK_APP_ID','FACEBOOK_APP_SECRET','SOCIAL_TOKEN_SECRET',
  'FAST2SMS_API_KEY','FAST2SMS_SENDER_ID','FAST2SMS_ENTITY_ID','FAST2SMS_ROUTE','FAST2SMS_TEST_PHONE',
  'NEXT_PUBLIC_SITE_NAME','NEXT_PUBLIC_CANONICAL_BASE_URL','NEXT_PUBLIC_DEFAULT_META_TITLE','NEXT_PUBLIC_META_TITLE_TEMPLATE',
  'NEXT_PUBLIC_DEFAULT_META_DESCRIPTION','NEXT_PUBLIC_META_KEYWORDS','NEXT_PUBLIC_OG_TITLE','NEXT_PUBLIC_OG_DESCRIPTION',
  'NEXT_PUBLIC_OG_IMAGE_URL','NEXT_PUBLIC_TWITTER_TITLE','NEXT_PUBLIC_TWITTER_DESCRIPTION','NEXT_PUBLIC_ROBOTS_INDEX','NEXT_PUBLIC_ROBOTS_FOLLOW',
] as const;
type Key = typeof KEYS[number];

const PUBLIC = new Set<Key>([
  'NEXT_PUBLIC_BASE_URL','NEXT_PUBLIC_SUPABASE_URL','SUPABASE_STORAGE_BUCKET','RAZORPAY_KEY_ID','AISENSY_NUMBER',
  'FAST2SMS_SENDER_ID','FAST2SMS_ENTITY_ID','FAST2SMS_ROUTE','FAST2SMS_TEST_PHONE','NEXT_PUBLIC_SITE_NAME',
  'NEXT_PUBLIC_CANONICAL_BASE_URL','NEXT_PUBLIC_DEFAULT_META_TITLE','NEXT_PUBLIC_META_TITLE_TEMPLATE',
  'NEXT_PUBLIC_DEFAULT_META_DESCRIPTION','NEXT_PUBLIC_META_KEYWORDS','NEXT_PUBLIC_OG_TITLE','NEXT_PUBLIC_OG_DESCRIPTION',
  'NEXT_PUBLIC_OG_IMAGE_URL','NEXT_PUBLIC_TWITTER_TITLE','NEXT_PUBLIC_TWITTER_DESCRIPTION','NEXT_PUBLIC_ROBOTS_INDEX','NEXT_PUBLIC_ROBOTS_FOLLOW',
]);

function cfg() {
  return {
    token: process.env.VERCEL_ACCESS_TOKEN || process.env.VERCEL_TOKEN || '',
    projectId: process.env.VERCEL_PROJECT_ID || '',
    teamId: process.env.VERCEL_TEAM_ID || '',
  };
}

function vurl(path: string) {
  const c = cfg();
  return `https://api.vercel.com${path}${c.teamId ? `?teamId=${encodeURIComponent(c.teamId)}` : ''}`;
}

async function vfetch(path: string, init?: RequestInit) {
  const c = cfg();
  return fetch(vurl(path), {
    ...init,
    headers: { Authorization: `Bearer ${c.token}`, 'Content-Type': 'application/json', ...(init?.headers || {}) },
    cache: 'no-store',
  });
}

async function vercelInventory() {
  const c = cfg();
  const present = new Set<string>();
  const publicValues: Record<string,string> = {};
  if (!c.token || !c.projectId) return { present, publicValues };
  const res = await vfetch(`/v10/projects/${c.projectId}/env`);
  if (!res.ok) return { present, publicValues };
  const data = await res.json().catch(() => ({}));
  const items = Array.isArray(data) ? data : (data?.envs || data?.variables || []);
  for (const item of items) {
    const key = typeof item?.key === 'string' ? item.key : '';
    if (!key || !KEYS.includes(key as Key)) continue;
    present.add(key);
    if (PUBLIC.has(key as Key) && typeof item?.value === 'string') publicValues[key] = item.value;
  }
  return { present, publicValues };
}

function runtimeStatus() {
  return {
    database: !!process.env.DATABASE_URL,
    directUrl: !!process.env.DIRECT_URL,
    authSecret: !!process.env.AUTH_SECRET,
    baseUrl: !!process.env.NEXT_PUBLIC_BASE_URL,
    storage: storageConfigured(),
    supabaseUrl: !!(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL),
    supabaseServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    shiprocket: !!(process.env.SHIPROCKET_EMAIL && process.env.SHIPROCKET_PASSWORD),
    razorpay: !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
    resend: !!process.env.RESEND_API_KEY,
    aisensy: !!(process.env.AISENSY_API_KEY && process.env.AISENSY_NUMBER),
    openai: !!process.env.OPENAI_API_KEY,
    fal: !!process.env.FAL_KEY,
    replicate: !!process.env.REPLICATE_API_TOKEN,
    sms: !!(process.env.FAST2SMS_API_KEY && process.env.FAST2SMS_SENDER_ID && process.env.FAST2SMS_ENTITY_ID),
    meta: !!(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET),
    socialTokenSecret: !!process.env.SOCIAL_TOKEN_SECRET,
  };
}

export async function GET() {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN','SUPER_ADMIN','FINANCE'] as any)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const c = cfg();
  const inventory = user?.role === 'SUPER_ADMIN' ? await vercelInventory() : { present: new Set<string>(), publicValues: {} as Record<string,string> };
  const response = NextResponse.json({
    canEdit: requireRole(user, ['SUPER_ADMIN'] as any),
    vercel: { configured: !!(c.token && c.projectId), projectId: c.projectId || null, teamId: c.teamId || null },
    runtimeStatus: runtimeStatus(),
    fields: KEYS.map((key) => {
      const runtimeValue = process.env[key] || '';
      const inRuntime = !!runtimeValue;
      const inVercel = inventory.present.has(key);
      const secret = !PUBLIC.has(key);
      return {
        key,
        value: secret ? '' : (runtimeValue || inventory.publicValues[key] || ''),
        configured: inRuntime || inVercel,
        source: inRuntime && inVercel ? 'runtime+vercel' : inRuntime ? 'runtime' : inVercel ? 'vercel' : 'missing',
        secret,
      };
    }),
  });
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  return response;
}

export async function PUT(req: NextRequest) {
  const user = await getSession();
  if (!requireRole(user, ['SUPER_ADMIN'] as any)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const c = cfg();
  if (!c.token || !c.projectId) return NextResponse.json({ error: 'Vercel sync is not configured. Set VERCEL_ACCESS_TOKEN and VERCEL_PROJECT_ID on the server first.' }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const values = (body?.values || {}) as Record<string,string>;
  const updated: string[] = [];
  const failed: Array<{key:string;error:string}> = [];
  for (const key of KEYS) {
    if (typeof values[key] !== 'string') continue;
    const value = values[key].trim();
    if (!value) continue; // secret inputs are write-only; blank never erases an existing value
    const res = await vfetch(`/v10/projects/${c.projectId}/env?upsert=true`, {
      method: 'POST',
      body: JSON.stringify({ key, value, type: PUBLIC.has(key) ? 'plain' : 'encrypted', target: ['production','preview','development'], comment: 'Updated from NEEJEE Super Admin settings' }),
    });
    if (!res.ok) failed.push({ key, error: (await res.text()) || `HTTP ${res.status}` }); else updated.push(key);
  }
  return NextResponse.json({
    ok: failed.length === 0,
    updated,
    failed,
    note: updated.length ? 'Saved to Vercel. Secret values remain hidden. A fresh deployment may be required before runtime health reflects the change.' : 'No values changed. Existing configured settings were left untouched.',
  });
}
