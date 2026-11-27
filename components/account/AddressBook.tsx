'use client';
import { useEffect, useState, type FormEvent } from 'react';
export type SavedAddress = {
  id:string; name:string; phone:string; line1:string; line2:string | null; city:string; state:string; pincode:string; country:string;
};
const fields = [
  ['name','Recipient name','name'],['phone','Mobile number','tel'],['line1','Address line 1','address-line1'],
  ['line2','Address line 2 (optional)','address-line2'],['city','City','address-level2'],['state','State','address-level1'],
  ['pincode','PIN code','postal-code'],
] as const;
export default function AddressBook() {
  const [addresses,setAddresses] = useState<SavedAddress[]>([]);
  const [ready,setReady] = useState(false);
  const [editing,setEditing] = useState(false);
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/account/addresses',{cache:'no-store',signal:controller.signal})
      .then(async res => { if (!res.ok) throw new Error(); return res.json(); })
      .then(data => setAddresses(data.addresses))
      .catch(() => { if (!controller.signal.aborted) setError('Saved addresses could not be loaded.'); })
      .finally(() => { if (!controller.signal.aborted) setReady(true); });
    return () => controller.abort();
  },[]);
  async function save(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/account/addresses',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(fields)});
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save this address.');
      setAddresses(existing => [data.address,...existing]); setEditing(false);
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not save this address.'); }
    finally { setSaving(false); }
  }
  return <section>
    <h2 className="font-display text-2xl text-kohl mb-6">Delivery addresses</h2>
    {!ready && <p>Loading addresses…</p>}
    {ready && !addresses.length && !error && <p>Your saved delivery addresses will appear here.</p>}
    <ul className="space-y-2">{addresses.map(address => <li key={address.id} className="p-4 bg-beige">
      <strong>{address.name}</strong><p>{[address.line1,address.line2,address.city,address.state,address.pincode].filter(Boolean).join(', ')}</p><p>{address.phone}</p>
    </li>)}</ul>
    {error && <p role="alert" className="text-madder my-3">{error}</p>}
    {editing ? <form onSubmit={save} className="mt-4 grid sm:grid-cols-2 gap-3">
      {fields.map(([name,label,autoComplete]) => <label key={name} className="block">{label}
        <input name={name} required={name !== 'line2'} autoComplete={autoComplete}
          type={name==='phone'?'tel':'text'} inputMode={name==='pincode'?'numeric':undefined}
          pattern={name==='pincode'?'[0-9]{6}':undefined} className="block w-full border p-2" />
      </label>)}
      <div className="flex gap-3 items-center sm:col-span-2">
        <button disabled={saving} className="btn-primary">{saving?'Saving…':'Save address'}</button>
        <button disabled={saving} type="button" onClick={() => setEditing(false)}>Cancel</button>
      </div>
    </form> : <button type="button" className="btn-primary mt-6" onClick={() => setEditing(true)}>Add a delivery address</button>}
  </section>;
}
