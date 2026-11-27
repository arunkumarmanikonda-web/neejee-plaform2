import { get, put } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { recoveryAuthorized } from '@/lib/recovery/authorization';
import { readCredential } from '@/lib/payments/razorpay-credentials';
import { prisma } from '@/lib/prisma';
import { limits, restoreFiles, safePath, sealFiles, type RecoveryFile } from '@/lib/recovery/storage-archive';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const preferredRegion = 'sin1';
export const maxDuration = 120;
const noStore = { headers: { 'Cache-Control': 'private, no-store' } };
type ObjectRow = { bucket: string; name: string; size: number; mime: string; version: string };

async function inventory(catalogue: string, seller: string) {
  const rows = await prisma.$queryRaw<ObjectRow[]>`
    SELECT bucket_id AS bucket, name, (metadata->>'size')::int AS size,
           coalesce(metadata->>'mimetype','application/octet-stream') AS mime,
           coalesce(version::text,updated_at::text) AS version
    FROM storage.objects WHERE bucket_id IN (${catalogue},${seller})
    ORDER BY bucket_id, name LIMIT ${limits.objects + 1}`;
  if (!rows.length || rows.length > limits.objects || rows.some(r => !safePath(r.name) || !Number.isSafeInteger(r.size) || r.size < 0)
    || rows.reduce((sum,r) => sum + r.size,0) > limits.bytes) throw new Error('Inventory exceeds the approved recovery limits or is empty.');
  return rows;
}

export async function GET(req: Request) {
  if (!recoveryAuthorized(req))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, ...noStore });
  const storeId = process.env.RECOVERY_STORE_ID;
  const key = readCredential(process.env.RECOVERY_ARCHIVE_KEY);
  const serviceKey = readCredential(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { getStorageOrigin } = await import('@/lib/storage');
  const origin = getStorageOrigin();
  const missing = [readCredential(process.env.VERCEL_ENV) !== 'production' && 'production target',
    !storeId && 'store connection', !key && 'encryption key', !serviceKey && 'storage credential', !origin && 'storage origin'].filter(Boolean);
  if (missing.length) return NextResponse.json({ verified:false, stage:'configuration', reason:missing.join(', ') }, { status:503,...noStore });
  const date = new Date().toISOString();
  const path = 'storage/' + date.slice(0,10) + '.njbackup';
  let stage = 'receipt';
  try {
    // A verified receipt is written last. If an earlier run stopped after
    // uploading the archive, the retry reads and verifies that same archive.
    const prior = await get(path + '.verified', { storeId, access: 'private', useCache: false });
    if (prior?.statusCode === 200) return NextResponse.json(await new Response(prior.stream).json(), noStore);
    stage = 'archive lookup';
    let existing = await get(path, { storeId, access: 'private', useCache: false });
    let source: RecoveryFile[] | undefined;
    if (!existing) {
      const catalogue = process.env.SUPABASE_STORAGE_BUCKET || 'neejee-media';
      const seller = process.env.SUPABASE_PRIVATE_SELLER_DOCS_BUCKET || 'neejee-private-seller-docs';
      stage = 'source inventory';
      const rows = await inventory(catalogue, seller);
      source = [];
      stage = 'source download';
      for (let i = 0; i < rows.length; i += 4) {
        const batch = await Promise.all(rows.slice(i,i + 4).map(async row => {
          const location = [row.bucket,...row.name.split('/')].map(encodeURIComponent).join('/');
          const response = await fetch(origin + '/storage/v1/object/authenticated/' + location, {
            headers: { apikey: serviceKey, Authorization: 'Bearer ' + serviceKey },
            redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(12000),
          });
          if (!response.ok) throw new Error('Source HTTP '+response.status);
          const bytes = Buffer.from(await response.arrayBuffer());
          if (bytes.length !== row.size) throw new Error('Source object size changed.');
          return { bucket: row.bucket, name: row.name, contentType: row.mime, bytes };
        }));
        source.push(...batch);
      }
      if (JSON.stringify(rows) !== JSON.stringify(await inventory(catalogue, seller))) throw new Error('Source changed during capture.');
      stage = 'archive write';
      const sealed = sealFiles(source, key, date);
      await put(path, sealed, { storeId, access: 'private', addRandomSuffix: false, allowOverwrite: false,
        contentType: 'application/octet-stream', ttlDays: 14 });
      existing = await get(path, { storeId, access: 'private', useCache: false });
    }
    if (!existing || existing.statusCode !== 200) throw new Error('Backup read-back failed.');
    stage = 'read-back and decryption';
    const decoded = restoreFiles(Buffer.from(await new Response(existing.stream).arrayBuffer()), key);
    if (source && (source.length !== decoded.files.length || source.some((f,i) =>
      f.bucket !== decoded.files[i].bucket || f.name !== decoded.files[i].name || !f.bytes.equals(decoded.files[i].bytes))))
      throw new Error('Source comparison failed.');
    const receipt = { verified: true, date: decoded.createdAt, objects: decoded.files.length, bytes: decoded.bytes };
    stage = 'receipt write';
    await put(path + '.verified', JSON.stringify(receipt), { storeId, access: 'private', addRandomSuffix: false,
      allowOverwrite: false, contentType: 'application/json', ttlDays: 14 });
    console.info('[storage-recovery] Verified', receipt.objects, 'files', receipt.bytes, 'bytes');
    return NextResponse.json(receipt, noStore);
  } catch (error) {
    // Never log object names, provider responses, credentials or customer data.
    console.error('[storage-recovery] Backup incomplete', stage, error instanceof Error ? error.name : 'Error');
    const message = error instanceof Error ? error.message : '';
    const reason = /^(?:Source HTTP |Failed to fetch blob: )([1-5][0-9]{2})/.exec(message)?.[1];
    return NextResponse.json({ verified: false, stage, reason, error: error instanceof Error ? error.name : 'RecoveryError' }, { status: 503, ...noStore });
  }
}
