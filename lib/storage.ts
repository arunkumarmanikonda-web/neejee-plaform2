// Supabase Storage helper.
// Public catalogue/admin media stays in `neejee-media` for CDN delivery.
// Customer AI portraits/room photos and seller KYC documents live in private buckets.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
export const PUBLIC_STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'neejee-media';
export const PRIVATE_AI_STORAGE_BUCKET = process.env.SUPABASE_PRIVATE_AI_BUCKET || 'neejee-private-ai';
export const PRIVATE_SELLER_STORAGE_BUCKET =
  process.env.SUPABASE_PRIVATE_SELLER_DOCS_BUCKET || 'neejee-private-seller-docs';
const PRIVATE_MARKER = 'private-ai:';
const PRIVATE_SELLER_ROUTE_PREFIX = '/api/admin/seller-documents/';

function safeObjectPath(value: string): string | null {
  const decoded = String(value || '').trim().replace(/^\/+/, '');
  if (!decoded || decoded.includes('..') || decoded.includes('\\') || decoded.includes('\0')) return null;
  return decoded;
}

/** Get public URL for a stored public-media file path. */
export function publicUrl(filePath: string, bucket = PUBLIC_STORAGE_BUCKET): string {
  if (!SUPABASE_URL) return filePath;
  return `${SUPABASE_URL}/storage/v1/object/public/${encodeURIComponent(bucket)}/${filePath}`;
}

/**
 * Return a deletion reference for locally stored media.
 * Historical/public URLs return the plain path. Private AI proxy URLs return
 * a `private-ai:` marker consumed only by deleteFile().
 */
export function storagePathFromPublicUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);

    if (parsed.pathname === '/api/ai/media') {
      const path = safeObjectPath(parsed.searchParams.get('path') || '');
      return path ? `${PRIVATE_MARKER}${path}` : null;
    }

    if (!SUPABASE_URL) return null;
    const configured = new URL(SUPABASE_URL);
    if (parsed.origin !== configured.origin) return null;

    const prefix = `/storage/v1/object/public/${encodeURIComponent(PUBLIC_STORAGE_BUCKET)}/`;
    const rawPath = parsed.pathname.startsWith(prefix)
      ? parsed.pathname.slice(prefix.length)
      : null;
    if (!rawPath) return null;

    const path = safeObjectPath(decodeURIComponent(rawPath));
    return path;
  } catch {
    return null;
  }
}

async function uploadToBucket(
  bucket: string,
  filePath: string,
  data: Buffer | ArrayBuffer | Uint8Array,
  contentType: string,
  upsert = true,
): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Supabase storage not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }
  const safePath = safeObjectPath(filePath);
  if (!safePath) throw new Error('Invalid storage path');

  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(bucket)}/${safePath}`;
  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': contentType,
      'x-upsert': upsert ? 'true' : 'false',
    },
    body: data as any,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Supabase upload failed (${res.status}): ${text.slice(0, 300)}`);
  }
}

/** Upload public catalogue/admin media. */
export async function uploadFile(
  filePath: string,
  data: Buffer | ArrayBuffer | Uint8Array,
  contentType: string,
): Promise<{ url: string; path: string }> {
  await uploadToBucket(PUBLIC_STORAGE_BUCKET, filePath, data, contentType);
  return { url: publicUrl(filePath), path: filePath };
}

/** Upload sensitive customer AI media into the private bucket. */
export async function uploadPrivateAiFile(
  filePath: string,
  data: Buffer | ArrayBuffer | Uint8Array,
  contentType: string,
): Promise<{ path: string }> {
  await uploadToBucket(PRIVATE_AI_STORAGE_BUCKET, filePath, data, contentType);
  return { path: filePath };
}

/** Upload sensitive seller KYC material into the dedicated private bucket. */
export async function uploadPrivateSellerDocument(
  filePath: string,
  data: Buffer | ArrayBuffer | Uint8Array,
  contentType: string,
): Promise<{ path: string; url: string }> {
  const safePath = safeObjectPath(filePath);
  if (!safePath) throw new Error('Invalid seller document storage path');
  await uploadToBucket(PRIVATE_SELLER_STORAGE_BUCKET, safePath, data, contentType, false);
  return { path: safePath, url: privateSellerDocumentUrl(safePath) };
}

/**
 * Return an application route URL instead of exposing the private Storage URL.
 * The token is an opaque path transport only; authorization is enforced by the
 * admin download route and the document must also exist in SellerDocument.
 */
export function privateSellerDocumentUrl(filePath: string): string {
  const safePath = safeObjectPath(filePath);
  if (!safePath) throw new Error('Invalid seller document storage path');
  const token = Buffer.from(safePath, 'utf8').toString('base64url');
  return `${PRIVATE_SELLER_ROUTE_PREFIX}${token}`;
}

/** Recover a private seller object path from the application download URL. */
export function privateSellerDocumentPathFromUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  let pathname = String(value).trim();
  try {
    if (/^https?:\/\//i.test(pathname)) pathname = new URL(pathname).pathname;
  } catch {
    return null;
  }
  if (!pathname.startsWith(PRIVATE_SELLER_ROUTE_PREFIX)) return null;
  const token = pathname.slice(PRIVATE_SELLER_ROUTE_PREFIX.length).split(/[?#]/, 1)[0];
  if (!token || !/^[A-Za-z0-9_-]+$/.test(token)) return null;
  try {
    return safeObjectPath(Buffer.from(token, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function resolveDeleteTarget(fileRef: string): { bucket: string; path: string } {
  if (fileRef.startsWith(PRIVATE_MARKER)) {
    const path = safeObjectPath(fileRef.slice(PRIVATE_MARKER.length));
    if (!path) throw new Error('Invalid private storage path');
    return { bucket: PRIVATE_AI_STORAGE_BUCKET, path };
  }
  const path = safeObjectPath(fileRef);
  if (!path) throw new Error('Invalid storage path');
  return { bucket: PUBLIC_STORAGE_BUCKET, path };
}

/** Delete a file from local Supabase Storage. Missing objects are already deleted. */
export async function deleteFile(fileRef: string): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Supabase storage not configured');
  }
  const { bucket, path } = resolveDeleteTarget(fileRef);
  const delUrl = `${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(bucket)}/${path}`;
  const res = await fetch(delUrl, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
  });
  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => '');
    throw new Error(`Supabase delete failed (${res.status}): ${text.slice(0, 300)}`);
  }
}

/** Generate a unique path within a folder. */
export function makeUploadPath(folder: string, filename: string): string {
  const safeFolder = String(folder || 'uploads')
    .replace(/[^a-zA-Z0-9/_-]/g, '_')
    .replace(/\.{2,}/g, '_')
    .replace(/^\/+|\/+$/g, '');
  const safeName = filename.replace(/[^a-zA-Z0-9.\-_]/g, '_').toLowerCase();
  const ts = Date.now();
  const rand = cryptoRandomToken();
  return `${safeFolder || 'uploads'}/${ts}-${rand}-${safeName}`;
}

function cryptoRandomToken(): string {
  try {
    const bytes = new Uint8Array(8);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
  } catch {
    return Math.random().toString(36).slice(2, 14);
  }
}

export function storageConfigured(): boolean {
  return !!(SUPABASE_URL && SUPABASE_SERVICE_KEY);
}

/** Create a signed browser upload URL for the chosen bucket. */
export async function createSignedUploadUrl(
  filePath: string,
  bucket = PUBLIC_STORAGE_BUCKET,
): Promise<{ signedUrl: string; token: string; path: string; bucket: string; publicUrl?: string }> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) throw new Error('Supabase storage not configured');
  const safePath = safeObjectPath(filePath);
  if (!safePath) throw new Error('Invalid storage path');

  const url = `${SUPABASE_URL}/storage/v1/object/upload/sign/${encodeURIComponent(bucket)}/${safePath}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to create signed upload URL (${res.status}): ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  const signedUrl = data.url?.startsWith('http')
    ? data.url
    : `${SUPABASE_URL}/storage/v1${data.url}`;
  return {
    signedUrl,
    token: data.token,
    path: safePath,
    bucket,
    ...(bucket === PUBLIC_STORAGE_BUCKET ? { publicUrl: publicUrl(safePath, bucket) } : {}),
  };
}

/** Fetch one private AI object server-side using the service role. */
export async function fetchPrivateAiObject(filePath: string): Promise<Response> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) throw new Error('Supabase storage not configured');
  const safePath = safeObjectPath(filePath);
  if (!safePath) throw new Error('Invalid private storage path');

  return fetch(
    `${SUPABASE_URL}/storage/v1/object/authenticated/${encodeURIComponent(PRIVATE_AI_STORAGE_BUCKET)}/${safePath}`,
    {
      headers: { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
      cache: 'no-store',
    },
  );
}

/** Fetch one private seller KYC object server-side using the service role. */
export async function fetchPrivateSellerDocument(filePath: string): Promise<Response> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) throw new Error('Supabase storage not configured');
  const safePath = safeObjectPath(filePath);
  if (!safePath) throw new Error('Invalid seller document storage path');

  return fetch(
    `${SUPABASE_URL}/storage/v1/object/authenticated/${encodeURIComponent(PRIVATE_SELLER_STORAGE_BUCKET)}/${safePath}`,
    {
      headers: { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
      cache: 'no-store',
    },
  );
}
