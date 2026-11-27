/** Legacy manual jobs optionally accept their existing query key. */
export function cronAuthorized(request: Request, allowLegacyKey = false, secret = process.env.CRON_SECRET): boolean {
  if (!secret?.trim()) return false;
  const header = request.headers.get('authorization') || '';
  if (header === 'Bearer ' + secret) return true;
  return allowLegacyKey && new URL(request.url).searchParams.get('key') === secret;
}
