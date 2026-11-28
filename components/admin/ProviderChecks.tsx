'use client';
import { useState } from 'react';

type Result = {providers:{service:string;state:string;http?:number}[];facebook:number|null;instagram:number|null};
export function ProviderChecks({canEdit}:{canEdit:boolean}) {
  const [result,setResult]=useState<Result|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [delivery,setDelivery]=useState('');
  async function runProviderAction(sms=false) {
    setBusy(true);setDelivery('');
    try {
      const res=await fetch('/api/admin/settings/integrations'+(sms?'/sms':''),{method:'POST'});
      const data=await res.json();
      setDelivery(data.message || data.error || 'The provider could not confirm this request.');
    } catch {setDelivery('The provider could not confirm this request.');}
    finally {setBusy(false);}
  }
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
    <button type="button" className="btn-outline ml-2" disabled={busy} onClick={()=>runProviderAction()}>Test email with Resend’s simulator</button>
    {canEdit && <button type="button" className="btn-outline ml-2" disabled={busy} onClick={()=>runProviderAction(true)}>Connect Fast2SMS delivery reports</button>}
    <details className="mt-3"><summary>Provider callback addresses</summary>
      <ul><li>Shiprocket tracking · https://www.neejee.com/api/webhooks/courier</li>
        <li>Fast2SMS reports · https://www.neejee.com/api/webhooks/fast2sms</li>
        <li>AiSensy delivery reports · https://www.neejee.com/api/webhooks/aisensy</li>
        <li>RazorpayX payouts · https://www.neejee.com/api/webhooks/razorpayx</li></ul>
    </details>
    {delivery && <p role="status">{delivery}</p>}
    {error && <p role="alert">{error}</p>}
    {result && <div role="status" className="mt-3"><ul>{result.providers.map(p=><li key={p.service}><strong>{p.service}</strong> · {p.state}{p.http ? ' (HTTP '+p.http+')' : ''}</li>)}</ul>
      <p>Facebook Pages eligible to publish · {result.facebook ?? 'Unknown'}<br/>Instagram business accounts connected · {result.instagram ?? 'Unknown'}</p></div>}
  </section>;
}
