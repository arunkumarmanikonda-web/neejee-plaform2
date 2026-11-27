import { NextRequest, NextResponse } from 'next/server';
import { getSession, requireRole } from '@/lib/auth';
import { razorpayxConfigured } from '@/lib/razorpayx';
import { webhookSecretConfigured } from '@/lib/webhooks/auth';
import { storageConfigured } from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const KEYS = [
  'NEXT_PUBLIC_BASE_URL','NEXT_PUBLIC_SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_STORAGE_BUCKET',
  'RAZORPAY_KEY_ID','RAZORPAY_KEY_SECRET','SHIPROCKET_EMAIL','SHIPROCKET_PASSWORD','AISENSY_API_KEY','AISENSY_NUMBER',
  'RAZORPAYX_KEY_ID','RAZORPAYX_KEY_SECRET','RAZORPAYX_SOURCE_ACCOUNT_NUMBER','RAZORPAYX_WEBHOOK_SECRET',
  'SHIPROCKET_WEBHOOK_TOKEN','AISENSY_WEBHOOK_SECRET','FAST2SMS_WEBHOOK_SECRET',
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
  const url = new URL(path, 'https://api.vercel.com');
  if (c.teamId) url.searchParams.set('teamId', c.teamId);
  return url;
}

async function vfetch(path: string, init?: RequestInit) {
  const c = cfg();
  return fetch(vurl(path), {
    ...init,
    headers: { Authorization: `Bearer ${c.token}`, 'Content-Type': 'application/json', ...(init?.headers || {}) },
    cache: 'no-store',
  });
}

type Entry = { id: string; key: string; type: string; target: string[]; customEnvironmentIds?: string[] };

async function productionInventory(): Promise<Map<string, Entry>> {
  const res = await vfetch(`/v10/projects/${cfg().projectId}/env?decrypt=false`);
  if (!res.ok) throw new Error('Could not read Vercel settings.');
  const data = await res.json();
  const items: Entry[] = Array.isArray(data) ? data : data.envs;
  if (!Array.isArray(items) || data.pagination?.next) throw new Error('Incomplete Vercel settings inventory.');
  return new Map(items.filter(item => item.target?.includes('production')).map(item => [item.key, item]));
}

function productionEditorConfigured() {
  const c = cfg();
  return process.env.VERCEL_ENV === 'production' && !!(c.token && c.projectId);
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
    payouts: razorpayxConfigured(),
    shipmentCallbacks: webhookSecretConfigured(process.env.SHIPROCKET_WEBHOOK_TOKEN),
    smsCallbacks: webhookSecretConfigured(process.env.FAST2SMS_WEBHOOK_SECRET),
    whatsappCallbacks: webhookSecretConfigured(process.env.AISENSY_WEBHOOK_SECRET),
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
  const connected = productionEditorConfigured();
  const inventory = user?.role === 'SUPER_ADMIN' && connected ? await productionInventory().catch(() => null) : null;
  const response = NextResponse.json({
    canEdit: connected && requireRole(user, ['SUPER_ADMIN']),
    vercel: { configured: connected, projectId: c.projectId || null, teamId: c.teamId || null },
    runtimeStatus: runtimeStatus(),
    fields: KEYS.map((key) => {
      const runtimeValue = process.env[key] || '';
      const inRuntime = !!runtimeValue;
      const inVercel = inventory?.has(key) ?? false;
      const secret = !PUBLIC.has(key);
      return {
        key,
        value: secret ? '' : runtimeValue,
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
  if (!productionEditorConfigured()) return NextResponse.json({ error: 'Edit these settings from the production workspace.' }, { status: 403 });
  const inventory = await productionInventory().catch(() => null);
  if (!inventory) return NextResponse.json({error:'Could not verify production settings. Try again from Vercel.'}, {status:503});
  const body = await req.json().catch(() => ({}));
  const values = (body?.values || {}) as Record<string,string>;
  const updated: string[] = [];
  const failed: Array<{key:string;error:string}> = [];
  for (const key of KEYS) {
    if (typeof values[key] !== 'string') continue;
    const value = values[key].trim();
    if (!value) continue; // secret inputs are write-only; blank never erases an existing value
    const existing = inventory.get(key);
    if (existing && (existing.target.length !== 1 || existing.customEnvironmentIds?.length)) {
      failed.push({key, error:'Split this shared setting by environment in Vercel before editing it here.'});
      continue;
    }
    if (existing?.type === 'sensitive' && key.startsWith('NEXT_PUBLIC_')) {
      failed.push({key, error:'This public field was saved as a Vercel Secret. Manage its type in Vercel.'});
      continue;
    }
    const type = !PUBLIC.has(key) || existing?.type === 'sensitive' ? 'sensitive' : 'plain';
    const path = existing ? `/v9/projects/${c.projectId}/env/${existing.id}` : `/v10/projects/${c.projectId}/env`;
    try {
      const res = await vfetch(path, {
        method: existing ? 'PATCH' : 'POST',
        body: JSON.stringify({key, value, type, target:['production']}),
      });
      if (res.ok) updated.push(key);
      else failed.push({key, error:`Vercel declined this setting (HTTP ${res.status}).`});
    } catch {
      failed.push({key, error:'The save could not be confirmed. Check the setting in Vercel before retrying.'});
    }
  }
  return NextResponse.json({
    ok: failed.length === 0,
    updated,
    failed,
    note: updated.length ? 'Saved to Vercel. Secret values remain hidden. A fresh deployment may be required before runtime health reflects the change.' : 'No settings were confirmed saved.',
  });
}
