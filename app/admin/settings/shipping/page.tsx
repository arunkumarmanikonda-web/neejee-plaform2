'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Save, Trash2, ArrowLeft, Loader2, X } from 'lucide-react';

interface Zone {
  id: string;
  name: string;
  pincodePrefixes: string[];
  pincodeExact: string[];
  states: string[];
  isDefault: boolean;
  standardPaise: number;
  expressPaise: number;
  freeAboveSubtotalPaise: number;
  inclusive: boolean;
  priority: number;
  active: boolean;
}

// Round any rupee value to nearest ₹50
const round50 = (rs: number) => Math.round(rs / 50) * 50;
const toRupees = (paise: number) => Math.round((paise || 0) / 100);
const toPaise  = (rs: number)    => Math.max(0, round50(rs)) * 100;

export default function AdminShippingSettings() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/shipping/zones', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Load failed');
      setZones(data.zones || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function createZone(payload: Partial<Zone>) {
    setError('');
    const res = await fetch('/api/admin/shipping/zones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || 'Create failed'); return; }
    setInfo('Zone created.');
    setCreating(false);
    await load();
  }

  async function updateZone(id: string, patch: Partial<Zone>) {
    const res = await fetch(`/api/admin/shipping/zones/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error || 'Update failed'); return; }
    await load();
  }

  async function deleteZone(id: string) {
    if (!confirm('Delete this shipping zone? This cannot be undone.')) return;
    const res = await fetch(`/api/admin/shipping/zones/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error || 'Delete failed'); return; }
    await load();
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <Link href="/admin/settings" className="text-mitti hover:text-madder inline-flex items-center gap-2 text-xs font-ui mb-4">
        <ArrowLeft className="w-4 h-4" /> ALL SETTINGS
      </Link>
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="label text-madder">CONFIG · SHIPPING</p>
          <h1 className="font-display text-3xl text-kohl">Shipping zones</h1>
          <p className="font-italic italic text-mitti mt-1">
            Configure shipping costs by destination. Highest-priority matching zone wins. Costs are rounded to the nearest ₹50.
          </p>
        </div>
        <button onClick={() => setCreating(true)} className="bg-madder text-ivory px-4 py-2 font-ui text-xs tracking-widest hover:bg-kohl inline-flex items-center gap-2">
          <Plus className="w-4 h-4" /> NEW ZONE
        </button>
      </div>

      {error && <div className="border border-madder bg-madder/10 text-madder p-3 mb-4 font-ui text-sm">{error}</div>}
      {info && <div className="border border-emerald-500 bg-emerald-50 text-emerald-700 p-3 mb-4 font-ui text-sm">{info}</div>}

      {loading ? <p className="italic text-mitti">Loading…</p> : (
        <div className="space-y-4">
          {zones.length === 0 && (
            <div className="border border-mitti/20 bg-beige p-8 text-center text-mitti">
              No shipping zones yet. Create your first to start charging shipping.
            </div>
          )}
          {zones.map(z => (
            <ZoneRow key={z.id} zone={z} onSave={p => updateZone(z.id, p)} onDelete={() => deleteZone(z.id)} />
          ))}
        </div>
      )}

      {creating && (
        <NewZoneModal onClose={() => setCreating(false)} onCreate={createZone} />
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────
function ZoneRow({ zone, onSave, onDelete }: { zone: Zone; onSave: (p: Partial<Zone>) => void; onDelete: () => void }) {
  const [v, setV] = useState<any>({
    name: zone.name,
    pincodePrefixes: zone.pincodePrefixes.join(', '),
    pincodeExact: zone.pincodeExact.join(', '),
    states: zone.states.join(', '),
    standardRs: toRupees(zone.standardPaise),
    expressRs:  toRupees(zone.expressPaise),
    freeAboveRs: toRupees(zone.freeAboveSubtotalPaise),
    inclusive: zone.inclusive,
    isDefault: zone.isDefault,
    priority: zone.priority,
    active: zone.active,
  });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const change = (patch: any) => { setV({ ...v, ...patch }); setDirty(true); };
  const save = async () => {
    setSaving(true);
    await onSave({
      name: v.name,
      pincodePrefixes: v.pincodePrefixes.split(',').map((s: string) => s.trim()).filter(Boolean),
      pincodeExact:    v.pincodeExact.split(',').map((s: string) => s.trim()).filter(Boolean),
      states:          v.states.split(',').map((s: string) => s.trim()).filter(Boolean),
      standardPaise:   toPaise(v.standardRs),
      expressPaise:    toPaise(v.expressRs),
      freeAboveSubtotalPaise: toPaise(v.freeAboveRs),
      inclusive: !!v.inclusive,
      isDefault: !!v.isDefault,
      priority: parseInt(v.priority) || 100,
      active: !!v.active,
    });
    setDirty(false);
    setSaving(false);
  };

  return (
    <div className={`border ${zone.isDefault ? 'border-madder' : 'border-mitti/20'} bg-ivory p-4`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <input value={v.name} onChange={e => change({ name: e.target.value })}
            className="font-display text-lg text-kohl border-b border-transparent hover:border-mitti/30 focus:border-madder bg-transparent outline-none" />
          {zone.isDefault && <span className="bg-madder text-ivory text-[10px] font-ui tracking-widest px-2 py-0.5">DEFAULT</span>}
          {!v.active && <span className="bg-stone-300 text-stone-700 text-[10px] font-ui tracking-widest px-2 py-0.5">INACTIVE</span>}
          {v.inclusive && <span className="bg-emerald-100 text-emerald-700 text-[10px] font-ui tracking-widest px-2 py-0.5">INCLUSIVE</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={save} disabled={!dirty || saving}
            className={`text-xs font-ui px-2 py-1 border tracking-widest ${dirty ? 'bg-madder text-ivory border-madder hover:bg-kohl' : 'bg-beige text-mitti border-mitti/20 cursor-not-allowed'}`}>
            {saving ? '…' : (dirty ? 'SAVE' : 'SAVED')}
          </button>
          {!zone.isDefault && (
            <button onClick={onDelete} className="text-monsoon hover:text-madder" title="Delete zone">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div>
          <label className="label text-mitti">STANDARD (₹)</label>
          <input type="number" step={50} value={v.standardRs} onChange={e => change({ standardRs: parseInt(e.target.value) || 0 })}
            className="w-full p-2 bg-ivory border border-mitti/20 mt-1" />
        </div>
        <div>
          <label className="label text-mitti">EXPRESS (₹)</label>
          <input type="number" step={50} value={v.expressRs} onChange={e => change({ expressRs: parseInt(e.target.value) || 0 })}
            className="w-full p-2 bg-ivory border border-mitti/20 mt-1" />
        </div>
        <div>
          <label className="label text-mitti">FREE ABOVE (₹)</label>
          <input type="number" step={50} value={v.freeAboveRs} onChange={e => change({ freeAboveRs: parseInt(e.target.value) || 0 })}
            className="w-full p-2 bg-ivory border border-mitti/20 mt-1" />
        </div>
        <div>
          <label className="label text-mitti">PRIORITY</label>
          <input type="number" value={v.priority} onChange={e => change({ priority: parseInt(e.target.value) || 0 })}
            className="w-full p-2 bg-ivory border border-mitti/20 mt-1" />
          <p className="text-[10px] text-mitti/70 mt-1">Higher = checked first</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3 text-sm">
        <div>
          <label className="label text-mitti">PINCODE PREFIXES</label>
          <input value={v.pincodePrefixes} onChange={e => change({ pincodePrefixes: e.target.value })}
            placeholder="500, 501, 502" className="w-full p-2 bg-ivory border border-mitti/20 mt-1 font-mono text-xs" />
          <p className="text-[10px] text-mitti/70 mt-1">Comma-separated; matches start of pincode</p>
        </div>
        <div>
          <label className="label text-mitti">EXACT PINCODES</label>
          <input value={v.pincodeExact} onChange={e => change({ pincodeExact: e.target.value })}
            placeholder="500001, 500003" className="w-full p-2 bg-ivory border border-mitti/20 mt-1 font-mono text-xs" />
        </div>
        <div>
          <label className="label text-mitti">STATES</label>
          <input value={v.states} onChange={e => change({ states: e.target.value })}
            placeholder="Telangana, Andhra Pradesh" className="w-full p-2 bg-ivory border border-mitti/20 mt-1 text-xs" />
        </div>
      </div>

      <div className="flex items-center gap-4 mt-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={v.inclusive} onChange={e => change({ inclusive: e.target.checked })} />
          Inclusive (brand absorbs cost; customer pays ₹0)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={v.isDefault} onChange={e => change({ isDefault: e.target.checked })} />
          Default zone (catch-all)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={v.active} onChange={e => change({ active: e.target.checked })} />
          Active
        </label>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────
function NewZoneModal({ onClose, onCreate }: { onClose: () => void; onCreate: (p: any) => Promise<void> }) {
  const [v, setV] = useState({
    name: '',
    pincodePrefixes: '',
    pincodeExact: '',
    states: '',
    standardRs: 150,
    expressRs: 250,
    freeAboveRs: 2500,
    inclusive: false,
    isDefault: false,
    priority: 100,
  });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    await onCreate({
      name: v.name,
      pincodePrefixes: v.pincodePrefixes.split(',').map(s => s.trim()).filter(Boolean),
      pincodeExact:    v.pincodeExact.split(',').map(s => s.trim()).filter(Boolean),
      states:          v.states.split(',').map(s => s.trim()).filter(Boolean),
      standardPaise:   toPaise(v.standardRs),
      expressPaise:    toPaise(v.expressRs),
      freeAboveSubtotalPaise: toPaise(v.freeAboveRs),
      inclusive: v.inclusive,
      isDefault: v.isDefault,
      priority: v.priority,
      active: true,
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-kohl/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-ivory border border-mitti/30 max-w-xl w-full p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl text-kohl">New shipping zone</h2>
          <button onClick={onClose} className="text-mitti hover:text-kohl"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="label text-mitti">Name *</label>
            <input value={v.name} onChange={e => setV({ ...v, name: e.target.value })}
              placeholder="e.g. Hyderabad metro" className="w-full p-2 bg-ivory border border-mitti/20 mt-1" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label text-mitti">STANDARD (₹)</label>
              <input type="number" step={50} value={v.standardRs} onChange={e => setV({ ...v, standardRs: parseInt(e.target.value) || 0 })} className="w-full p-2 bg-ivory border border-mitti/20 mt-1" />
            </div>
            <div>
              <label className="label text-mitti">EXPRESS (₹)</label>
              <input type="number" step={50} value={v.expressRs} onChange={e => setV({ ...v, expressRs: parseInt(e.target.value) || 0 })} className="w-full p-2 bg-ivory border border-mitti/20 mt-1" />
            </div>
            <div>
              <label className="label text-mitti">FREE ABOVE (₹)</label>
              <input type="number" step={50} value={v.freeAboveRs} onChange={e => setV({ ...v, freeAboveRs: parseInt(e.target.value) || 0 })} className="w-full p-2 bg-ivory border border-mitti/20 mt-1" />
            </div>
          </div>
          <div>
            <label className="label text-mitti">Pincode prefixes (comma-sep)</label>
            <input value={v.pincodePrefixes} onChange={e => setV({ ...v, pincodePrefixes: e.target.value })}
              placeholder="500, 501" className="w-full p-2 bg-ivory border border-mitti/20 mt-1 font-mono text-xs" />
          </div>
          <div>
            <label className="label text-mitti">Exact pincodes (comma-sep)</label>
            <input value={v.pincodeExact} onChange={e => setV({ ...v, pincodeExact: e.target.value })}
              placeholder="500001, 500003" className="w-full p-2 bg-ivory border border-mitti/20 mt-1 font-mono text-xs" />
          </div>
          <div>
            <label className="label text-mitti">States (comma-sep)</label>
            <input value={v.states} onChange={e => setV({ ...v, states: e.target.value })}
              placeholder="Telangana, Andhra Pradesh" className="w-full p-2 bg-ivory border border-mitti/20 mt-1 text-xs" />
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={v.inclusive} onChange={e => setV({ ...v, inclusive: e.target.checked })} />
              Inclusive (brand absorbs cost)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={v.isDefault} onChange={e => setV({ ...v, isDefault: e.target.checked })} />
              Default zone
            </label>
          </div>
        </div>
        <div className="flex gap-2 mt-5 pt-4 border-t border-mitti/15">
          <button onClick={submit} disabled={saving || !v.name.trim()}
            className="flex-1 bg-kohl text-ivory text-xs tracking-widest px-4 py-2 hover:bg-madder disabled:opacity-40 inline-flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} CREATE ZONE
          </button>
          <button onClick={onClose} className="px-4 py-2 border border-mitti/30 text-mitti text-xs tracking-widest hover:bg-mitti/10">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
