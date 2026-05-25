'use client';
import { useState, useEffect } from 'react';

const ANNOUNCEMENTS = [
  'FREE SHIPPING ABOVE ₹2,500',
  'THE FOUNDER\'S EDIT IS LIVE',
  'COD AVAILABLE ON SELECT PINCODES',
  'AUTHENTICITY CARD WITH EVERY ORDER',
];

export function AnnouncementBar() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI(x => (x + 1) % ANNOUNCEMENTS.length), 4000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="bg-mitti text-ivory text-xs tracking-widest text-center py-2 font-ui">
      <span className="transition-opacity">{ANNOUNCEMENTS[i]}</span>
    </div>
  );
}
