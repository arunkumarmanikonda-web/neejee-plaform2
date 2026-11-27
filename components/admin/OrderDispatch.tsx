'use client';
import { useState } from 'react';
import { dispatchPayment,reviewable } from '@/lib/shipping/shiprocket-dispatch';

type InputOrder={orderNumber:string;status:string;paymentMethod:string|null;paymentStatus:string;awbNumber:string|null;
  shiprocketPaymentMode:string|null;shiprocketShipmentId:string|null;shiprocketStage:string|null;shiprocketClaimedAt:string|null};
export function OrderDispatch({order,onChange}:{order:InputOrder;onChange:()=>Promise<void>}) {
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [choice,setChoice]=useState('found');
  const [id,setId]=useState(order.shiprocketShipmentId||'');
  const [awb,setAwb]=useState('');
  const [checked,setChecked]=useState(false);
  const [carrierMode,setCarrierMode]=useState('');
  const expectedMode=dispatchPayment(order);
  const mismatch=!!order.shiprocketShipmentId && !order.shiprocketStage && !!expectedMode && order.shiprocketPaymentMode!==expectedMode;
  const paymentReview=mismatch || order.shiprocketStage==='CHECK_PAYMENT';
  const review=mismatch || reviewable({shiprocketStage:order.shiprocketStage,shiprocketClaimedAt:order.shiprocketClaimedAt?new Date(order.shiprocketClaimedAt):null});
  async function submit(reconcile=false) {
    setBusy(true);setMessage('');
    try {
      const res=await fetch('/api/admin/orders/'+encodeURIComponent(order.orderNumber)+'/shiprocket',{
        method:reconcile?'PATCH':'POST',headers:{'Content-Type':'application/json'},
        ...(reconcile?{body:JSON.stringify({action:choice,shipmentId:choice==='found'?(order.shiprocketShipmentId||id):'',awb:choice==='found'?awb:'',verified:checked,carrierPaymentMode:carrierMode})}:{}),
      });
      const result=await res.json().catch(()=>({}));
      setMessage(result.error||result.message||(res.ok?'Dispatch updated.':'Check carrier status.'));
      if (res.ok || res.status===409 || res.status===503) await onChange();
    } catch {setMessage('Could not reach the console. Refresh the order before trying again.');}
    finally{setBusy(false);}
  }
  return <div className="mt-4 space-y-2 border-t border-mitti/20 pt-3 font-ui text-sm">
    {order.shiprocketShipmentId && <p>Shiprocket shipment {order.shiprocketShipmentId}</p>}
    {review ? <details open><summary className="font-semibold">Reconcile with Shiprocket</summary>
      <p className="mt-2">Search for {order.orderNumber} in the carrier dashboard and check its shipment, AWB and payment method.</p>
      <label className="block mt-2">Dashboard result<select value={choice} onChange={e=>{setChoice(e.target.value);setChecked(false);}} className="w-full p-2 bg-ivory border">
        <option value="found">Matching shipment found</option><option value="absent" disabled={paymentReview}>{order.shiprocketShipmentId?'No AWB assigned to this shipment':'No matching shipment exists'}</option></select></label>
      {choice==='found' && <><label className="block mt-2">Shiprocket shipment ID<input value={order.shiprocketShipmentId||id} readOnly={!!order.shiprocketShipmentId} onChange={e=>{setId(e.target.value);setChecked(false);}} className="w-full p-2 bg-ivory border" inputMode="numeric"/></label>
        <label className="block mt-2">AWB if assigned<input value={awb} onChange={e=>{setAwb(e.target.value);setChecked(false);}} className="w-full p-2 bg-ivory border"/></label></>}
      {choice==='found' && expectedMode && <label className="block mt-2">Payment method shown in Shiprocket (order requires {expectedMode})<select value={carrierMode} onChange={e=>{setCarrierMode(e.target.value);setChecked(false);}} className="w-full p-2 bg-ivory border"><option value="">Select carrier payment method</option><option value="COD">COD</option><option value="Prepaid">Prepaid</option></select></label>}
      <label className="flex gap-2 mt-2"><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)}/>I checked this order and the latest shipment status in Shiprocket.</label>
      <button type="button" className="btn-primary mt-2" disabled={busy||!checked||(paymentReview&&choice==='absent')||(choice==='found'&&!!expectedMode&&carrierMode!==expectedMode)||(choice==='found'&&!(order.shiprocketShipmentId||id).trim())} onClick={()=>void submit(true)}>Save reconciliation</button>
    </details> : order.awbNumber ? <p>AWB {order.awbNumber}</p> : order.shiprocketStage ? <button className="btn-outline" type="button" onClick={()=>void onChange()}>Refresh dispatch status</button> :
    <button type="button" onClick={()=>void submit()} disabled={!dispatchPayment(order)||busy} className="btn-outline w-full disabled:opacity-50">{busy?'Contacting Shiprocket…':order.shiprocketShipmentId?'Assign AWB to saved shipment':'Book with Shiprocket'}</button>}
    {message && <p role="status">{message}</p>}
  </div>;
}
