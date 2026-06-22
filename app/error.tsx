'use client';
import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
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
    <main className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <h1 className="font-display text-4xl text-madder mb-3">A quiet moment.</h1>
        <p className="italic text-mitti mb-6">
          We noted what happened. Please try again, or return home.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-4 py-2 bg-kohl text-ivory text-xs uppercase tracking-widest hover:bg-madder"
          >
            Try again
          </button>
          <Link
            href="/"
            className="px-4 py-2 border border-mitti/40 text-kohl text-xs uppercase tracking-widest hover:bg-mitti/10"
          >
            Return home
          </Link>
        </div>
        {error.digest && (
          <p className="mt-8 text-[10px] font-mono text-mitti/50">Ref: {error.digest}</p>
        )}
      </div>
    </main>
  );
}
