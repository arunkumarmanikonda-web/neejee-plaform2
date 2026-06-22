'use client';
// Announcement bar — fetches active "announcement" banners from CMS and rotates them.
// Falls back to default messages if no banners are configured.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';

interface Banner {
  id: string;
  title: string | null;
  subtitle: string | null;
  ctaText: string | null;
  ctaUrl: string | null;
  textColor: string | null;
  bgColor: string | null;
}

const COLOR_MAP: Record<string, string> = {
  kohl: 'bg-kohl text-ivory',
  mitti: 'bg-mitti text-ivory',
  ivory: 'bg-ivory text-kohl',
  madder: 'bg-madder text-ivory',
  beige: 'bg-beige text-kohl',
  haldi: 'bg-haldi text-kohl',
  neem: 'bg-neem text-ivory',
  banarasi: 'bg-banarasi text-kohl',
};

const FALLBACK_MESSAGES = [
  'FREE SHIPPING ABOVE ₹2,500',
  "THE FOUNDER'S EDIT IS LIVE",
  'COD AVAILABLE ON SELECT PINCODES',
  'AUTHENTICITY CARD WITH EVERY ORDER',
];

const DISMISS_KEY = 'neejee.announcement.dismissed';
const DISMISS_TTL = 24 * 60 * 60 * 1000; // 24h

export function AnnouncementBar() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [active, setActive] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      if (raw) {
        const ts = parseInt(raw);
        if (Date.now() - ts < DISMISS_TTL) {
          setDismissed(true);
          setLoaded(true);
          return;
        }
      }
    } catch {}

    fetch('/api/banners?position=announcement')
      .then(r => r.json())
      .then(d => { setBanners(d.banners || []); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, []);

  // Auto-rotate every 5s
  useEffect(() => {
    const total = banners.length > 0 ? banners.length : FALLBACK_MESSAGES.length;
    if (total <= 1) return;
    const t = setInterval(() => {
      setActive(a => (a + 1) % total);
    }, 5000);
    return () => clearInterval(t);
  }, [banners.length]);

  if (!loaded || dismissed) {
    // SSR-friendly fallback to keep layout stable
    return (
      <div className="bg-mitti text-ivory text-xs tracking-widest text-center py-2 font-ui">
        <span>{FALLBACK_MESSAGES[0]}</span>
      </div>
    );
  }

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
    setDismissed(true);
  };

  // No CMS banners — show fallback
  if (banners.length === 0) {
    return (
      <div className="bg-mitti text-ivory text-xs tracking-widest text-center py-2 font-ui">
        <span>{FALLBACK_MESSAGES[active % FALLBACK_MESSAGES.length]}</span>
      </div>
    );
  }

  const b = banners[active];
  const style = COLOR_MAP[b.bgColor || 'mitti'] || 'bg-mitti text-ivory';

  return (
    <div className={`${style} text-xs tracking-widest py-2 px-4 font-ui relative`}>
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-3">
        <div className="text-center flex items-center gap-3 flex-wrap justify-center">
          {b.title && <span>{b.title}</span>}
          {b.subtitle && <span className="opacity-80 hidden sm:inline">· {b.subtitle}</span>}
          {b.ctaText && b.ctaUrl && (
            <Link href={b.ctaUrl} className="underline underline-offset-4 hover:no-underline">
              {b.ctaText} →
            </Link>
          )}
        </div>
      </div>
      <button
        onClick={dismiss}
        className="absolute right-3 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100"
        aria-label="Dismiss"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
