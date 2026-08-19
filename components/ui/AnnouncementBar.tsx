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
  'Free shipping above ₹2,500',
  "The Founder’s Edit is live",
  'COD available on select pincodes',
  'Authenticity card with every order',
];

const DISMISS_KEY = 'neejee.announcement.dismissed';
const DISMISS_TTL = 24 * 60 * 60 * 1000;
const BAR_CLASS = 'text-[8px] md:text-[9px] text-center py-1.5 font-ui tracking-[0.18em] uppercase border-b border-kohl/10';

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
      .then(r => (r.ok ? r.json() : { banners: [] }))
      .then(d => {
        const list: Banner[] = Array.isArray(d?.banners) ? d.banners : [];
        setBanners(list);
        setActive(0);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  useEffect(() => {
    const total = banners.length > 0 ? banners.length : FALLBACK_MESSAGES.length;
    if (total <= 1) return;
    const t = setInterval(() => setActive(a => (a + 1) % total), 6000);
    return () => clearInterval(t);
  }, [banners.length]);

  if (!loaded || dismissed) {
    return <div className={`bg-mitti text-ivory ${BAR_CLASS}`}><span>{FALLBACK_MESSAGES[0]}</span></div>;
  }

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
    setDismissed(true);
  };

  if (banners.length === 0) {
    return <div className={`bg-mitti text-ivory ${BAR_CLASS}`}><span>{FALLBACK_MESSAGES[active % FALLBACK_MESSAGES.length]}</span></div>;
  }

  const safeIndex = ((active % banners.length) + banners.length) % banners.length;
  const banner = banners[safeIndex];
  if (!banner) return <div className={`bg-mitti text-ivory ${BAR_CLASS}`}><span>{FALLBACK_MESSAGES[0]}</span></div>;

  const style = COLOR_MAP[banner.bgColor || 'mitti'] || 'bg-mitti text-ivory';

  return (
    <div className={`${style} ${BAR_CLASS} px-10 relative`}>
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-3">
        <div className="text-center flex items-center gap-2 flex-wrap justify-center">
          {banner.title && <span>{banner.title}</span>}
          {banner.subtitle && <span className="opacity-70 hidden sm:inline">· {banner.subtitle}</span>}
          {banner.ctaText && banner.ctaUrl && (
            <Link href={banner.ctaUrl} className="underline underline-offset-4 decoration-current/40 hover:decoration-current">
              {banner.ctaText} →
            </Link>
          )}
        </div>
      </div>
      <button onClick={dismiss} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-90" aria-label="Dismiss">
        <X className="w-3 h-3" strokeWidth={1.1} />
      </button>
    </div>
  );
}
