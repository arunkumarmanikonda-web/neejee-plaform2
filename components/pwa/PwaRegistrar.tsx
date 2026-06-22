'use client';
// Registers the service worker on mount (production only).
// Silently no-ops in dev to keep HMR clean.
import { useEffect } from 'react';

export function PwaRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .catch((e) => {
        // Silent — PWA is progressive enhancement
        console.warn('[pwa] SW register failed:', e?.message || e);
      });
  }, []);

  return null;
}
