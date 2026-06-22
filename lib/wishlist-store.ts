'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type WishlistState = {
  ids: string[]; // product ids
  hydrated: boolean;
  has: (productId: string) => boolean;
  toggle: (productId: string, productSlug?: string) => Promise<void>;
  refreshFromServer: () => Promise<void>;
  clear: () => void;
};

export const useWishlist = create<WishlistState>()(
  persist(
    (set, get) => ({
      ids: [],
      hydrated: false,
      has: (id: string) => get().ids.includes(id),
      toggle: async (productId: string, productSlug?: string) => {
        // Optimistic UI
        set(state => ({
          ids: state.ids.includes(productId)
            ? state.ids.filter(i => i !== productId)
            : [...state.ids, productId],
        }));
        // Try to persist server-side (if user is logged in)
        try {
          const r = await fetch('/api/wishlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId, productSlug }),
          });
          if (r.status === 401) {
            // Not logged in — keep local only, but inform via console
            // (could trigger a sign-in modal)
          } else if (!r.ok) {
            // Revert on error
            const d = await r.json().catch(() => ({}));
            console.warn('[wishlist] toggle failed', d?.error);
          } else {
            const d = await r.json();
            // Sync local state with server truth
            set(state => ({
              ids: d.inWishlist
                ? Array.from(new Set([...state.ids, productId]))
                : state.ids.filter(i => i !== productId),
            }));
          }
        } catch (e) { /* ignore network */ }
      },
      refreshFromServer: async () => {
        try {
          const r = await fetch('/api/wishlist');
          const d = await r.json();
          if (d?.loggedIn && Array.isArray(d.productIds)) {
            set({ ids: d.productIds, hydrated: true });
          } else {
            set({ hydrated: true });
          }
        } catch { set({ hydrated: true }); }
      },
      clear: () => set({ ids: [] }),
    }),
    { name: 'neejee-wishlist' }
  )
);
