'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  PenSquare,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  UserCircle2,
  X,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

type Signatory = {
  id: string;
  name: string;
  title: string;
  email?: string | null;
  phone?: string | null;
  signatureUrl?: string | null;
  isDefault: boolean;
  isActive: boolean;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  createdAt: string;
};

const EMPTY_FORM = {
  name: '',
  title: '',
  email: '',
  phone: '',
  signatureUrl: '',
  isDefault: false,
  isActive: true,
  effectiveFrom: '',
  effectiveTo: '',
};

async function readJson(res: Response) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

export default function LegalSignatoriesPage() {
  const [items, setItems] = useState<Signatory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(EMPTY_FORM);

  const title = editingId ? 'Edit signatory' : 'Add signatory';

  const activeCount = useMemo(
    () => items.filter(x => x.isActive).length,
    [items],
  );

  const load = async () => {
    setLoading(true);
    setErr('');
    try {
      const res = await fetch('/api/admin/legal-signatories', { cache: 'no-store' });
      const json = await readJson(res);
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setItems(json?.signatories || []);
    } catch (e: any) {
      setErr(e?.message || 'Failed to load signatories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr('');
    setMsg('');

    try {
      const url = editingId
        ? `/api/admin/legal-signatories/${editingId}`
        : '/api/admin/legal-signatories';
      const method = editingId ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const json = await readJson(res);
      if (!res.ok) throw new Error(json?.error || 'Save failed');

      setMsg(editingId ? 'Signatory updated' : 'Signatory created');
      resetForm();
      await load();
      setTimeout(() => setMsg(''), 2500);
    } catch (e: any) {
      setErr(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const editItem = (item: Signatory) => {
    setEditingId(item.id);
    setForm({
      name: item.name || '',
      title: item.title || '',
      email: item.email || '',
      phone: item.phone || '',
      signatureUrl: item.signatureUrl || '',
      isDefault: !!item.isDefault,
      isActive: !!item.isActive,
      effectiveFrom: item.effectiveFrom ? String(item.effectiveFrom).slice(0, 10) : '',
      effectiveTo: item.effectiveTo ? String(item.effectiveTo).slice(0, 10) : '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const patchItem = async (id: string, body: any, successMsg: string) => {
    setSaving(true);
    setErr('');
    setMsg('');

    try {
      const res = await fetch(`/api/admin/legal-signatories/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await readJson(res);
      if (!res.ok) throw new Error(json?.error || 'Update failed');
      setMsg(successMsg);
      await load();
      setTimeout(() => setMsg(''), 2500);
    } catch (e: any) {
      setErr(e?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (id: string) => {
    if (!window.confirm('Delete this signatory?')) return;

    setSaving(true);
    setErr('');
    setMsg('');

    try {
      const res = await fetch(`/api/admin/legal-signatories/${id}`, {
        method: 'DELETE',
      });
      const json = await readJson(res);
      if (!res.ok) throw new Error(json?.error || 'Delete failed');
      setMsg('Signatory deleted');
      await load();
      setTimeout(() => setMsg(''), 2500);
    } catch (e: any) {
      setErr(e?.message || 'Delete failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-7xl space-y-8">
      <div>
        <Link
          href="/admin/legal-entity"
          className="text-xs tracking-wider text-mitti hover:text-kohl inline-flex items-center gap-1"
        >
          <ArrowLeft className="w-3 h-3" /> BACK TO LEGAL ENTITY
        </Link>
        <p className="label text-madder mt-6">LEGAL OPERATIONS</p>
        <h1 className="font-display text-4xl text-kohl mt-2">Legal signatories</h1>
        <p className="font-italic italic text-mitti mt-2">
          Manage authorised Oye Imagine signatories, signature images, defaults, and activation windows.
        </p>
        <div className="madder-divider mt-4"></div>
      </div>

      {msg ? <p className="text-neem text-sm">{msg}</p> : null}
      {err ? <p className="text-madder text-sm">{err}</p> : null}

      <div className="grid xl:grid-cols-[420px_1fr] gap-6">
        <section className="border border-mitti/15 bg-ivory p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="label text-madder">{title.toUpperCase()}</p>
              <p className="text-xs text-mitti mt-1">
                Default signatory is used by the agreement workflow unless changed on a specific agreement.
              </p>
            </div>
            {editingId ? (
              <button
                type="button"
                onClick={resetForm}
                className="btn-outline text-xs inline-flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" /> RESET
              </button>
            ) : null}
          </div>

          <form onSubmit={submit} className="space-y-4 mt-5">
            <Field
              label="Name"
              value={form.name}
              onChange={v => setForm({ ...form, name: v })}
              required
              placeholder="Nidhi Sharma"
            />
            <Field
              label="Title"
              value={form.title}
              onChange={v => setForm({ ...form, title: v })}
              required
              placeholder="Authorised Signatory"
            />
            <Field
              label="Email"
              value={form.email}
              onChange={v => setForm({ ...form, email: v })}
              placeholder="legal@neejee.com"
            />
            <Field
              label="Phone"
              value={form.phone}
              onChange={v => setForm({ ...form, phone: v })}
              placeholder="+91..."
            />
            <Field
              label="Signature image URL"
              value={form.signatureUrl}
              onChange={v => setForm({ ...form, signatureUrl: v })}
              placeholder="https://..."
            />

            <div className="grid md:grid-cols-2 gap-4">
              <Field
                label="Effective from"
                value={form.effectiveFrom}
                onChange={v => setForm({ ...form, effectiveFrom: v })}
                type="date"
              />
              <Field
                label="Effective to"
                value={form.effectiveTo}
                onChange={v => setForm({ ...form, effectiveTo: v })}
                type="date"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4 pt-1">
              <label className="flex items-center gap-2 text-sm text-kohl">
                <input
                  type="checkbox"
                  checked={!!form.isDefault}
                  onChange={e => setForm({ ...form, isDefault: e.target.checked })}
                  className="accent-madder"
                />
                Set as default
              </label>

              <label className="flex items-center gap-2 text-sm text-kohl">
                <input
                  type="checkbox"
                  checked={!!form.isActive}
                  onChange={e => setForm({ ...form, isActive: e.target.checked })}
                  className="accent-madder"
                />
                Active
              </label>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="btn-primary text-xs inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              {editingId ? <Save className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              {editingId ? 'SAVE SIGNATORY' : 'ADD SIGNATORY'}
            </button>
          </form>
        </section>

        <section className="space-y-4">
          <div className="bg-beige p-5 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="label text-mitti">REGISTRY SNAPSHOT</p>
              <p className="font-display text-2xl text-kohl mt-1">{items.length} total</p>
              <p className="text-xs text-mitti mt-1">{activeCount} active signatories</p>
            </div>

            <div className="text-xs text-mitti">
              Use one default signatory for standard agreements and override it per seller where needed.
            </div>
          </div>

          {loading ? (
            <div className="bg-ivory border border-mitti/15 p-8 text-center text-mitti">
              Loading signatories…
            </div>
          ) : items.length === 0 ? (
            <div className="bg-ivory border border-dashed border-mitti/25 p-10 text-center">
              <UserCircle2 className="w-10 h-10 text-mitti/40 mx-auto mb-4" />
              <p className="font-display text-2xl text-kohl">No signatories yet</p>
              <p className="text-sm text-mitti mt-2">
                Add the first authorised signatory to use in the legal agreement workflow.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {items.map(item => (
                <div key={item.id} className="bg-ivory border border-mitti/15 p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-display text-2xl text-kohl">{item.name}</p>
                        {item.isDefault ? (
                          <span className="text-[10px] tracking-wider px-2 py-1 bg-kohl text-ivory">
                            DEFAULT
                          </span>
                        ) : null}
                        {item.isActive ? (
                          <span className="text-[10px] tracking-wider px-2 py-1 bg-neem/20 text-neem">
                            ACTIVE
                          </span>
                        ) : (
                          <span className="text-[10px] tracking-wider px-2 py-1 bg-mitti/20 text-mitti">
                            INACTIVE
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-mitti mt-1">{item.title}</p>

                      <div className="grid md:grid-cols-2 gap-x-6 gap-y-1 mt-4 text-xs">
                        <Info label="Email" value={item.email} />
                        <Info label="Phone" value={item.phone} />
                        <Info
                          label="Effective from"
                          value={item.effectiveFrom ? new Date(item.effectiveFrom).toLocaleDateString('en-IN') : '—'}
                        />
                        <Info
                          label="Effective to"
                          value={item.effectiveTo ? new Date(item.effectiveTo).toLocaleDateString('en-IN') : '—'}
                        />
                      </div>
                    </div>

                    {item.signatureUrl ? (
                      <div className="shrink-0">
                        <p className="label text-mitti mb-2">SIGNATURE</p>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.signatureUrl}
                          alt={item.name}
                          className="h-20 w-auto object-contain bg-white border border-mitti/10 p-2"
                        />
                      </div>
                    ) : (
                      <div className="shrink-0 text-xs text-mitti">
                        No signature image
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 mt-5">
                    <button
                      onClick={() => editItem(item)}
                      className="btn-outline text-xs inline-flex items-center gap-1"
                    >
                      <PenSquare className="w-3.5 h-3.5" /> EDIT
                    </button>

                    {!item.isDefault ? (
                      <button
                        onClick={() => patchItem(item.id, { isDefault: true }, 'Default signatory updated')}
                        disabled={saving}
                        className="px-3 py-2 bg-kohl text-ivory text-xs tracking-wider hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" /> MAKE DEFAULT
                      </button>
                    ) : null}

                    <button
                      onClick={() =>
                        patchItem(
                          item.id,
                          { isActive: !item.isActive },
                          item.isActive ? 'Signatory deactivated' : 'Signatory activated',
                        )
                      }
                      disabled={saving}
                      className="px-3 py-2 border border-mitti/25 text-xs tracking-wider text-mitti hover:bg-mitti/5 disabled:opacity-50"
                    >
                      {item.isActive ? 'DEACTIVATE' : 'ACTIVATE'}
                    </button>

                    <button
                      onClick={() => deleteItem(item.id)}
                      disabled={saving}
                      className="px-3 py-2 border border-madder text-madder text-xs tracking-wider hover:bg-madder/10 disabled:opacity-50 inline-flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> DELETE
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <div>
      <label className="label text-mitti">{label}</label>
      <input
        type={type}
        value={value || ''}
        required={required}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full p-3 bg-ivory border border-mitti/20 text-sm mt-1"
      />
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-mitti/10 pb-2">
      <span className="text-mitti">{label}</span>
      <span className="text-kohl text-right">{value || '—'}</span>
    </div>
  );
}