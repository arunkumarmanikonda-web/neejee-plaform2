// Client-side analytics beacon helper.
// Stores anonymous session id in sessionStorage + captures UTM params from URL on first visit (persisted to localStorage for 30 days).

const SESSION_KEY = 'neejee.sid';
const UTM_KEY = 'neejee.utm';
const UTM_TTL_DAYS = 30;

function uuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export interface UtmData {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
  referrer?: string;
  landingPage?: string;
  capturedAt: number;
}

export function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  let sid = sessionStorage.getItem(SESSION_KEY);
  if (!sid) {
    sid = uuid();
    sessionStorage.setItem(SESSION_KEY, sid);
  }
  return sid;
}

/** Capture UTM params from the current URL (if any) and persist for 30 days. */
export function captureUtm(): UtmData | null {
  if (typeof window === 'undefined') return null;
  try {
    const url = new URL(window.location.href);
    const source = url.searchParams.get('utm_source') || undefined;
    const medium = url.searchParams.get('utm_medium') || undefined;
    const campaign = url.searchParams.get('utm_campaign') || undefined;
    const content = url.searchParams.get('utm_content') || undefined;
    const term = url.searchParams.get('utm_term') || undefined;
    const existing = readUtm();
    // Only overwrite if NEW utm present (last-touch attribution)
    if (source || medium || campaign) {
      const utm: UtmData = {
        source, medium, campaign, content, term,
        referrer: document.referrer || undefined,
        landingPage: url.pathname,
        capturedAt: Date.now(),
      };
      localStorage.setItem(UTM_KEY, JSON.stringify(utm));
      return utm;
    }
    return existing;
  } catch {
    return null;
  }
}

export function readUtm(): UtmData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(UTM_KEY);
    if (!raw) return null;
    const utm = JSON.parse(raw) as UtmData;
    // Expire after 30 days
    if (Date.now() - utm.capturedAt > UTM_TTL_DAYS * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(UTM_KEY);
      return null;
    }
    return utm;
  } catch {
    return null;
  }
}

export type EventType =
  | 'PAGE_VIEW'
  | 'PRODUCT_VIEW'
  | 'ADD_TO_CART'
  | 'BEGIN_CHECKOUT'
  | 'PURCHASE'
  | 'SEARCH'
  | 'NEWSLETTER_SUBSCRIBE'
  | 'WISHLIST_ADD'
  | 'ABANDON';

export interface TrackArgs {
  type: EventType;
  path?: string;
  productId?: string;
  value?: number; // paise
}

/** Fire-and-forget event beacon. Silently fails. */
export function track(args: TrackArgs): void {
  if (typeof window === 'undefined') return;
  try {
    const sid = getSessionId();
    const utm = readUtm();
    const payload = {
      sessionId: sid,
      type: args.type,
      path: args.path ?? window.location.pathname,
      productId: args.productId,
      value: args.value,
      referrer: document.referrer || undefined,
      utmSource: utm?.source,
      utmMedium: utm?.medium,
      utmCampaign: utm?.campaign,
      device: getDevice(),
    };
    const body = JSON.stringify(payload);
    // Use sendBeacon if available, else fetch keepalive
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon('/api/analytics/event', blob);
    } else {
      fetch('/api/analytics/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // never throw from analytics
  }
}

function getDevice(): string {
  const ua = navigator.userAgent || '';
  if (/Mobi|Android|iPhone/i.test(ua)) return 'mobile';
  if (/Tablet|iPad/i.test(ua)) return 'tablet';
  return 'desktop';
}
