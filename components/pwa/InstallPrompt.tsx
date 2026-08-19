'use client';
// Deliberately late, discreet install prompt. The storefront should be experienced
// before the browser asks for a home-screen commitment.
import { useEffect, useState } from 'react';
import { X, Download } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'neejee.pwa.dismissed';
const SESSION_KEY = 'neejee.pwa.seen';
const DISMISS_TTL = 30 * 24 * 60 * 60 * 1000;
const MIN_ENGAGEMENT_MS = 90 * 1000;
const MIN_SCROLL_RATIO = 0.55;

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [timeReady, setTimeReady] = useState(false);
  const [scrollReady, setScrollReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const dismissedAt = localStorage.getItem(DISMISS_KEY);
      if (dismissedAt && Date.now() - parseInt(dismissedAt, 10) < DISMISS_TTL) {
        setDismissed(true);
        return;
      }
      if (sessionStorage.getItem(SESSION_KEY)) {
        setDismissed(true);
        return;
      }
    } catch {}

    if (window.matchMedia?.('(display-mode: standalone)').matches) {
      setDismissed(true);
      return;
    }

    const handler = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };

    const timer = window.setTimeout(() => setTimeReady(true), MIN_ENGAGEMENT_MS);

    const onScroll = () => {
      const doc = document.documentElement;
      const scrollable = Math.max(1, doc.scrollHeight - window.innerHeight);
      if (window.scrollY / scrollable >= MIN_SCROLL_RATIO) setScrollReady(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  const hideForSession = () => {
    try { sessionStorage.setItem(SESSION_KEY, '1'); } catch {}
    setDismissed(true);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice.catch(() => {});
    hideForSession();
    setDeferred(null);
  };

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
      sessionStorage.setItem(SESSION_KEY, '1');
    } catch {}
    setDismissed(true);
  };

  if (!deferred || dismissed || !timeReady || !scrollReady) return null;

  return (
    <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:w-[292px] z-40 bg-[#f7f1e7] text-kohl border border-mitti/20 px-4 py-3 shadow-[0_14px_35px_rgba(26,22,19,0.10)]">
      <div className="flex items-start gap-3">
        <Download className="w-4 h-4 text-madder flex-shrink-0 mt-0.5" strokeWidth={1.25} />
        <div className="flex-1 min-w-0">
          <p className="font-ui text-[8px] tracking-[0.18em] uppercase text-madder">NEEJEE AT HAND</p>
          <p className="font-display text-[15px] mt-1">Add NEEJEE to your home screen.</p>
          <div className="flex items-center gap-4 mt-3">
            <button onClick={install} className="font-ui text-[8px] tracking-[0.18em] text-madder uppercase hover:underline underline-offset-4">INSTALL</button>
            <button onClick={hideForSession} className="font-ui text-[8px] tracking-[0.16em] text-mitti uppercase">LATER</button>
          </div>
        </div>
        <button onClick={dismiss} className="text-mitti/55 hover:text-kohl" aria-label="Dismiss install prompt">
          <X className="w-3.5 h-3.5" strokeWidth={1.2} />
        </button>
      </div>
    </div>
  );
}
