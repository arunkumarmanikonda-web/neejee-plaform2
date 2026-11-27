import { timingSafeEqual } from 'node:crypto';

export function cronAuthorized(request: Request, secret = process.env.CRON_SECRET): boolean {
  if (!secret?.trim()) return false;
  const actual = Buffer.from(request.headers.get('authorization') || '');
  const expected = Buffer.from('Bearer ' + secret);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
