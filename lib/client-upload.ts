// Client-side image upload helper for AI surfaces.
//
// Strategy:
//   1. If the file is small (< 3 MB), POST as multipart form to /api/ai/upload (fast path).
//   2. If the file is large or compression is requested, downscale + recompress in-browser
//      to fit a max dimension and target size before uploading.
//   3. For files >= 4 MB after compression, use the signed-URL flow and PUT direct to Supabase.
//      This bypasses Vercel's 4.5 MB body limit.
//
// Returns the final public URL on success.

const VERCEL_BODY_LIMIT = 4 * 1024 * 1024; // 4 MB safe limit
const TARGET_MAX_DIMENSION = 2048;          // px — plenty for try-on
const TARGET_QUALITY = 0.85;                // JPEG quality

/** Downscale + recompress an image File to a JPEG Blob below target size. */
export async function compressImage(file: File): Promise<Blob> {
  // HEIC/HEIF can't be drawn to canvas in most browsers — return as-is
  if (file.type === 'image/heic' || file.type === 'image/heif') return file;

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;

  const { width, height } = bitmap;
  const scale = Math.min(1, TARGET_MAX_DIMENSION / Math.max(width, height));
  const newW = Math.round(width * scale);
  const newH = Math.round(height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = newW;
  canvas.height = newH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, newW, newH);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Compression failed'))),
      'image/jpeg',
      TARGET_QUALITY,
    );
  });
}

interface UploadResult {
  url: string;
  path: string;
}

/** Upload via direct multipart POST. Used for small files. */
async function uploadViaApi(blob: Blob, filename: string, folder: string): Promise<UploadResult> {
  const fd = new FormData();
  fd.append('file', blob, filename);
  fd.append('folder', folder);
  const res = await fetch('/api/ai/upload', { method: 'POST', body: fd, credentials: 'include' });
  const text = await res.text();
  let j: any = {};
  try { j = JSON.parse(text); } catch { j = { error: text.slice(0, 200) }; }
  if (!res.ok) throw new Error(j.error || `Upload failed (${res.status})`);
  return { url: j.url, path: j.path };
}

/** Upload via signed URL (PUT direct to Supabase). Bypasses Vercel body limit. */
async function uploadViaSignedUrl(blob: Blob, filename: string, folder: string, contentType: string): Promise<UploadResult> {
  // 1. Ask our API for a signed URL
  const signRes = await fetch('/api/ai/sign-upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ filename, contentType, size: blob.size, folder }),
  });
  const signText = await signRes.text();
  let signJson: any = {};
  try { signJson = JSON.parse(signText); } catch { signJson = { error: signText.slice(0, 200) }; }
  if (!signRes.ok) throw new Error(signJson.error || `Sign request failed (${signRes.status})`);

  // 2. PUT the file straight to Supabase Storage using the signed URL.
  //    The signed URL already carries the auth via query token, no header needed.
  const putRes = await fetch(signJson.signedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType, 'x-upsert': 'true' },
    body: blob,
  });
  if (!putRes.ok) {
    const t = await putRes.text().catch(() => '');
    throw new Error(`Storage upload failed (${putRes.status}): ${t.slice(0, 200)}`);
  }

  return { url: signJson.publicUrl, path: signJson.path };
}

/**
 * Top-level upload: compresses, then picks the right transport.
 * Throws on failure with a human-readable message.
 */
export async function uploadAiImage(file: File, folder: string): Promise<UploadResult> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file (JPG, PNG, WebP, HEIC).');
  }

  // 1. Compress if it's large or if it's PNG/HEIC that benefits from JPEG
  let blob: Blob = file;
  let contentType = file.type;
  let filename = file.name || 'upload.jpg';

  if (file.size > 1.5 * 1024 * 1024 || file.type !== 'image/jpeg') {
    try {
      blob = await compressImage(file);
      contentType = blob.type || 'image/jpeg';
      // Re-extension if we changed format
      if (contentType === 'image/jpeg' && !/\.jpe?g$/i.test(filename)) {
        filename = filename.replace(/\.[^.]+$/, '') + '.jpg';
      }
    } catch {
      // Compression failed — fall back to original
    }
  }

  // 2. Pick transport based on final size
  if (blob.size < VERCEL_BODY_LIMIT) {
    return await uploadViaApi(blob, filename, folder);
  }
  return await uploadViaSignedUrl(blob, filename, folder, contentType);
}
