'use client';
// Currency context provider — auto-detects from country header on first visit,
// allows manual override (persisted in localStorage).
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { CURRENCIES, DEFAULT_CURRENCY, formatCurrency as formatPaise, paiseToDisplay } from '@/lib/currency';

const STORAGE_KEY = 'neejee.currency';

interface CurrencyContextValue {
  currency: string;
  setCurrency: (code: string) => void;
  format: (paise: number) => string;
  toDisplay: (paise: number) => number;
  symbol: string;
}

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: DEFAULT_CURRENCY,
  setCurrency: () => {},
  format: (p: number) => formatPaise(p, DEFAULT_CURRENCY),
  toDisplay: (p: number) => paiseToDisplay(p, DEFAULT_CURRENCY),
  symbol: CURRENCIES[DEFAULT_CURRENCY].symbol,
});

export function CurrencyProvider({ children, initialCurrency }: { children: ReactNode; initialCurrency?: string }) {
  const [currency, setCurrencyState] = useState(initialCurrency || DEFAULT_CURRENCY);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && CURRENCIES[stored]) setCurrencyState(stored);
    } catch {}
  }, []);

  const setCurrency = (code: string) => {
    if (!CURRENCIES[code]) return;
    setCurrencyState(code);
    try { localStorage.setItem(STORAGE_KEY, code); } catch {}
  };

  const cfg = CURRENCIES[currency] || CURRENCIES[DEFAULT_CURRENCY];

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        setCurrency,
        symbol: cfg.symbol,
        format: (p: number) => formatPaise(p, currency),
        toDisplay: (p: number) => paiseToDisplay(p, currency),
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
