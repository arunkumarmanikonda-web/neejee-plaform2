'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Cart product shape — minimal, flexible enough for both legacy lib/data Product and DB product
export interface CartProduct {
  id: string;
  slug: string;
  name: string;
  sellingPrice: number;     // current effective price in PAISE
  mrp?: number;
  images?: string[];
  inventory?: number;
  variantId?: string | null;
  variantLabel?: string | null;
}

export type CartItem = {
  productId: string;
  variantId?: string | null;
  variantLabel?: string | null;
  product: CartProduct;
  quantity: number;
};

const GIFT_WRAP_PAISE = 15000; // ₹150

type CartState = {
  items: CartItem[];
  giftWrap: boolean;
  personalNote: string;
  couponCode: string | null;
  couponDiscount: number; // in paise, applied to subtotal
  addItem: (product: CartProduct, quantity?: number) => void;
  removeItem: (productId: string, variantId?: string | null) => void;
  updateQuantity: (productId: string, qty: number, variantId?: string | null) => void;
  clear: () => void;
  setGiftWrap: (v: boolean) => void;
  setPersonalNote: (v: string) => void;
  applyCoupon: (code: string, discountPaise: number) => void;
  removeCoupon: () => void;
  itemsSubtotal: () => number;
  giftWrapPaise: () => number;
  subtotal: () => number;
  total: () => number;
  itemCount: () => number;
};

const sameLine = (a: CartItem, productId: string, variantId?: string | null) =>
  a.productId === productId && (a.variantId || null) === (variantId || null);

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      giftWrap: false,
      personalNote: '',
      couponCode: null,
      couponDiscount: 0,

      addItem: (product, quantity = 1) =>
        set(state => {
          const existing = state.items.find(i => sameLine(i, product.id, product.variantId));
          if (existing) {
            return {
              items: state.items.map(i =>
                sameLine(i, product.id, product.variantId)
                  ? { ...i, quantity: i.quantity + quantity }
                  : i
              ),
            };
          }
          return {
            items: [
              ...state.items,
              {
                productId: product.id,
                variantId: product.variantId || null,
                variantLabel: product.variantLabel || null,
                product, quantity,
              },
            ],
          };
        }),

      removeItem: (productId, variantId) =>
        set(state => ({
          items: state.items.filter(i => !sameLine(i, productId, variantId)),
        })),

      updateQuantity: (productId, qty, variantId) =>
        set(state => ({
          items: qty <= 0
            ? state.items.filter(i => !sameLine(i, productId, variantId))
            : state.items.map(i =>
                sameLine(i, productId, variantId) ? { ...i, quantity: qty } : i
              ),
        })),

      clear: () => set({ items: [], giftWrap: false, personalNote: '', couponCode: null, couponDiscount: 0 }),

      setGiftWrap: v => set({ giftWrap: v }),
      setPersonalNote: v => set({ personalNote: v }),

      applyCoupon: (code, discountPaise) => set({ couponCode: code, couponDiscount: discountPaise }),
      removeCoupon: () => set({ couponCode: null, couponDiscount: 0 }),

      itemsSubtotal: () =>
        get().items.reduce((sum, i) => sum + (i.product.sellingPrice || 0) * i.quantity, 0),

      giftWrapPaise: () => (get().giftWrap ? GIFT_WRAP_PAISE : 0),

      subtotal: () => get().itemsSubtotal() + get().giftWrapPaise(),

      total: () => Math.max(0, get().subtotal() - (get().couponDiscount || 0)),

      itemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    { name: 'neejee-cart-v2' }
  )
);
