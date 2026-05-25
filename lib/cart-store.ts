'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Product } from './data';

export type CartItem = {
  productId: string;
  product: Product;
  quantity: number;
  variant?: string;
};

type CartState = {
  items: CartItem[];
  giftWrap: boolean;
  personalNote: string;
  addItem: (product: Product, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, qty: number) => void;
  clear: () => void;
  setGiftWrap: (v: boolean) => void;
  setPersonalNote: (v: string) => void;
  subtotal: () => number;
  itemCount: () => number;
};

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      giftWrap: false,
      personalNote: '',
      addItem: (product, quantity = 1) =>
        set(state => {
          const existing = state.items.find(i => i.productId === product.id);
          if (existing) {
            return {
              items: state.items.map(i =>
                i.productId === product.id ? { ...i, quantity: i.quantity + quantity } : i
              ),
            };
          }
          return { items: [...state.items, { productId: product.id, product, quantity }] };
        }),
      removeItem: productId =>
        set(state => ({ items: state.items.filter(i => i.productId !== productId) })),
      updateQuantity: (productId, qty) =>
        set(state => ({
          items: qty <= 0
            ? state.items.filter(i => i.productId !== productId)
            : state.items.map(i => (i.productId === productId ? { ...i, quantity: qty } : i)),
        })),
      clear: () => set({ items: [], giftWrap: false, personalNote: '' }),
      setGiftWrap: v => set({ giftWrap: v }),
      setPersonalNote: v => set({ personalNote: v }),
      subtotal: () => {
        const itemsTotal = get().items.reduce((sum, i) => sum + i.product.sellingPrice * i.quantity, 0);
        const wrap = get().giftWrap ? 15000 : 0;
        return itemsTotal + wrap;
      },
      itemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    { name: 'neejee-cart' }
  )
);
