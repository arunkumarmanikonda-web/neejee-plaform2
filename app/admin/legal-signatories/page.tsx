'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

type Item = {
  id: string;
  name: string;
  title: string;
  email: string;
  phone: string;
  signatureUrl: string;
  validFrom: string;
  validTo: string;
  active: boolean;
  isDefault: boolean;
};

const makeItem = (): Item => ({
  id: `sig_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  name: '',
  title: '',
  email: '',
  phone: '',
  signatureUrl: '',
  validFrom: '',
  validTo: '',
  active: true,
  isDefault: false,
});

export default function AdminLegalSignatoriesPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const defaultId = useMemo(() => items.find(x => x.isDefault)?.id || '', [items]);

  useEffect(() => {
    fetch('/api/admin/legal-signatories', { cache: 'no-store' })
      .then(r => r.json().then(j => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!ok) throw new Error(j?.error || 'Failed to load signatories');
        setItems(Array.isArray(j?.items) ? j.items : []);
        setLoading(false);
      })
      .catch(e => { setErr(String(e?.message || 'Failed to load signatories')); setLoading(false); });
  }, []);

  const patch = (id: string, next: Partial<Item>) =>
    setItems(curr => curr.map(x => x.id === id ? { ...x, ...next } : x));

  const add = () =>
    setItems(curr => {
      const next = [...curr, makeItem()];
      if (!next.some(x => x.isDefault) && next[0]) next[0].isDefault = true;
      return next;
    });

  const remove = (id: string) =>
    setItems(curr => {
      const next = curr.filter(x => x.id !== id);
      if (next.length && !next.some(x => x.isDefault)) next[0].isDefault = true;
      return next;
    });

  const setDefault = (id: string) =>
    setItems(curr => curr.map(x => ({ ...x, isDefault: x.id === id })));

  const save = async () => {
    setSaving(true); setErr(''); setMsg('');
    try {
      const res = await fetch('/api/admin/legal-signatories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to save signatories');
      setItems(Array.isArray(json?.items) ? json.items : []);
      setMsg('Signatory registry saved');
    } catch (e: any) {
      setErr(String(e?.message || 'Failed to save signatories'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 lg:p-8">
      <p className="label text-madder">LEGAL · COMPANY SIGNING AUTHORITY</p>
      <h1 className="font-display text-3xl text-kohl mt-2">Signatory Registry</h1>
      <p className="font-italic italic text-mitti mt-2">
        Create, edit, activate, and assign authorised signatories for M/s Oye Imagine.
      </p>
      <div className="madder-divider mt-4"></div>

      <div className="flex flex-wrap gap-3 mt-6">
        <button type="button" onClick={add} className="btn-primary">ADD SIGNATORY</button>
        <button type="button" onClick={save} disabled={saving} className="px-4 py-2 bg-kohl text-ivory text-sm disabled:opacity-50">
          SAVE REGISTRY
        </button>
        <Link href="/admin/legal-entity" className="px-4 py-2 border border-mitti/20 text-sm text-mitti hover:bg-mitti/5">
          LEGAL ENTITY DEFAULTS
        </Link>
      </div>

      {msg ? <p className="text-neem text-sm mt-4">{msg}</p> : null}
      {err ? <p className="text-madder text-sm mt-4">{err}</p> : null}

      {loading ? (
        <p className="text-mitti mt-8">Loading signatories...</p>
      ) : (
        <div className="space-y-5 mt-8">
          {items.length === 0 ? <div className="border border-dashed border-mitti/25 p-8 text-mitti">No signatories yet.</div> : null}

          {items.map((item, index) => (
            <section key={item.id} className="border border-mitti/15 p-5 bg-ivory">
              <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                <div>
                  <p className="font-display text-lg text-kohl">{item.name || `Signatory ${index + 1}`}</p>
                  <p className="text-xs text-mitti mt-1">
                    {item.id === defaultId ? 'Default company signatory' : 'Assignable company signatory'}
                    {item.active ? ' · Active' : ' · Inactive'}
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {item.id !== defaultId ? (
                    <button type="button" onClick={() => setDefault(item.id)} className="px-3 py-2 border border-neem text-neem text-xs">
                      SET DEFAULT
                    </button>
                  ) : (
                    <span className="px-3 py-2 bg-neem text-ivory text-xs">DEFAULT</span>
                  )}
                  <button type="button" onClick={() => remove(item.id)} className="px-3 py-2 border border-madder/30 text-madder text-xs">
                    DELETE
                  </button>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Name" value={item.name} onChange={v => patch(item.id, { name: v })} />
                <Field label="Title" value={item.title} onChange={v => patch(item.id, { title: v })} />
                <Field label="Email" value={item.email} onChange={v => patch(item.id, { email: v })} />
                <Field label="Phone" value={item.phone} onChange={v => patch(item.id, { phone: v })} />
                <Field label="Signature URL" value={item.signatureUrl} onChange={v => patch(item.id, { signatureUrl: v })} />
                <Field label="Valid from" type="date" value={item.validFrom} onChange={v => patch(item.id, { validFrom: v })} />
                <Field label="Valid to" type="date" value={item.validTo} onChange={v => patch(item.id, { validTo: v })} />
              </div>

              <div className="mt-4">
                <label className="inline-flex items-center gap-2 text-sm text-kohl">
                  <input type="checkbox" checked={item.active} onChange={e => patch(item.id, { active: e.target.checked })} />
                  Active and assignable
                </label>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({
  label, value, onChange, type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-widest text-mitti">{label}</span>
      <input
        type={type}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        className="mt-1 w-full p-2 bg-beige border border-mitti/20 text-sm"
      />
    </label>
  );
}