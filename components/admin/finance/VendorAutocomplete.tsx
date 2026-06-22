'use client';
// v23.40.4 — Reusable vendor picker with live autocomplete.
// Lets the user either pick an existing Vendor (sets vendorId) or type a new
// name (vendorId stays null and the backend will auto-create the vendor when
// the form is submitted). Always reports back the chosen `vendorNameSnapshot`.

import { useEffect, useRef, useState } from 'react';
import { Search, Check, Building2, X } from 'lucide-react';

interface Vendor {
  id: string;
  displayName: string | null;
  legalName: string;
  contactEmail: string;
  contactPhone: string | null;
  gstin: string | null;
  status: string;
}

interface Props {
  vendorId: string | null;
  vendorName: string;
  onChange: (val: { vendorId: string | null; vendorName: string }) => void;
  label?: string;
  placeholder?: string;
}

export function VendorAutocomplete({
  vendorId, vendorName, onChange,
  label = 'VENDOR / PAYEE',
  placeholder = 'Start typing a vendor name…',
}: Props) {
  const [input, setInput] = useState(vendorName);
  const [matches, setMatches] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => { setInput(vendorName); }, [vendorName]);

  // Close dropdown on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!input || input.trim().length < 2) { setMatches([]); return; }
    if (vendorId && input === vendorName) return; // already selected, don't re-search
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/admin/finance/vendors/search?q=${encodeURIComponent(input.trim())}`);
        const d = await r.json();
        setMatches(d.vendors || []);
        setOpen(true);
      } finally { setLoading(false); }
    }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line
  }, [input]);

  function pick(v: Vendor) {
    const name = v.displayName || v.legalName;
    onChange({ vendorId: v.id, vendorName: name });
    setInput(name);
    setOpen(false);
  }

  function clear() {
    onChange({ vendorId: null, vendorName: '' });
    setInput('');
    setMatches([]);
  }

  return (
    <div ref={wrapRef} className="relative">
      <p className="label text-banarasi mb-1">{label}</p>
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-mitti pointer-events-none" />
        <input
          value={input}
          onChange={e => {
            setInput(e.target.value);
            // If user edits after selecting, drop the existing vendorId (treat as new name)
            if (vendorId) onChange({ vendorId: null, vendorName: e.target.value });
            else          onChange({ vendorId: null, vendorName: e.target.value });
          }}
          onFocus={() => { if (matches.length) setOpen(true); }}
          placeholder={placeholder}
          className="w-full border border-mitti/30 pl-9 pr-9 py-2 bg-ivory text-sm"
        />
        {vendorId && (
          <Check className="w-4 h-4 absolute right-9 top-1/2 -translate-y-1/2 text-emerald-700" />
        )}
        {(input || vendorId) && (
          <button type="button" onClick={clear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-mitti hover:text-madder">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <p className="text-[10px] mt-0.5">
        {vendorId ? (
          <span className="text-emerald-700">✓ Linked to existing vendor — ledger entries will appear under this counterparty.</span>
        ) : input.trim() ? (
          <span className="text-amber-700">No vendor selected — a new vendor will be auto-created and a ledger opened on save.</span>
        ) : (
          <span className="text-mitti">Optional. Leave blank for &quot;Unassigned&quot;.</span>
        )}
      </p>

      {open && (matches.length > 0 || loading) && (
        <div className="absolute z-20 mt-1 w-full bg-ivory border border-mitti/30 shadow-lg max-h-72 overflow-y-auto">
          {loading && (
            <div className="px-3 py-2 text-xs text-mitti italic">Searching…</div>
          )}
          {matches.map(v => (
            <button key={v.id} type="button" onClick={() => pick(v)}
              className="w-full text-left px-3 py-2 hover:bg-beige/50 border-b border-mitti/10 last:border-0 flex items-start gap-2">
              <Building2 className="w-4 h-4 text-mitti mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-kohl truncate">{v.displayName || v.legalName}</p>
                <div className="text-[10px] text-mitti flex flex-wrap gap-x-3 gap-y-0.5">
                  {v.gstin        && <span>GSTIN: {v.gstin}</span>}
                  {v.contactEmail && !v.contactEmail.includes('@neejee.local') && <span>{v.contactEmail}</span>}
                  {v.contactPhone && <span>{v.contactPhone}</span>}
                  <span className={`uppercase tracking-widest ${v.status === 'ACTIVE' ? 'text-emerald-700' : 'text-mitti'}`}>{v.status}</span>
                </div>
              </div>
            </button>
          ))}
          {!loading && matches.length === 0 && input.trim().length >= 2 && (
            <div className="px-3 py-3 text-xs text-mitti">
              No vendor matches &quot;{input}&quot;. Press save to auto-create one.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
