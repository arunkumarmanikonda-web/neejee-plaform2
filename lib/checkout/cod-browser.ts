const STORAGE_KEY = 'neejee_cod_checkout_v1';
export type BrowserAttempt = { key: string; bag: string };

export function bagIdentity(items: { productId: string; variantId?: string | null; quantity: number }[]) {
  return JSON.stringify(items.map(item => JSON.stringify([item.productId, item.variantId || '', item.quantity])).sort());
}

export function readBrowserAttempt(): BrowserAttempt | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
    return value && typeof value.key === 'string' && typeof value.bag === 'string' ? value : null;
  } catch { return null; }
}

export function newBrowserAttempt(bag: string): BrowserAttempt {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
  const attempt = { key: [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-'), bag };
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(attempt)); } catch { /* The caller keeps an in-memory copy. */ }
  return attempt;
}

export function clearBrowserAttempt() {
  try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* Storage can be unavailable. */ }
}

export async function recoverCodOrder(attempt: BrowserAttempt, signal?: AbortSignal): Promise<string | null> {
  const res = await fetch('/api/checkout/cod-receipt', {
    credentials: 'same-origin', cache: 'no-store', headers: { 'Idempotency-Key': attempt.key }, signal,
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.found && typeof data.orderNumber === 'string' ? data.orderNumber : null;
}
