'use client';
// v23.40.11 — Reusable customer picker with live autocomplete.
// Lets the user pick an existing Customer (sets customerId) or type a new name
// (customerId stays null and the backend will auto-create the customer when
// the form is submitted). Always reports back the chosen name/email/phone/gstin.

import { useEffect, useRef, useState } from 'react';
import { Search, Check, User, X } from 'lucide-react';

interface Customer {
  id: string;
  displayName: string;
  legalName: string | null;
  primaryEmail: string | null;
  primaryPhone: string | null;
  gstin: string | null;
  customerType: string;
  channel: string;
  status: string;
}

interface Props {
  customerId: string | null;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerGstin?: string;
  onChange: (val: {
    customerId: string | null;
    customerName: string;
    customerEmail?: string;
    customerPhone?: string;
    customerGstin?: string;
  }) => void;
  label?: string;
  placeholder?: string;
}

export function CustomerAutocomplete({
  customerId, customerName, customerEmail, customerPhone, customerGstin, onChange,
  label = 'CUSTOMER',
  placeholder = 'Start typing a name, phone, email, or GSTIN…',
}: Props) {
  const [input, setInput] = useState(customerName);
  const [matches, setMatches] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => { setInput(customerName); }, [customerName]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, []);

  const search = (q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) { setMatches([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/admin/finance/customers/search?q=${encodeURIComponent(q)}`);
        const d = await r.json();
        setMatches(d.customers || []);
        setOpen(true);
      } finally { setLoading(false); }
    }, 220);
  };

  const handleType = (v: string) => {
    setInput(v);
    // user has changed the name — clear any prior customerId link
    onChange({ customerId: null, customerName: v, customerEmail, customerPhone, customerGstin });
    search(v);
  };

  const pick = (c: Customer) => {
    onChange({
      customerId: c.id,
      customerName: c.displayName,
      customerEmail: c.primaryEmail || '',
      customerPhone: c.primaryPhone || '',
      customerGstin: c.gstin || '',
    });
    setInput(c.displayName);
    setOpen(false);
  };

  const clear = () => {
    onChange({ customerId: null, customerName: '', customerEmail: '', customerPhone: '', customerGstin: '' });
    setInput('');
    setMatches([]);
    setOpen(false);
  };

  return (
    <div className="relative" ref={wrapRef}>
      <p className="label text-banarasi mb-1">{label}</p>
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-mitti/60 pointer-events-none" />
        <input
          type="text"
          value={input}
          onChange={(e) => handleType(e.target.value)}
          onFocus={() => input.length >= 2 && setOpen(true)}
          placeholder={placeholder}
          className="w-full bg-ivory border border-mitti/30 px-7 py-1.5 text-sm focus:border-madder outline-none"
        />
        {input && (
          <button type="button" onClick={clear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-mitti/60 hover:text-madder">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {customerId && (
        <p className="mt-1 text-[10px] text-emerald-700 flex items-center gap-1">
          <Check className="w-3 h-3" /> Linked to existing customer ledger
        </p>
      )}
      {!customerId && input.trim().length >= 2 && !loading && matches.length === 0 && (
        <p className="mt-1 text-[10px] text-amber-700">
          No customer matched — a new profile will be created and a ledger opened on save.
        </p>
      )}

      {open && (matches.length > 0 || loading) && (
        <div className="absolute z-30 mt-1 w-full bg-ivory border border-mitti/30 shadow-lg max-h-72 overflow-y-auto">
          {loading && <div className="p-2 text-xs text-mitti">Searching…</div>}
          {matches.map(c => (
            <button key={c.id} type="button" onClick={() => pick(c)}
              className="w-full text-left p-2 hover:bg-beige/40 border-b border-mitti/10 text-xs flex items-start gap-2">
              <User className="w-3.5 h-3.5 text-mitti mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-kohl font-medium truncate">
                  {c.displayName}
                  <span className="ml-2 text-[9px] text-mitti uppercase tracking-widest">{c.customerType}</span>
                </div>
                <div className="text-mitti text-[10px] truncate">
                  {[c.primaryPhone, c.primaryEmail, c.gstin].filter(Boolean).join(' • ')}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
