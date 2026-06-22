'use client';
// Site-wide analytics provider. Mount in root layout.
// - Captures UTM params on first landing (and last-touch)
// - Fires PAGE_VIEW on every route change
// - Exposes nothing; tracking is invoked imperatively via lib/analytics
import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { captureUtm, track } from '@/lib/analytics';

export function AnalyticsProvider() {
  const pathname = usePathname();
  const search = useSearchParams();

  useEffect(() => {
    // Capture UTM params if present on URL (idempotent)
    captureUtm();
    // Fire page view
    track({ type: 'PAGE_VIEW', path: pathname || '/' });
  }, [pathname, search]);

  return null;
}
