// Sentry client-side init. Quiet when SENTRY_DSN is not set.
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,           // 10% of requests traced (cost-controlled)
    replaysSessionSampleRate: 0,     // no session replay by default
    replaysOnErrorSampleRate: 0.5,   // half of errors get a replay snippet
    debug: false,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV || 'development',
    // Ignore noisy/expected errors
    ignoreErrors: [
      'Network request failed',
      'Failed to fetch',
      'NetworkError',
      'AbortError',
      'ResizeObserver loop',
    ],
  });
}
