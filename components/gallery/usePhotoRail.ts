'use client';

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import './photo-rail.css';

/** Touch and trackpad use native scrolling. The controls target the same snap points. */
export function usePhotoRail(count: number, requested = 0) {
  const track = useRef<HTMLDivElement>(null);
  const keyboardFocus = useRef<number | null>(null);
  const positioned = useRef(false);
  const target = useRef<number | null>(null);
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const [active, setActive] = useState(0);
  const go = useCallback((index: number) => {
    const el = track.current;
    if (!el || !count || !el.clientWidth) return;
    const next = Math.max(0, Math.min(count - 1, index));
    const left = next * el.clientWidth;
    target.current = Math.abs(left - el.scrollLeft) > 1 ? next : null;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({ left, behavior: reduce ? 'instant' : 'smooth' });
  }, [count]);
  useEffect(() => {
    const el = track.current;
    if (!el || !el.clientWidth) return;
    if (!positioned.current) {
      positioned.current = true;
      const first = Math.max(0, Math.min(count - 1, requested));
      el.scrollTo({left:first * el.clientWidth, behavior:'instant'});
      setActive(first);
    } else {
      go(requested);
    }
  }, [requested, count, go]);
  useEffect(() => {
    if (keyboardFocus.current === null) return;
    const item = track.current?.children[active];
    const action = item?.querySelectorAll<HTMLElement>('a[href],button')[keyboardFocus.current];
    if (action) action.focus({ preventScroll:true });
    keyboardFocus.current = null;
  }, [active]);
  const step = (amount: number) => go((target.current ?? active) + amount);
  function sync() {
    const el = track.current;
    if (!el || !el.clientWidth) return;
    const offset = el.scrollLeft / el.clientWidth;
    setActive(Math.max(0, Math.min(count - 1, Math.round(offset))));
    if (target.current !== null && Math.abs(offset - target.current) * el.clientWidth < 1) target.current = null;
  }
  function start(event: PointerEvent<HTMLDivElement>) {
    target.current = null;
    keyboardFocus.current = null;
    suppressClick.current = false;
    if (event.pointerType === 'mouse' && event.button === 0 && count > 1) {
      drag.current = { x: event.clientX, left: event.currentTarget.scrollLeft, moved: false };
    }
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    const origin = drag.current;
    if (!origin || !event.buttons) return;
    const distance = origin.x - event.clientX;
    if (!origin.moved && Math.abs(distance) < 6) return;
    const el = event.currentTarget;
    if (!origin.moved) {
      origin.moved = true;
      el.dataset.dragging = 'true';
      el.setPointerCapture(event.pointerId);
    }
    el.scrollLeft = origin.left + distance;
  }
  function end(event: PointerEvent<HTMLDivElement>) {
    const el = event.currentTarget;
    const origin = drag.current;
    drag.current = null;
    if (!origin?.moved) return;
    const offset = el.scrollLeft / el.clientWidth;
    const startIndex = Math.round(origin.left / el.clientWidth);
    const distance = origin.x - event.clientX;
    const next = Math.round(offset);
    delete el.dataset.dragging;
    suppressClick.current = true;
    if (el.hasPointerCapture(event.pointerId)) el.releasePointerCapture(event.pointerId);
    go(next === startIndex && Math.abs(distance) > el.clientWidth * .14 ? startIndex + Math.sign(distance) : next);
  }
  function onKeyDown(event: KeyboardEvent) {
    if (event.altKey || event.ctrlKey || event.metaKey || count < 2) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const focused = event.target as HTMLElement;
    const slide = focused.closest('[data-slide]');
    const index = slide ? [...slide.querySelectorAll('a[href],button')].indexOf(focused) : -1;
    keyboardFocus.current = index >= 0 ? index : null;
    step(event.key === 'ArrowLeft' ? -1 : 1);
  }
  return { active, go, step, onKeyDown, props: {
    ref: track, onScroll: sync, onPointerDown: start, onPointerMove: move, onPointerUp: end, onPointerCancel: end,
    onWheel: () => { target.current = null; },
    onClickCapture: (event: React.MouseEvent) => {
      if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; }
    },
    onDragStart: (event: React.DragEvent) => event.preventDefault(),
  }};
}
