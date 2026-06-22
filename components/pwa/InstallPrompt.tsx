'use client';
// Soft install prompt — shows a non-intrusive banner once the browser dispatches
// the beforeinstallprompt event. Dismissable for 30 days.
import { useEffect, useState } from 'react';
import { X, Download } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'neejee.pwa.dismissed';
const DISMISS_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const dismissed = localStorage.getItem(DISMISS_KEY);
      if (dismissed && Date.now() - parseInt(dismissed) < DISMISS_TTL) return;
    } catch {}

    // Detect already-installed
    if (window.matchMedia?.('(display-mode: standalone)').matches) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice.catch(() => {});
    setVisible(false);
    setDeferred(null);
  };

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-40 bg-kohl text-ivory p-4 shadow-xl">
      <div className="flex items-start gap-3">
        <Download className="w-5 h-5 text-banarasi flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-display text-lg">Install NEEJEE</p>
          <p className="font-italic italic text-ivory/70 text-sm mt-1">
            Add NEEJEE to your home screen. Faster, quieter, always at hand.
          </p>
          <div className="flex gap-2 mt-3">
            <button onClick={install} className="bg-madder text-ivory px-4 py-2 text-xs tracking-widest hover:bg-madder/90">
              INSTALL
            </button>
            <button onClick={dismiss} className="text-ivory/60 px-4 py-2 text-xs tracking-widest hover:text-ivory">
              NOT NOW
            </button>
          </div>
        </div>
        <button onClick={dismiss} className="text-ivory/60 hover:text-ivory">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
