// Shiprocket integration — token caching, create order, generate AWB
// Activates when SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD are set.
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
      body: JSON.stringify({
        email: process.env.SHIPROCKET_EMAIL,
        password: process.env.SHIPROCKET_PASSWORD,
      }),
    });
    const data = await res.json();
    if (!data.token) {
      console.warn('[shiprocket] auth failed', data);
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
  subtotalPaise: number;
  paymentMethod: 'COD' | 'Prepaid';
  weight?: number; // kg, default 0.5
  length?: number; // cm
  breadth?: number;
  height?: number;
}

export async function createShipment(args: CreateShipmentArgs) {
  const token = await getToken();
  if (!token) {
    return { ok: false, error: 'Shiprocket not configured', dev: true };
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
      selling_price: Math.round(i.pricePaise / 100),
      hsn: i.hsnCode || '',
    })),
    payment_method: args.paymentMethod,
    sub_total: Math.round(args.subtotalPaise / 100),
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
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.message || 'Shiprocket create failed', raw: data };
    }
    return {
      ok: true,
      shiprocketOrderId: data.order_id,
      shipmentId: data.shipment_id,
      status: data.status,
      raw: data,
    };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export async function generateAwb(shipmentId: string | number, courierId?: string | number) {
  const token = await getToken();
  if (!token) return { ok: false, error: 'Shiprocket not configured' };

  try {
    const res = await fetch(`${SR_BASE}/courier/assign/awb`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        shipment_id: shipmentId,
        ...(courierId ? { courier_id: courierId } : {}),
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.awb_assign_status) {
      return { ok: false, error: data.message || 'AWB generation failed', raw: data };
    }
    const d = data.response?.data || {};
    return {
      ok: true,
      awb: d.awb_code,
      courier: d.courier_name,
      trackingUrl: d.awb_code ? `https://shiprocket.co/tracking/${d.awb_code}` : null,
      raw: data,
    };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}
