import type { NotificationEvent } from './types';

export function orderWhatsAppEvent(event: NotificationEvent) {
  switch (event) {
    case 'ORDER_CONFIRMED':
    case 'ORDER_PLACED':
    case 'ORDER_SHIPPED':
    case 'ORDER_OUT_FOR_DELIVERY':
    case 'ORDER_DELIVERED':
    case 'ORDER_CANCELLED':
      return event;
    default:
      return null;
  }
}

export function orderWhatsAppEnabled() {
  return process.env.WHATSAPP_ENABLED !== 'false' && Boolean(process.env.AISENSY_API_KEY?.trim());
}

type Subscriber = {
  phone: string | null;
  whatsappOptIn: boolean;
  notificationPref: { whatsappOptIn: boolean } | null;
};

export function orderWhatsAppPhone(customer?: Subscriber | null) {
  return (customer?.notificationPref?.whatsappOptIn ?? customer?.whatsappOptIn) ? customer?.phone : null;
}
