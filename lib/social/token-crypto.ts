import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

function getKey() {
  const secret = process.env.SOCIAL_TOKEN_SECRET || process.env.AUTH_SECRET;
  if (!secret) throw new Error('SOCIAL_TOKEN_SECRET not configured');
  return createHash('sha256').update(secret).digest();
}

export function encryptToken(value: string): string {
  if (!value) return '';
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptToken(payload: string): string {
  if (!payload) return '';
  const [ivRaw, tagRaw, dataRaw] = payload.split('.');
  if (!ivRaw || !tagRaw || !dataRaw) throw new Error('Invalid encrypted token payload');
  const decipher = createDecipheriv(
    'aes-256-gcm',
    getKey(),
    Buffer.from(ivRaw, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataRaw, 'base64url')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}