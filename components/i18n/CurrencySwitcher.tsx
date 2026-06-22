'use client';
import { useCurrency } from './CurrencyProvider';
import { availableCurrencies } from '@/lib/currency';
import { Globe } from 'lucide-react';

export function CurrencySwitcher({ compact = false }: { compact?: boolean }) {
  const { currency, setCurrency } = useCurrency();
  const options = availableCurrencies();

  return (
    <div className={`inline-flex items-center gap-1.5 ${compact ? 'text-[10px]' : 'text-xs'} tracking-widest`}>
      {!compact && <Globe className="w-3 h-3 opacity-60" />}
      <select
        value={currency}
        onChange={(e) => setCurrency(e.target.value)}
        className="bg-transparent border-none outline-none cursor-pointer hover:text-madder appearance-none"
        aria-label="Select currency"
      >
        {options.map((c) => (
          <option key={c.code} value={c.code}>
            {c.code}
          </option>
        ))}
      </select>
    </div>
  );
}
