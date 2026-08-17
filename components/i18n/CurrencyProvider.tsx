'use client';
// Currency context provider.
// Starts in INR so the root layout remains cacheable, then performs one
// lightweight geo lookup on first visit unless the customer has chosen a
// currency explicitly. Manual choice is persisted in localStorage.
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

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState(DEFAULT_CURRENCY);

  useEffect(() => {
    let cancelled = false;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && CURRENCIES[stored]) {
        setCurrencyState(stored);
        return () => { cancelled = true; };
      }
    } catch {}

    fetch('/api/geo/currency', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const detected = data?.currency;
        if (!cancelled && typeof detected === 'string' && CURRENCIES[detected]) {
          setCurrencyState(detected);
        }
      })
      .catch(() => {});

    return () => { cancelled = true; };
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
