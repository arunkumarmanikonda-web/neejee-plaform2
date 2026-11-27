// Shiprocket integration — token caching, create order, generate AWB
// Activates when SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD are set.
import { validAwb,validShipmentId,type Booking,type Waybill } from './shipping/shiprocket-dispatch';
const SR_BASE = 'https://apiv2.shiprocket.in/v1/external';

let cachedToken: { token: string; expiresAt: number } | null = null;

export function shiprocketConfigured() {
  return Boolean(process.env.SHIPROCKET_EMAIL && process.env.SHIPROCKET_PASSWORD);
}

async function getToken(): Promise<string | null> {
  if (!shiprocketConfigured()) return null;
  // Cache for 9 days (token valid 10)
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.token;

  try {
    const res = await fetch(`${SR_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(9000),
      body: JSON.stringify({
        email: process.env.SHIPROCKET_EMAIL,
        password: process.env.SHIPROCKET_PASSWORD,
      }),
    });
    const data = await res.json();
    if (!data.token) {
      console.warn('[shiprocket] authentication was rejected');
      return null;
    }
    cachedToken = { token: data.token, expiresAt: Date.now() + 9 * 24 * 60 * 60 * 1000 };
    return data.token;
  } catch (e: any) {
    console.warn('[shiprocket] auth exception', e.message);
    return null;
  }
}

export interface CreateShipmentArgs {
  orderNumber: string;
  orderDate: Date;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  billing: {
    address: string;
    city: string;
    state: string;
    pincode: string;
  };
  items: Array<{ name: string; sku: string; quantity: number; pricePaise: number; hsnCode?: string }>;
  totalPaise: number;
  shippingPaise: number;
  giftWrapPaise: number;
  discountPaise: number;
  paymentMethod: 'COD' | 'Prepaid';
  weight?: number; // kg, default 0.5
  length?: number; // cm
  breadth?: number;
  height?: number;
}

export async function createShipment(args: CreateShipmentArgs):Promise<Booking> {
  const token = await getToken();
  if (!token) {
    return {ok:false,safeToRetry:true,error:'Carrier login failed before the booking was sent.'};
  }

  const pickupLocation = process.env.SHIPROCKET_PICKUP_LOCATION || 'Primary';

  const payload = {
    order_id: args.orderNumber,
    order_date: args.orderDate.toISOString().slice(0, 10),
    pickup_location: pickupLocation,
    billing_customer_name: args.customerName.split(' ')[0],
    billing_last_name: args.customerName.split(' ').slice(1).join(' ') || '.',
    billing_address: args.billing.address,
    billing_city: args.billing.city,
    billing_state: args.billing.state,
    billing_pincode: args.billing.pincode,
    billing_country: 'India',
    billing_email: args.customerEmail,
    billing_phone: args.customerPhone,
    shipping_is_billing: true,
    order_items: args.items.map((i) => ({
      name: i.name,
      sku: i.sku,
      units: i.quantity,
      selling_price: i.pricePaise / 100,
      hsn: i.hsnCode || '',
    })),
    payment_method: args.paymentMethod,
    sub_total: args.totalPaise / 100,
    shipping_charges: args.shippingPaise / 100,
    giftwrap_charges: args.giftWrapPaise / 100,
    total_discount: args.discountPaise / 100,
    length: args.length || 25,
    breadth: args.breadth || 20,
    height: args.height || 10,
    weight: args.weight || 0.5,
  };

  try {
    const res = await fetch(`${SR_BASE}/orders/create/adhoc`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      signal:AbortSignal.timeout(14000),
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && validShipmentId(data?.shipment_id)) {
      return {ok:true,shipmentId:String(data.shipment_id),carrierOrderId:validShipmentId(data.order_id)?String(data.order_id):null};
    }
    if ([401,403,429].includes(res.status)) {
      if (res.status===401) cachedToken=null;
      return {ok:false,safeToRetry:true,error:'The carrier rejected the booking before submission. Check access or retry later.'};
    }
    return {ok:false,safeToRetry:false,error:'Booking needs reconciliation. Search Shiprocket for the Neejee order number before trying again.'};
  } catch {
    return {ok:false,safeToRetry:false,error:'The carrier did not confirm the booking. Check Shiprocket for the order number.'};
  }
}

export async function generateAwb(shipmentId:string):Promise<Waybill> {
  const token=await getToken();
  if (!token) return {ok:false,safeToRetry:true,error:'Shipment saved. Carrier login failed before the waybill request.'};
  try {
    const res=await fetch(SR_BASE+'/courier/assign/awb',{
      method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
      signal:AbortSignal.timeout(14000),body:JSON.stringify({shipment_id:shipmentId}),
    });
    const data=await res.json().catch(()=>null);
    const details=data?.response?.data;
    if (res.ok && (data?.awb_assign_status===1 || data?.awb_assign_status==='1' || data?.awb_assign_status===true) && validAwb(details?.awb_code)) {
      return {ok:true,awb:String(details.awb_code),courier:typeof details.courier_name==='string'?details.courier_name:null};
    }
    if ([401,403,429].includes(res.status)) {
      if (res.status===401) cachedToken=null;
      return {ok:false,safeToRetry:true,error:'Shipment saved. The carrier rejected the waybill request. Retry this shipment later.'};
    }
    return {ok:false,safeToRetry:false,error:'Shipment saved. Check its AWB in Shiprocket, then reconcile the waybill.'};
  } catch {
    return {ok:false,safeToRetry:false,error:'Shipment saved. Check whether Shiprocket assigned an AWB before retrying.'};
  }
}
