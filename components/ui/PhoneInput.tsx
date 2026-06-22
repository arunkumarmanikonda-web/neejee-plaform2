'use client';
// International phone input with country-code selector.
// Stores the full E.164-style number (e.g. +919876543210) in the parent state.
import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Search } from 'lucide-react';

interface Country {
  code: string;   // ISO-2 (IN, US, GB, AE …)
  name: string;
  dial: string;   // +91
  flag: string;   // 🇮🇳 emoji
}

// Curated list — India default, then top markets, then alphabetical
// (extend as needed; this covers >95% of typical e-commerce)
export const COUNTRIES: Country[] = [
  { code: 'IN', name: 'India', dial: '+91', flag: '🇮🇳' },
  { code: 'US', name: 'United States', dial: '+1', flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', dial: '+44', flag: '🇬🇧' },
  { code: 'AE', name: 'United Arab Emirates', dial: '+971', flag: '🇦🇪' },
  { code: 'SG', name: 'Singapore', dial: '+65', flag: '🇸🇬' },
  { code: 'CA', name: 'Canada', dial: '+1', flag: '🇨🇦' },
  { code: 'AU', name: 'Australia', dial: '+61', flag: '🇦🇺' },
  { code: 'NZ', name: 'New Zealand', dial: '+64', flag: '🇳🇿' },
  { code: 'DE', name: 'Germany', dial: '+49', flag: '🇩🇪' },
  { code: 'FR', name: 'France', dial: '+33', flag: '🇫🇷' },
  { code: 'IT', name: 'Italy', dial: '+39', flag: '🇮🇹' },
  { code: 'ES', name: 'Spain', dial: '+34', flag: '🇪🇸' },
  { code: 'NL', name: 'Netherlands', dial: '+31', flag: '🇳🇱' },
  { code: 'CH', name: 'Switzerland', dial: '+41', flag: '🇨🇭' },
  { code: 'SE', name: 'Sweden', dial: '+46', flag: '🇸🇪' },
  { code: 'NO', name: 'Norway', dial: '+47', flag: '🇳🇴' },
  { code: 'DK', name: 'Denmark', dial: '+45', flag: '🇩🇰' },
  { code: 'FI', name: 'Finland', dial: '+358', flag: '🇫🇮' },
  { code: 'IE', name: 'Ireland', dial: '+353', flag: '🇮🇪' },
  { code: 'PT', name: 'Portugal', dial: '+351', flag: '🇵🇹' },
  { code: 'BE', name: 'Belgium', dial: '+32', flag: '🇧🇪' },
  { code: 'AT', name: 'Austria', dial: '+43', flag: '🇦🇹' },
  { code: 'JP', name: 'Japan', dial: '+81', flag: '🇯🇵' },
  { code: 'KR', name: 'South Korea', dial: '+82', flag: '🇰🇷' },
  { code: 'CN', name: 'China', dial: '+86', flag: '🇨🇳' },
  { code: 'HK', name: 'Hong Kong', dial: '+852', flag: '🇭🇰' },
  { code: 'MY', name: 'Malaysia', dial: '+60', flag: '🇲🇾' },
  { code: 'TH', name: 'Thailand', dial: '+66', flag: '🇹🇭' },
  { code: 'ID', name: 'Indonesia', dial: '+62', flag: '🇮🇩' },
  { code: 'PH', name: 'Philippines', dial: '+63', flag: '🇵🇭' },
  { code: 'VN', name: 'Vietnam', dial: '+84', flag: '🇻🇳' },
  { code: 'BD', name: 'Bangladesh', dial: '+880', flag: '🇧🇩' },
  { code: 'PK', name: 'Pakistan', dial: '+92', flag: '🇵🇰' },
  { code: 'LK', name: 'Sri Lanka', dial: '+94', flag: '🇱🇰' },
  { code: 'NP', name: 'Nepal', dial: '+977', flag: '🇳🇵' },
  { code: 'BT', name: 'Bhutan', dial: '+975', flag: '🇧🇹' },
  { code: 'MV', name: 'Maldives', dial: '+960', flag: '🇲🇻' },
  { code: 'SA', name: 'Saudi Arabia', dial: '+966', flag: '🇸🇦' },
  { code: 'QA', name: 'Qatar', dial: '+974', flag: '🇶🇦' },
  { code: 'KW', name: 'Kuwait', dial: '+965', flag: '🇰🇼' },
  { code: 'OM', name: 'Oman', dial: '+968', flag: '🇴🇲' },
  { code: 'BH', name: 'Bahrain', dial: '+973', flag: '🇧🇭' },
  { code: 'JO', name: 'Jordan', dial: '+962', flag: '🇯🇴' },
  { code: 'IL', name: 'Israel', dial: '+972', flag: '🇮🇱' },
  { code: 'TR', name: 'Turkey', dial: '+90', flag: '🇹🇷' },
  { code: 'EG', name: 'Egypt', dial: '+20', flag: '🇪🇬' },
  { code: 'ZA', name: 'South Africa', dial: '+27', flag: '🇿🇦' },
  { code: 'KE', name: 'Kenya', dial: '+254', flag: '🇰🇪' },
  { code: 'NG', name: 'Nigeria', dial: '+234', flag: '🇳🇬' },
  { code: 'BR', name: 'Brazil', dial: '+55', flag: '🇧🇷' },
  { code: 'MX', name: 'Mexico', dial: '+52', flag: '🇲🇽' },
  { code: 'AR', name: 'Argentina', dial: '+54', flag: '🇦🇷' },
  { code: 'CL', name: 'Chile', dial: '+56', flag: '🇨🇱' },
  { code: 'CO', name: 'Colombia', dial: '+57', flag: '🇨🇴' },
  { code: 'RU', name: 'Russia', dial: '+7', flag: '🇷🇺' },
  { code: 'PL', name: 'Poland', dial: '+48', flag: '🇵🇱' },
];

interface Props {
  value: string;            // full number including dial code (e.g. +919876543210) or empty
  onChange: (full: string) => void;
  required?: boolean;
  placeholder?: string;
  className?: string;
  defaultCountry?: string;  // ISO-2 default selection
}

// Try to split an incoming "+919876543210" into dial + local
function splitNumber(full: string): { country: Country; local: string } {
  if (!full) {
    return { country: COUNTRIES[0], local: '' };
  }
  // Sort dial codes by length DESC so +971 matches before +9
  const sorted = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
  for (const c of sorted) {
    if (full.startsWith(c.dial)) {
      return { country: c, local: full.slice(c.dial.length).replace(/^\s+/, '') };
    }
  }
  return { country: COUNTRIES[0], local: full };
}

export function PhoneInput({ value, onChange, required, placeholder, className, defaultCountry = 'IN' }: Props) {
  const initial = splitNumber(value);
  // If no incoming value, honour defaultCountry
  const initialCountry = value ? initial.country : (COUNTRIES.find(c => c.code === defaultCountry) || COUNTRIES[0]);

  const [country, setCountry] = useState<Country>(initialCountry);
  const [local, setLocal] = useState(initial.local);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);

  // Re-sync when external value changes (e.g. data hydrate)
  useEffect(() => {
    if (value && value !== `${country.dial}${local}`) {
      const s = splitNumber(value);
      setCountry(s.country);
      setLocal(s.local);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Click outside closes dropdown
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const emit = (c: Country, l: string) => {
    const cleaned = l.replace(/[^\d]/g, '');
    onChange(cleaned ? `${c.dial}${cleaned}` : '');
  };

  const handleCountry = (c: Country) => {
    setCountry(c);
    setOpen(false);
    setSearch('');
    emit(c, local);
  };

  const handleLocal = (raw: string) => {
    setLocal(raw);
    emit(country, raw);
  };

  const filtered = search
    ? COUNTRIES.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.dial.includes(search) ||
        c.code.toLowerCase().includes(search.toLowerCase())
      )
    : COUNTRIES;

  return (
    <div ref={wrapRef} className={`relative ${className || ''}`}>
      <div className="flex items-stretch bg-beige border border-mitti/20 focus-within:border-kohl">
        {/* Country selector */}
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 px-3 py-3 border-r border-mitti/20 hover:bg-beige/60 font-ui text-sm whitespace-nowrap"
          aria-label="Choose country code"
        >
          <span className="text-lg leading-none">{country.flag}</span>
          <span className="text-kohl">{country.dial}</span>
          <ChevronDown className="w-3 h-3 text-mitti" />
        </button>

        {/* Number input */}
        <input
          type="tel"
          required={required}
          value={local}
          onChange={(e) => handleLocal(e.target.value)}
          placeholder={placeholder || 'Mobile number'}
          className="flex-1 p-3 bg-transparent font-ui text-sm outline-none"
        />
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-ivory border border-mitti/20 shadow-lg max-h-72 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-mitti/10">
            <div className="flex items-center gap-2 bg-beige px-2 py-1.5">
              <Search className="w-3.5 h-3.5 text-mitti" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search country or +code"
                className="flex-1 bg-transparent text-sm outline-none"
              />
            </div>
          </div>
          <div className="overflow-y-auto">
            {filtered.map(c => (
              <button
                type="button"
                key={c.code}
                onClick={() => handleCountry(c)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-beige text-sm text-left ${c.code === country.code ? 'bg-madder/5' : ''}`}
              >
                <span className="text-lg leading-none">{c.flag}</span>
                <span className="text-kohl flex-1">{c.name}</span>
                <span className="text-mitti tabular-nums">{c.dial}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="p-4 text-center text-sm text-mitti">No matches</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
