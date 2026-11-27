type ShippingDetails = Partial<Record<'name' | 'line1' | 'line2' | 'city' | 'state' | 'pincode', unknown>>;

export function orderShippingAddress(userId: string | undefined, address: ShippingDetails | null, phone: unknown) {
  const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
  const name = text(address?.name);
  const line1 = text(address?.line1);
  const city = text(address?.city);
  const state = text(address?.state);
  const pincode = String(address?.pincode ?? '').trim();
  const mobile = String(phone ?? '').trim();
  if (!name || !line1 || !city || !state || !/^\d{6}$/.test(pincode) || !/^[+\d()\s-]+$/.test(mobile) || !/^\d{10,15}$/.test(mobile.replace(/\D/g, ''))) {
    throw new Error('INVALID_ORDER_SHIPPING_ADDRESS');
  }
  return {
    userId: userId || null, name, phone: mobile, line1, line2: text(address?.line2) || null,
    city, state, pincode, country: 'IN',
  };
}
