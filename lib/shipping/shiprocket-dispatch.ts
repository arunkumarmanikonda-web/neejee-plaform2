export type DispatchSnapshot = {
  id:string; status:string; paymentMethod:string|null; paymentStatus:string; awbNumber:string|null; courier:string|null;
  shiprocketShipmentId:string|null; shiprocketOrderId:string|null; shiprocketPaymentMode:string|null; shiprocketStage:string|null; shiprocketClaimedAt:Date|null;
};
export type CarrierState = Partial<Pick<DispatchSnapshot,'shiprocketShipmentId'|'shiprocketOrderId'|'shiprocketPaymentMode'|'shiprocketStage'|'shiprocketClaimedAt'|'awbNumber'|'courier'>>
  & { trackingUrl?:string|null };
export interface DispatchStore {
  read():Promise<DispatchSnapshot|null>;
  change(snapshot:DispatchSnapshot, change:CarrierState, onlyIfEligible?:boolean):Promise<boolean>;
  markPacked(id:string, awb:string):Promise<void>;
}
type Failure = {ok:false; safeToRetry:boolean; error:string};
export type Booking = {ok:true; shipmentId:string; carrierOrderId:string|null} | Failure;
export type Waybill = {ok:true; awb:string; courier:string|null} | Failure;
export type DispatchResult = {code:number; message:string; shipmentId?:string|null; awb?:string; courier?:string|null};
type CarrierOps = {create(method:'COD'|'Prepaid'): Promise<Booking>; assign(id:string):Promise<Waybill>};
const open = ['PLACED','CONFIRMED','PACKED'];
export function dispatchPayment(order:Pick<DispatchSnapshot,'status'|'paymentMethod'|'paymentStatus'>): 'COD'|'Prepaid'|null {
  if (!open.includes(order.status)) return null;
  if (order.paymentStatus==='PAID') return 'Prepaid';
  return order.paymentMethod==='COD' && order.paymentStatus==='PENDING' ? 'COD' : null;
}
export function reviewable(order:Pick<DispatchSnapshot,'shiprocketStage'|'shiprocketClaimedAt'>, now=Date.now()) {
  if (order.shiprocketStage==='CHECK_BOOKING' || order.shiprocketStage==='CHECK_AWB' || order.shiprocketStage==='CHECK_PAYMENT') return true;
  return (order.shiprocketStage==='BOOKING' || order.shiprocketStage==='ASSIGNING') &&
    !!order.shiprocketClaimedAt && now-order.shiprocketClaimedAt.getTime() >= 5*60_000;
}
const blocked=(message:string):DispatchResult=>({code:409,message});
export const trackingLink=(awb:string)=>'https://shiprocket.co/tracking/'+encodeURIComponent(awb);
export const validShipmentId=(id:unknown)=>/^\d{1,20}$/.test(String(id||'')) && !/^0+$/.test(String(id));
export const validAwb=(awb:unknown)=>/^[\w-]{3,64}$/.test(String(awb||''));
export async function bookDispatch(store:DispatchStore, carrier:CarrierOps):Promise<DispatchResult> {
  let row=await store.read();
  if (!row) return {code:404,message:'Order not found.'};
  if (!row.shiprocketStage && row.shiprocketShipmentId && dispatchPayment(row) && row.shiprocketPaymentMode!==dispatchPayment(row)) {
    await store.change(row,{shiprocketStage:'CHECK_PAYMENT',shiprocketClaimedAt:null},true);
    return blocked('Payment has changed. Verify the carrier collection method for this shipment.');
  }
  if (row.shiprocketStage==='CHECK_PAYMENT') return blocked('Confirm the collection method in Shiprocket.');
  if (row.awbNumber) {
    if (row.shiprocketShipmentId && row.status!=='PACKED' && dispatchPayment(row)) await store.markPacked(row.id,row.awbNumber);
    return {code:200,message:'Tracking already recorded.',awb:row.awbNumber,courier:row.courier,shipmentId:row.shiprocketShipmentId};
  }
  const method=dispatchPayment(row);
  if (!method) return blocked('Check payment and fulfilment status before dispatch.');
  if (row.shiprocketStage) return blocked(reviewable(row) ? 'Check the carrier dashboard and reconcile this dispatch.' : 'Another dispatch request is in progress.');
  if (!row.shiprocketShipmentId) {
    const claim:CarrierState={shiprocketStage:'BOOKING',shiprocketClaimedAt:new Date()};
    if (!await store.change(row,claim,true)) return blocked('The order changed. Refresh to see the latest dispatch.');
    const held={...row,...claim};
    const booking=await carrier.create(method);
    if (!booking.ok) {
      await store.change(held,{shiprocketStage:booking.safeToRetry?null:'CHECK_BOOKING',shiprocketClaimedAt:null});
      return {code:booking.safeToRetry?503:409,message:booking.error};
    }
    if (!await store.change(held,{shiprocketShipmentId:booking.shipmentId,shiprocketOrderId:booking.carrierOrderId,shiprocketPaymentMode:method,shiprocketStage:null,shiprocketClaimedAt:null})) {
      return blocked('Check the shipment in the carrier dashboard before continuing.');
    }
    row=await store.read();
    if (!row || !dispatchPayment(row) || row.awbNumber || row.shiprocketStage) return blocked('Booking was saved. Refresh to review the current order.');
  }
  if (!row.shiprocketShipmentId) return blocked('Check the shipment reference before continuing.');
  if (row.shiprocketPaymentMode!==dispatchPayment(row)) {
    await store.change(row,{shiprocketStage:'CHECK_PAYMENT',shiprocketClaimedAt:null},true);
    return blocked('Payment changed during booking. Confirm the collection method in Shiprocket.');
  }
  const shipmentId=row.shiprocketShipmentId;
  const claim:CarrierState={shiprocketStage:'ASSIGNING',shiprocketClaimedAt:new Date()};
  if (!await store.change(row,claim,true)) return blocked('The order changed. Refresh to see the latest dispatch.');
  const held={...row,...claim};
  const waybill=await carrier.assign(shipmentId);
  if (!waybill.ok) {
    await store.change(held,{shiprocketStage:waybill.safeToRetry?null:'CHECK_AWB',shiprocketClaimedAt:null});
    return {code:waybill.safeToRetry?503:409,message:waybill.error,shipmentId};
  }
  if (!await store.change(held,{awbNumber:waybill.awb,courier:waybill.courier,trackingUrl:trackingLink(waybill.awb),shiprocketStage:null,shiprocketClaimedAt:null})) {
    return blocked('A waybill was assigned. Check the carrier dashboard before continuing.');
  }
  await store.markPacked(row.id,waybill.awb);
  return {code:200,message:'Waybill assigned.',shipmentId,awb:waybill.awb,courier:waybill.courier};
}
