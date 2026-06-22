// Sentry server-side init. Quiet when SENTRY_DSN is not set.
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    debug: false,
    environment: process.env.VERCEL_ENV || 'development',
    ignoreErrors: [
      'NEXT_REDIRECT',           // Next.js redirect "errors" — expected
      'NEXT_NOT_FOUND',          // notFound() — expected
      'Unauthorized',            // 401s — expected for guarded routes
    ],
  });
}
