'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
type Employee={id:string;employeeCode:string;firstName:string;lastName:string|null};
type Row={employeeId:string;daysWorked:number;leavesPaid:number;leavesUnpaid:number;overtimeHours:number;notes:string|null;employee:{employeeCode:string}};
const fields={daysWorked:'Days worked',leavesPaid:'Paid leave days',leavesUnpaid:'Unpaid leave days',overtimeHours:'Overtime hours'} as const;
export function MonthlyAttendance({period,employees,rows,editable}:{period:string;employees:Employee[];rows:Row[];editable:boolean}) {
  const [id,setId]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');const router=useRouter();
  const existing=rows.find(r=>r.employeeId===id);
  async function save(event:FormEvent<HTMLFormElement>){
    event.preventDefault();const [year,month]=period.split('-').map(Number),data=new FormData(event.currentTarget);
    const body={employeeId:id,year,month,notes:data.get('notes'),...Object.fromEntries(Object.keys(fields).map(key=>[key,Number(data.get(key))]))};
    setBusy(true);setMessage('');
    try{const res=await fetch('/api/admin/payroll/attendance',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      if(!res.ok)throw Error((await res.json()).error||'Attendance could not be saved.');
      setMessage('Attendance saved.');router.refresh();
    }catch(e){setMessage(e instanceof Error?e.message:'Connection interrupted.');}finally{setBusy(false);}
  }
  return <><ul>{rows.map(row=><li key={row.employeeId}><Link href={'/admin/payroll/employees/'+encodeURIComponent(row.employeeId)}>{row.employee.employeeCode}</Link> · {row.daysWorked} days worked · {row.overtimeHours} hours overtime</li>)}</ul>
    {!rows.length&&<p>No attendance recorded for this month.</p>}
    {editable&&employees.length>0&&<form onSubmit={save} className="space-y-4"><label>Employee <select value={id} onChange={e=>setId(e.target.value)} required><option value="">Select an employee</option>{employees.map(e=><option key={e.id} value={e.id}>{e.employeeCode} · {e.firstName} {e.lastName}</option>)}</select></label>
      {id&&<fieldset key={id} disabled={busy} className="grid gap-3 sm:grid-cols-2">{(Object.keys(fields) as (keyof typeof fields)[]).map(k=><label key={k}>{fields[k]}<input className="block border p-2" name={k} required type="number" min="0" max={k==='overtimeHours'?744:31} step={k==='overtimeHours'?'any':'1'} defaultValue={existing?.[k]??0}/></label>)}
      <label>Notes<textarea className="block border p-2" name="notes" defaultValue={existing?.notes||''}/></label>
      <button className="btn-primary">Save attendance</button></fieldset>}</form>}
    <p role="status">{message}</p></>;
}
