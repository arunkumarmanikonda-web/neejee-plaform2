'use client';
// Global error boundary — catches any uncaught error in the app shell.
// Reports to Sentry if configured, shows a brand-styled fallback.
import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en-IN">
      <body style={{ fontFamily: 'Georgia, serif', background: '#F4EFE6', color: '#1A1613', margin: 0 }}>
        <div style={{ maxWidth: 560, margin: '20vh auto', padding: '0 2rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '3rem', fontWeight: 400, color: '#8B2E2A', marginBottom: '1rem' }}>
            Something fell quiet.
          </h1>
          <p style={{ fontStyle: 'italic', color: '#6B5D4F', marginBottom: '2rem' }}>
            We&apos;ve noted what happened and we&apos;re looking into it. Please try again, or return home.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button
              onClick={reset}
              style={{
                background: '#1A1613',
                color: '#F4EFE6',
                border: 'none',
                padding: '0.75rem 1.5rem',
                fontSize: '0.75rem',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
            <Link
              href="/"
              style={{
                color: '#1A1613',
                border: '1px solid #6B5D4F',
                padding: '0.75rem 1.5rem',
                fontSize: '0.75rem',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                textDecoration: 'none',
              }}
            >
              Return home
            </Link>
          </div>
          {error.digest && (
            <p style={{ marginTop: '3rem', fontSize: '0.75rem', color: '#999', fontFamily: 'monospace' }}>
              Ref: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
