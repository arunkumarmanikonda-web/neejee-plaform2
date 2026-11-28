export function storeOrigin(): string {
  const origin = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://www.neejee.com';
  return new URL(origin).origin;
}
