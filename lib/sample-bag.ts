'use client';

import { useSyncExternalStore } from 'react';
import { studies } from './shop-studies';
import { clearDressing, lineKey } from './outfit-closet';

export const sampleShopping = process.env.NEXT_PUBLIC_NEEJEE_SAMPLE_SHOP === '1';
const storageKey = 'neejee.shop-preview.bag.v1';
const changed = 'neejee:sample-bag';
const empty: Record<string, number> = {};
let lastRead: string | null = null;
let cached = empty;

function read() {
  if (!sampleShopping || typeof window === 'undefined') return empty;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (raw !== lastRead) {
      const values = JSON.parse(raw || '{}');
      cached = Object.fromEntries(studies.flatMap(s => Number.isInteger(values?.[s.id]) && values[s.id] > 0 ? [[s.id, Math.min(9, values[s.id])]] : []));
      lastRead = raw;
    }
  } catch {}
  return cached;
}
function subscribe(listener: () => void) {
  window.addEventListener(changed, listener);
  window.addEventListener('storage', listener);
  return () => {
    window.removeEventListener(changed, listener);
    window.removeEventListener('storage', listener);
  };
}
export function useSampleBag() {
  return useSyncExternalStore(subscribe, read, () => empty);
}
function write(bag: Record<string, number>) {
  cached = bag;
  try {
    const raw = JSON.stringify(bag);
    window.localStorage.setItem(storageKey, raw);
    lastRead = raw;
  } catch {}
  window.dispatchEvent(new Event(changed));
}
export function changeSample(id: string, delta: number) {
  if (!sampleShopping || !studies.some(s => s.id === id)) return;
  const bag = {...read()};
  const qty = Math.max(0, Math.min(9, (bag[id] || 0) + delta));
  if (qty) bag[id] = qty;
  else {
    delete bag[id];
    clearDressing(lineKey('look-' + id, 'study-' + id));
  }
  write(bag);
}
export function emptySampleBag() {
  for (const id of Object.keys(read())) clearDressing(lineKey('look-' + id, 'study-' + id));
  write({});
}
