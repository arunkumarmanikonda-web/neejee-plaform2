import { NextRequest, NextResponse } from 'next/server';
import { getSession, requireRole } from '@/lib/auth';
import { storageConfigured } from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const EDITABLE_KEYS = [
  'NEXT_PUBLIC_BASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_STORAGE_BUCKET',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
  'SHIPROCKET_EMAIL',
  'SHIPROCKET_PASSWORD',
  'AISENSY_API_KEY',
  'AISENSY_NUMBER',
  'RESEND_API_KEY',
  'OPENAI_API_KEY',
  'FAL_KEY',
  'REPLICATE_API_TOKEN',
  'FAST2SMS_API_KEY',
  'FAST2SMS_SENDER_ID',
  'FAST2SMS_ENTITY_ID',
  'FAST2SMS_ROUTE',
  'FAST2SMS_TEST_PHONE',
] as const;

type EditableKey = typeof EDITABLE_KEYS[number];

const PUBLIC_KEYS = new Set<EditableKey>([
  'NEXT_PUBLIC_BASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_STORAGE_BUCKET',
  'RAZORPAY_KEY_ID',
  'AISENSY_NUMBER',
  'FAST2SMS_SENDER_ID',
  'FAST2SMS_ENTITY_ID',
  'FAST2SMS_ROUTE',
  'FAST2SMS_TEST_PHONE',
]);

function vercelConfig() {
  return {
    token: process.env.VERCEL_ACCESS_TOKEN || process.env.VERCEL_TOKEN || '',
    projectId: process.env.VERCEL_PROJECT_ID || '',
    teamId: process.env.VERCEL_TEAM_ID || '',
  };
}

function vercelPath(pathname: string) {
  const cfg = vercelConfig();
  const qs = new URLSearchParams();
  if (cfg.teamId) qs.set('teamId', cfg.teamId);
  const query = qs.toString();
  return `https://api.vercel.com${pathname}${query ? `?${query}` : ''}`;
}

async function vercelFetch(pathname: string, init?: RequestInit) {
  const cfg = vercelConfig();
  return fetch(vercelPath(pathname), {
    ...init,
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });
}

async function readVercelValues(): Promise<Record<string, string>> {
  const cfg = vercelConfig();
  if (!cfg.token || !cfg.projectId) return {};

  const res = await vercelFetch(`/v10/projects/${cfg.projectId}/env`);
  if (!res.ok) return {};

  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch {}

  const items = Array.isArray(data)
    ? data
    : Array.isArray(data?.envs)
      ? data.envs
      : Array.isArray(data?.variables)
        ? data.variables
        : [];

  const out: Record<string, string> = {};
  for (const item of items) {
    if (!item?.key) continue;
    if (typeof item.value === 'string' && !out[item.key]) {
      out[item.key] = item.value;
    }
  }
  return out;
}

function buildRuntimeStatus() {
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
  };
}

function localValues() {
  return Object.fromEntries(
    EDITABLE_KEYS.map((key) => [key, process.env[key] || ''])
  ) as Record<EditableKey, string>;
}

export async function GET() {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'FINANCE'] as any)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cfg = vercelConfig();
  const fromVercel = user?.role === 'SUPER_ADMIN' ? await readVercelValues() : {};
  const merged = { ...localValues(), ...(fromVercel as any) };

  return NextResponse.json({
    canEdit: requireRole(user, ['SUPER_ADMIN'] as any),
    vercel: {
      configured: !!(cfg.token && cfg.projectId),
      projectId: cfg.projectId || null,
      teamId: cfg.teamId || null,
    },
    runtimeStatus: buildRuntimeStatus(),
    fields: EDITABLE_KEYS.map((key) => ({
      key,
      value: merged[key] || '',
      configured: !!merged[key],
      secret: !PUBLIC_KEYS.has(key),
    })),
  });
}

export async function PUT(req: NextRequest) {
  const user = await getSession();
  if (!requireRole(user, ['SUPER_ADMIN'] as any)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cfg = vercelConfig();
  if (!cfg.token || !cfg.projectId) {
    return NextResponse.json(
      { error: 'Vercel sync is not configured. Set VERCEL_ACCESS_TOKEN and VERCEL_PROJECT_ID on the server first.' },
      { status: 503 }
    );
  }

  let body: any = {};
  try { body = await req.json(); } catch {}

  const values = (body?.values || {}) as Record<string, string>;
  const updated: string[] = [];
  const failed: Array<{ key: string; error: string }> = [];

  for (const key of EDITABLE_KEYS) {
    if (typeof values[key] !== 'string') continue;
    const value = values[key].trim();
    if (!value) continue;

    const res = await vercelFetch(`/v10/projects/${cfg.projectId}/env?upsert=true`, {
      method: 'POST',
      body: JSON.stringify({
        key,
        value,
        type: PUBLIC_KEYS.has(key) ? 'plain' : 'encrypted',
        target: ['production', 'preview', 'development'],
        comment: 'Updated from /admin/settings',
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      failed.push({ key, error: text || `HTTP ${res.status}` });
      continue;
    }

    updated.push(key);
  }

  return NextResponse.json({
    ok: failed.length === 0,
    updated,
    failed,
    note: 'Values were sent to Vercel. A fresh deployment may still be needed for runtime-only environment changes to take effect.',
  });
}