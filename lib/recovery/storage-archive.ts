import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';

export const limits = { objects: 160, bytes: 32 * 1024 * 1024, archive: 48 * 1024 * 1024 };
const magic = Buffer.from('NEEJEE-FILES-1\n');
export type RecoveryFile = { bucket: string; name: string; contentType: string; bytes: Buffer };
type RecordOnDisk = { bucket: string; name: string; contentType: string; size: number; sha256: string; data: string };
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

export function safePath(path: string) {
  return typeof path === 'string' && !/[\\\x00-\x1f]/.test(path)
    && path.split('/').every(part => part !== '' && part !== '.' && part !== '..');
}

function archiveKey(hex: string) {
  if (!/^[a-f\d]{64}$/i.test(hex)) throw new Error('Recovery archive key must be 32 bytes.');
  return Buffer.from(hex, 'hex');
}

export function sealFiles(files: RecoveryFile[], key: string, createdAt: string) {
  const records: RecordOnDisk[] = files.map(f => ({
    bucket: f.bucket, name: f.name, contentType: f.contentType,
    size: f.bytes.length, sha256: digest(f.bytes), data: f.bytes.toString('base64'),
  }));
  const plaintext = gzipSync(Buffer.from(JSON.stringify({ version: 1, createdAt, files: records })), { level: 1 });
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', archiveKey(key), iv);
  cipher.setAAD(magic);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([magic, iv, cipher.getAuthTag(), ciphertext]);
}

export function restoreFiles(archive: Buffer, key: string) {
  if (archive.length > limits.archive || !archive.subarray(0, magic.length).equals(magic)) throw new Error('Invalid archive.');
  const start = magic.length;
  const decipher = createDecipheriv('aes-256-gcm', archiveKey(key), archive.subarray(start, start + 12));
  decipher.setAAD(magic);
  decipher.setAuthTag(archive.subarray(start + 12, start + 28));
  const compressed = Buffer.concat([decipher.update(archive.subarray(start + 28)), decipher.final()]);
  const content = JSON.parse(gunzipSync(compressed, { maxOutputLength: limits.archive }).toString());
  if (content.version !== 1 || !Array.isArray(content.files) || content.files.length > limits.objects) throw new Error('Invalid manifest.');
  const seen = new Set<string>();
  let bytes = 0;
  const files: RecoveryFile[] = content.files.map((record: RecordOnDisk) => {
    const path = record.bucket + '/' + record.name;
    if (!safePath(record.bucket) || record.bucket.includes('/') || !safePath(record.name) || seen.has(path)) throw new Error('Invalid or duplicate object path.');
    const body = Buffer.from(record.data, 'base64');
    bytes += body.length;
    if (bytes > limits.bytes || body.length !== record.size || digest(body) !== record.sha256) throw new Error('Object verification failed.');
    seen.add(path);
    return { bucket: record.bucket, name: record.name, contentType: record.contentType, bytes: body };
  });
  return { createdAt: String(content.createdAt), files, bytes };
}
