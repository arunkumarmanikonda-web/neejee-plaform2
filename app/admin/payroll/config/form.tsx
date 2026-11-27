'use client';
import { useState, type FormEvent } from 'react';
import type { PayrollConfig } from '@prisma/client';
const toggles = {pfEnabled:'Provident fund',esiEnabled:'Employee state insurance',tdsEnabled:'Tax deducted at source',ptEnabled:'Professional tax'} as const;
const numbers = {
  pfEmployeeRate:'Employee PF rate (%)', pfEmployerRate:'Employer PF rate (%)', pfWageCeilingPaise:'PF wage ceiling (paise)',
  esiEmployeeRate:'Employee ESI rate (%)',esiEmployerRate:'Employer ESI rate (%)',esiGrossCeilingPaise:'ESI gross ceiling (paise)',
  tdsDefaultRate:'Default TDS rate (%)',payCycleDay:'Pay cycle day',workingDaysPerMonth:'Working days a month',
} as const;
export function PayrollConfiguration({initial,editable}:{initial:PayrollConfig;editable:boolean}) {
  const [message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  async function save(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); const fields=new FormData(event.currentTarget);
    const body:Record<string,string|boolean|number>={ptSlabsJson:String(fields.get('ptSlabsJson')),notes:String(fields.get('notes'))};
    for (const key of Object.keys(toggles)) body[key]=fields.has(key);
    for (const key of Object.keys(numbers)) body[key]=Number(fields.get(key));
    setBusy(true);setMessage('');
    try { const res=await fetch('/api/admin/payroll/config',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      setMessage(res.ok?'Payroll configuration saved.':(await res.json()).error||'Could not save payroll settings.');
    } catch {setMessage('Connection interrupted. Reload to check your settings.');} finally{setBusy(false);}
  }
  return <form onSubmit={save}><fieldset disabled={!editable||busy} className="grid gap-4 sm:grid-cols-2">
    {(Object.keys(toggles) as (keyof typeof toggles)[]).map(key=><label key={key}><input type="checkbox" name={key} defaultChecked={initial[key]}/> {toggles[key]}</label>)}
    {(Object.keys(numbers) as (keyof typeof numbers)[]).map(key=><label key={key}>{numbers[key]}<input className="block w-full border p-2" type="number" min={key==='payCycleDay'||key==='workingDaysPerMonth'?1:0} max={key==='payCycleDay'||key==='workingDaysPerMonth'?31:key.endsWith('Rate')?100:undefined} step={key.endsWith('Rate')?'any':'1'} required name={key} defaultValue={initial[key]}/></label>)}
    <label>Professional tax slabs (JSON)<textarea className="block w-full border p-2" name="ptSlabsJson" defaultValue={initial.ptSlabsJson}/></label>
    <label>Payroll notes<textarea className="block w-full border p-2" name="notes" defaultValue={initial.notes||''}/></label>
    {editable&&<button className="btn-primary" disabled={busy}>Save payroll configuration</button>}</fieldset>
    <p role="status" className="mt-3">{message}</p></form>;
}
