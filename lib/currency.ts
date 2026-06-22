// Multi-currency display layer.
// Prices are stored in INR paise. This module converts to display currencies.
//
// Conversion rates are static defaults; for production accuracy, fetch from
// an FX API and update CURRENCY_RATES on a schedule.

export interface CurrencyConfig {
  code: string;       // ISO 4217
  symbol: string;
  locale: string;
  // How many INR paise = 1 unit of this currency. Updated periodically.
  paisePerUnit: number;
  // Decimals to display
  decimals: number;
  // Country codes that default to this currency
  countries: string[];
}

export const CURRENCIES: Record<string, CurrencyConfig> = {
  INR: { code: 'INR', symbol: '₹',  locale: 'en-IN', paisePerUnit: 100,    decimals: 0, countries: ['IN', 'NP', 'BT'] },
  USD: { code: 'USD', symbol: '$',  locale: 'en-US', paisePerUnit: 8400,   decimals: 2, countries: ['US', 'EC', 'SV'] },
  GBP: { code: 'GBP', symbol: '£',  locale: 'en-GB', paisePerUnit: 10600,  decimals: 2, countries: ['GB'] },
  EUR: { code: 'EUR', symbol: '€',  locale: 'en-IE', paisePerUnit: 9100,   decimals: 2, countries: ['DE', 'FR', 'IE', 'IT', 'ES', 'NL', 'BE', 'PT', 'AT', 'GR', 'FI'] },
  AED: { code: 'AED', symbol: 'AED', locale: 'en-AE', paisePerUnit: 2300,   decimals: 2, countries: ['AE'] },
  SGD: { code: 'SGD', symbol: 'S$', locale: 'en-SG', paisePerUnit: 6300,   decimals: 2, countries: ['SG'] },
  CAD: { code: 'CAD', symbol: 'C$', locale: 'en-CA', paisePerUnit: 6100,   decimals: 2, countries: ['CA'] },
  AUD: { code: 'AUD', symbol: 'A$', locale: 'en-AU', paisePerUnit: 5500,   decimals: 2, countries: ['AU'] },
};

export const DEFAULT_CURRENCY = 'INR';

export function currencyForCountry(country?: string | null): string {
  if (!country) return DEFAULT_CURRENCY;
  const upper = country.toUpperCase();
  for (const [code, cfg] of Object.entries(CURRENCIES)) {
    if (cfg.countries.includes(upper)) return code;
  }
  return DEFAULT_CURRENCY;
}

/** Convert paise (INR base) to the display amount of the target currency. */
export function paiseToDisplay(paise: number, currency: string): number {
  const cfg = CURRENCIES[currency] || CURRENCIES[DEFAULT_CURRENCY];
  return paise / cfg.paisePerUnit;
}

/** Pretty-format a paise value into a localised currency string. */
export function formatCurrency(paise: number, currency: string = DEFAULT_CURRENCY): string {
  const cfg = CURRENCIES[currency] || CURRENCIES[DEFAULT_CURRENCY];
  const value = paiseToDisplay(paise, currency);
  return new Intl.NumberFormat(cfg.locale, {
    style: 'currency',
    currency: cfg.code,
    minimumFractionDigits: cfg.decimals,
    maximumFractionDigits: cfg.decimals,
  }).format(value);
}

/** List of currencies a user can switch to manually. */
export function availableCurrencies(): { code: string; symbol: string; label: string }[] {
  return Object.values(CURRENCIES).map(c => ({
    code: c.code,
    symbol: c.symbol,
    label: `${c.code} (${c.symbol})`,
  }));
}
