// Supabase Storage helper — uses service role key for server-side uploads
// Bucket: 'neejee-media' (must exist in Supabase, public read)

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'neejee-media';

/** Get public URL for a stored file path. */
export function publicUrl(filePath: string): string {
  if (!SUPABASE_URL) return filePath;
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${filePath}`;
}

/**
 * Return the bucket-relative path only for URLs that point back to this
 * configured Supabase Storage bucket. External provider/CDN URLs return null.
 */
export function storagePathFromPublicUrl(value: string | null | undefined): string | null {
  if (!value || !SUPABASE_URL) return null;
  try {
    const configured = new URL(SUPABASE_URL);
    const parsed = new URL(value);
    if (parsed.origin !== configured.origin) return null;

    const prefix = `/storage/v1/object/public/${encodeURIComponent(BUCKET)}/`;
    const rawPath = parsed.pathname.startsWith(prefix)
      ? parsed.pathname.slice(prefix.length)
      : null;
    if (!rawPath) return null;

    const decoded = decodeURIComponent(rawPath);
    if (!decoded || decoded.startsWith('/') || decoded.includes('..')) return null;
    return decoded;
  } catch {
    return null;
  }
}

/** Upload binary file to Supabase Storage. Returns public URL. */
export async function uploadFile(
  filePath: string,
  data: Buffer | ArrayBuffer | Uint8Array,
  contentType: string
): Promise<{ url: string; path: string }> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Supabase storage not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }
  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${filePath}`;
  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body: data as any,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Supabase upload failed (${res.status}): ${text}`);
  }
  return { url: publicUrl(filePath), path: filePath };
}

/** Delete a file from storage. Missing objects are treated as already deleted. */
export async function deleteFile(filePath: string): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Supabase storage not configured');
  }
  const delUrl = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${filePath}`;
  const res = await fetch(delUrl, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
  });
  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => '');
    throw new Error(`Supabase delete failed (${res.status}): ${text}`);
  }
}

/** Generate a unique path within a folder. */
export function makeUploadPath(folder: string, filename: string): string {
  const safeName = filename.replace(/[^a-zA-Z0-9.\-_]/g, '_').toLowerCase();
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `${folder}/${ts}-${rand}-${safeName}`;
}

/** Status check used by /admin/settings. */
export function storageConfigured(): boolean {
  return !!(SUPABASE_URL && SUPABASE_SERVICE_KEY);
}

/**
 * Create a signed upload URL the browser can PUT to directly.
 * This bypasses Vercel's serverless body limit — customers upload
 * straight to Supabase Storage from the browser.
 */
export async function createSignedUploadUrl(filePath: string): Promise<{ signedUrl: string; token: string; path: string; publicUrl: string }> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Supabase storage not configured');
  }
  const url = `${SUPABASE_URL}/storage/v1/object/upload/sign/${BUCKET}/${filePath}`;
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
    throw new Error(`Failed to create signed upload URL (${res.status}): ${text}`);
  }
  const data = await res.json();
  const signedUrl = data.url?.startsWith('http')
    ? data.url
    : `${SUPABASE_URL}/storage/v1${data.url}`;
  return {
    signedUrl,
    token: data.token,
    path: filePath,
    publicUrl: publicUrl(filePath),
  };
}
