// lib/notifications/types.ts
// Final consolidated type surface

export type NotificationChannel = "EMAIL" | "SMS" | "WHATSAPP" | "SLACK";

// Alias for v26.3b channel adapters
export type Channel = NotificationChannel;

export type NotificationEvent =
  // ── Order lifecycle ─────────────────────────────────
  | "ORDER_PLACED" | "ORDER_CONFIRMED" | "ORDER_PACKED"
  | "ORDER_SHIPPED" | "ORDER_OUT_FOR_DELIVERY" | "ORDER_DELIVERED"
  | "ORDER_CANCELLED" | "ORDER_REFUNDED"
  | "ORDER_RETURN_REQUESTED" | "ORDER_RETURN_APPROVED" | "ORDER_RETURN_REJECTED"
  // ── Cart recovery (long + short keys) ──────────────
  | "CART_ABANDONED_T1H" | "CART_ABANDONED_T24H" | "CART_ABANDONED_T72H" | "CART_ABANDONED_T7D"
  | "CART_T1H" | "CART_T24H" | "CART_T72H" | "CART_T7D"
  | "TELECALLER_HANDOFF"
  // ── OTP / auth ──────────────────────────────────────
  | "OTP_REQUESTED" | "OTP_LOGIN" | "OTP_SIGNUP" | "WELCOME"
  // ── Purchase Order ──────────────────────────────────
  | "PO_SENT" | "PO_CONFIRMED" | "PO_DISPATCHED" | "PO_RECEIVED" | "PO_CLOSED" | "PO_CANCELLED"
  // ── Change requests ─────────────────────────────────
  | "CHANGE_REQUEST_SUBMITTED" | "CHANGE_REQUEST_APPROVED" | "CHANGE_REQUEST_REJECTED"
  // ── Documents ───────────────────────────────────────
  | "DOC_APPROVED" | "DOC_REJECTED"
  // ── Team / invites ──────────────────────────────────
  | "TEAM_INVITED"
  // ── Finance / payouts ───────────────────────────────
  | "PAYOUT_SCHEDULED" | "PAYOUT_PAID"
  | "EXPENSE_PENDING_APPROVAL" | "EXPENSE_APPROVED" | "EXPENSE_REJECTED"
  | "FINANCE_WEEKLY_SUMMARY" | "FINANCE_OVERDUE_DIGEST"
  // ── Marketing ───────────────────────────────────────
  | "MARKETING_APPROVAL_REQUESTED" | "MARKETING_APPROVED" | "MARKETING_REJECTED" | "MARKETING_WITHDRAWN"
  // ── Seller lifecycle ────────────────────────────────
  | "SELLER_CHANGE_REQUEST_SUBMITTED" | "SELLER_CHANGE_REQUEST_APPROVED" | "SELLER_CHANGE_REQUEST_REJECTED"
  | "SELLER_DOC_UPLOADED" | "SELLER_DOC_APPROVED" | "SELLER_DOC_REJECTED"
  | "SELLER_TEAM_INVITED"
  | "SELLER_INVENTORY_SUBMITTED" | "SELLER_INVENTORY_UNDER_REVIEW" | "SELLER_INVENTORY_NEEDS_INFO"
  | "SELLER_INVENTORY_APPROVED" | "SELLER_INVENTORY_REJECTED" | "SELLER_INVENTORY_PUBLISHED"
  | "SELLER_ORDER_READY_TO_DISPATCH"
  | "SELLER_PAYOUT_PAID" | "SELLER_PRODUCT_SOLD" | "SELLER_PRODUCT_TAKEDOWN" | "SELLER_PAYOUT_SCHEDULED";

// Use Set so .has() works
export const CRITICAL_EVENTS: Set<NotificationEvent> = new Set<NotificationEvent>([
  "ORDER_PLACED", "ORDER_CONFIRMED", "ORDER_SHIPPED", "ORDER_DELIVERED",
  "ORDER_CANCELLED", "ORDER_REFUNDED",
  "OTP_REQUESTED", "OTP_LOGIN", "OTP_SIGNUP",
]);

export interface NotificationRecipient {
  userId?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  name?: string;
}

export interface NotifyArgs {
  event: NotificationEvent;
  recipient?: NotificationRecipient;
  recipients?: NotificationRecipient[];
  userId?: string;
  userIds?: string[];
  toAdmins?: boolean;
  data?: Record<string, any>;
  context?: Record<string, any>;
  channels?: NotificationChannel[];
  orderId?: string;
  cartId?: string;
}

export interface SendResult {
  channel?: NotificationChannel;
  ok?: boolean;
  providerRequestId?: string;
  error?: string;
  errorMessage?: string;
  recipient?: string;
  providerResponse?: any;
  permanentFailure?: boolean;
  status?: string;
  providerId?: any;
  [key: string]: any;
}

// Alias used by v26.3b channel adapters
export type ChannelSendResult = SendResult;

// Generic channel adapter contract used by dispatcher.ts
export interface ChannelAdapter {
  channel: NotificationChannel;
  send(args: any): Promise<ChannelSendResult>;
  [key: string]: any;
}

// Dispatch record — widened to accept variables, userId, etc.
export interface DispatchRecord {
  id: string;
  channel: NotificationChannel;
  event: NotificationEvent;
  templateName: string;
  recipient: string;
  status: "queued" | "sent" | "delivered" | "failed" | "read";
  attempt: number;
  variables?: Record<string, any> | null;
  userId?: string | null;
  orderId?: string | null;
  cartId?: string | null;
  [key: string]: any;
}