import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// All prices stored in paise. ₹1 = 100 paise.
export const formatPrice = (paise: number): string =>
  '₹' + (paise / 100).toLocaleString('en-IN');

export const formatPriceShort = (paise: number): string => {
  const rupees = paise / 100;
  if (rupees >= 100000) return '₹' + (rupees / 100000).toFixed(1) + 'L';
  if (rupees >= 1000) return '₹' + (rupees / 1000).toFixed(1) + 'k';
  return '₹' + rupees.toLocaleString('en-IN');
};

export const calculateGST = (paise: number, rate: number = 5): number =>
  Math.round((paise * rate) / (100 + rate));

export const formatDate = (date: Date | string): string =>
  new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

export const slugify = (text: string): string =>
  text.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');

export const generateOrderNumber = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return 'NEE-' + id;
};

export const calculateShipping = (subtotalPaise: number, pincode?: string): number => {
  if (subtotalPaise >= 250000) return 0;
  // Metro pincodes (560xxx, 110xxx, 400xxx, 700xxx, 600xxx) — ₹100
  if (pincode && /^(56|11|40|70|60)/.test(pincode)) return 10000;
  // Tier 2 — ₹150
  return 15000;
};

export const isValidPincode = (pincode: string): boolean => /^[1-9][0-9]{5}$/.test(pincode);
export const isValidPhone = (phone: string): boolean => /^[6-9]\d{9}$/.test(phone.replace(/\s|-/g, ''));
export const isValidEmail = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
export const isValidGSTIN = (gstin: string): boolean =>
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin);
