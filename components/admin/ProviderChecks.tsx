'use client';
import { useState } from 'react';

type Result = {providers:{service:string;state:string;http?:number}[];facebook:number|null;instagram:number|null};
export function ProviderChecks() {
  const [result,setResult]=useState<Result|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  async function check() {
    setBusy(true);setError('');
    try {
      const response=await fetch('/api/admin/settings/integrations',{cache:'no-store'});
      if (!response.ok) throw Error();
      setResult(await response.json());
    } catch { setResult(null);setError('Provider checks are unavailable for this session.'); }
    finally {setBusy(false);}
  }
  return <section className="mt-5 text-sm">
    <button type="button" className="btn-outline" disabled={busy} onClick={check}>{busy?'Checking providers…':'Check provider connections'}</button>
    {error && <p role="alert">{error}</p>}
    {result && <div role="status" className="mt-3"><ul>{result.providers.map(p=><li key={p.service}><strong>{p.service}</strong> · {p.state}{p.http ? ' (HTTP '+p.http+')' : ''}</li>)}</ul>
      <p>Facebook Pages eligible to publish · {result.facebook ?? 'Unknown'}<br/>Instagram business accounts connected · {result.instagram ?? 'Unknown'}</p></div>}
  </section>;
}
