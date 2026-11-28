'use client';

import { useEffect, useRef, useState } from 'react';

export function usePhotoPlayback(count: number, active: number, select: (index: number) => void) {
  const region = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(true);
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [tabVisible, setTabVisible] = useState(false);

  useEffect(() => {
    const el = region.current;
    if (!el || count < 2) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncMotion = () => setReduced(motion.matches);
    const syncTab = () => setTabVisible(!document.hidden);
    syncMotion();
    syncTab();
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.15 });
    observer.observe(el);
    motion.addEventListener('change', syncMotion);
    document.addEventListener('visibilitychange', syncTab);
    return () => {
      observer.disconnect();
      motion.removeEventListener('change', syncMotion);
      document.removeEventListener('visibilitychange', syncTab);
    };
  }, [count]);

  useEffect(() => {
    if (count < 2 || reduced || paused || hovered || !visible || !tabVisible) return;
    const timer = window.setTimeout(() => select((active + 1) % count), 4800);
    return () => clearTimeout(timer);
  }, [count, active, select, reduced, paused, hovered, visible, tabVisible]);

  return {
    controls: count > 1 && !reduced, paused, toggle: () => setPaused(value => !value),
    regionProps: {
      ref: region, onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false),
      onFocusCapture: (event: React.FocusEvent<HTMLDivElement>) => {
        if (!(event.target as Element).closest('[data-playback]')) setPaused(true);
      },
      onPointerDownCapture: (event: React.PointerEvent<HTMLDivElement>) => {
        if (!(event.target as Element).closest('[data-playback]')) setPaused(true);
      },
    },
  };
}
