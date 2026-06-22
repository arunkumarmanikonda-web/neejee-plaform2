'use client';
// v23.39.1 — Reusable expense category selector with inline "Add new category" UI.
// Drop-in replacement for plain <select> bound to ExpenseCategory.id.

import { useEffect, useState } from 'react';
import { Plus, X, Loader2 } from 'lucide-react';

export interface Category {
  id: string;
  code: string;
  label: string;
  group: string;
  isActive?: boolean;
}

interface Props {
  value: string;                              // selected category id
  onChange: (id: string) => void;
  categories: Category[];                     // pre-loaded list
  onCategoriesChanged?: (next: Category[]) => void;  // parent gets updated list after add
  required?: boolean;
  className?: string;
  allowAdd?: boolean;                          // hide "Add new" button (default true)
}

// Friendly display labels for groups
const GROUP_LABELS: Record<string, string> = {
  COGS_DIRECT:        'COGS DIRECT',
  OPEX_MARKETING:     'MARKETING',
  OPEX_COMMUNICATION: 'COMMUNICATION',
  OPEX_SHIPPING:      'SHIPPING',
  OPEX_PAYMENT:       'PAYMENT & BANKING',
  OPEX_PLATFORM:      'PLATFORM & SaaS',
  OPEX_PEOPLE:        'PEOPLE & PAYROLL',
  OPEX_OFFICE:        'OFFICE & FACILITIES',
  OPEX_PROFESSIONAL:  'PROFESSIONAL & COMPLIANCE',
  OPEX_TAX_OTHER:     'TAX & STATUTORY',
  OPEX_OTHER:         'OTHER OPEX',
  WRITE_OFF:          'WRITE-OFFS',
};

const GROUP_ORDER = [
  'COGS_DIRECT', 'OPEX_MARKETING', 'OPEX_COMMUNICATION', 'OPEX_SHIPPING',
  'OPEX_PAYMENT', 'OPEX_PLATFORM', 'OPEX_PEOPLE', 'OPEX_OFFICE',
  'OPEX_PROFESSIONAL', 'OPEX_TAX_OTHER', 'OPEX_OTHER', 'WRITE_OFF',
];

export function CategorySelect({
  value, onChange, categories, onCategoriesChanged, required, className, allowAdd = true,
}: Props) {
  const [showAdd, setShowAdd] = useState(false);

  // Group categories
  const grouped = new Map<string, Category[]>();
  for (const c of categories) {
    if (!grouped.has(c.group)) grouped.set(c.group, []);
    grouped.get(c.group)!.push(c);
  }
  const orderedGroups = GROUP_ORDER.filter(g => grouped.has(g));

  return (
    <div>
      <div className={`flex gap-2 ${className || ''}`}>
        <select
          required={required}
          value={value}
          onChange={(e) => {
            if (e.target.value === '__ADD_NEW__') {
              setShowAdd(true);
              return;
            }
            onChange(e.target.value);
          }}
          className="flex-1 border border-mitti/30 px-3 py-2 font-ui text-sm bg-ivory"
        >
          <option value="">Choose a category…</option>
          {orderedGroups.map(g => (
            <optgroup key={g} label={GROUP_LABELS[g] || g}>
              {grouped.get(g)!.map(c => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </optgroup>
          ))}
          {allowAdd && (
            <>
              <option disabled>──────────────</option>
              <option value="__ADD_NEW__">+ Add new category…</option>
            </>
          )}
        </select>
        {allowAdd && (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="px-3 py-2 bg-beige border border-mitti/30 text-xs uppercase tracking-wider hover:bg-madder hover:text-ivory hover:border-madder"
            title="Add new category"
          >
            <Plus className="w-3 h-3" />
          </button>
        )}
      </div>

      {showAdd && (
        <AddCategoryModal
          onClose={() => setShowAdd(false)}
          onCreated={(newCat) => {
            setShowAdd(false);
            const next = [...categories, newCat];
            onCategoriesChanged?.(next);
            onChange(newCat.id);
          }}
        />
      )}
    </div>
  );
}

function AddCategoryModal({
  onClose, onCreated,
}: { onClose: () => void; onCreated: (c: Category) => void }) {
  const [form, setForm] = useState({
    label: '',
    code: '',
    group: 'OPEX_OTHER',
    isMarketingChannel: false,
    gstInputClaimable: true,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  // Auto-generate code from label
  useEffect(() => {
    if (!form.code && form.label) {
      const auto = form.label
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 30);
      setForm(f => ({ ...f, code: auto }));
    }
  }, [form.label]); // eslint-disable-line

  async function submit() {
    setErr(''); setSaving(true);
    try {
      if (!form.label.trim() || !form.code.trim() || !form.group) {
        throw new Error('Label, code, and group are required');
      }
      const r = await fetch('/api/admin/finance/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: form.code.trim(),
          label: form.label.trim(),
          group: form.group,
          isMarketingChannel: form.isMarketingChannel,
          gstInputClaimable: form.gstInputClaimable,
          approvalThresholdPaise: null,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Failed to create');
      onCreated(d.category || d);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-kohl/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-ivory max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-xl text-kohl">Add new category</h3>
          <button onClick={onClose} className="text-mitti hover:text-madder">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <p className="label text-banarasi mb-1">LABEL *</p>
            <input
              type="text"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="e.g. Office cleaning service"
              autoFocus
              className="w-full border border-mitti/30 px-3 py-2 font-ui text-sm bg-ivory"
            />
          </div>
          <div>
            <p className="label text-banarasi mb-1">CODE * (uppercase, no spaces)</p>
            <input
              type="text"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') })}
              placeholder="OFFICE_CLEANING_SERVICE"
              className="w-full border border-mitti/30 px-3 py-2 font-mono text-xs bg-ivory"
            />
          </div>
          <div>
            <p className="label text-banarasi mb-1">GROUP *</p>
            <select
              value={form.group}
              onChange={(e) => setForm({ ...form, group: e.target.value })}
              className="w-full border border-mitti/30 px-3 py-2 font-ui text-sm bg-ivory"
            >
              {GROUP_ORDER.map(g => (
                <option key={g} value={g}>{GROUP_LABELS[g]}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-kohl">
            <input
              type="checkbox"
              checked={form.isMarketingChannel}
              onChange={(e) => setForm({ ...form, isMarketingChannel: e.target.checked })}
            />
            Marketing channel (tracked in marketing P&L)
          </label>
          <label className="flex items-center gap-2 text-sm text-kohl">
            <input
              type="checkbox"
              checked={form.gstInputClaimable}
              onChange={(e) => setForm({ ...form, gstInputClaimable: e.target.checked })}
            />
            GST input tax credit claimable
          </label>
        </div>

        {err && (
          <div className="mt-3 bg-madder/10 border border-madder p-3 text-madder text-sm">{err}</div>
        )}

        <div className="flex gap-2 mt-5">
          <button
            onClick={submit}
            disabled={saving}
            className="flex-1 bg-kohl text-ivory px-4 py-2 text-xs tracking-widest disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-3 h-3 animate-spin" />}
            {saving ? 'CREATING…' : 'CREATE CATEGORY'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-mitti/30 text-mitti text-xs tracking-widest"
          >
            CANCEL
          </button>
        </div>
      </div>
    </div>
  );
}
