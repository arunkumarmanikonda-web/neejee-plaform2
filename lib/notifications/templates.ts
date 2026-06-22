// Email templates for every notification event. Each renders to { subject, html }.
// Shared brand header/footer keeps the visual identity consistent across all
// transactional mail — same look as lib/email.ts welcome / order templates.
import type { NotificationEvent } from './types';
import { paiseToRupees } from '@/lib/money';

const PROD_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.neejee.com').replace(/\/$/, '');

// ── Shared chrome ──────────────────────────────────────────────
const brandHeader = `
  <div style="background:#1A1613;padding:36px 24px;text-align:center;">
    <table align="center" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
      <tr>
        <td style="font-family:Georgia,'Playfair Display',serif;color:#F4EFE6;font-size:34px;letter-spacing:0.18em;font-weight:400;padding-right:6px;line-height:1;">NEE</td>
        <td style="padding:0 4px;vertical-align:middle;">
          <div style="width:8px;height:8px;background:#8B2E2A;border-radius:50%;display:inline-block;"></div>
        </td>
        <td style="font-family:Georgia,'Playfair Display',serif;color:#F4EFE6;font-size:34px;letter-spacing:0.18em;font-weight:400;padding-left:6px;line-height:1;">JEE</td>
      </tr>
    </table>
    <div style="font-family:Georgia,serif;color:#A47E3B;font-size:10px;letter-spacing:0.35em;margin-top:14px;font-style:italic;">FOUND · PERSONAL</div>
  </div>`;

const brandFooter = `
  <div style="background:#F4EFE6;padding:28px 24px;text-align:center;color:#6B6862;font-size:12px;border-top:1px solid #1A161320;font-family:Georgia,serif;">
    <p style="margin:0 0 6px;font-style:italic;color:#1A1613;">Found. Personal.</p>
    <p style="margin:0 0 12px;font-size:11px;">Personally received by NEEJEE.</p>
    <p style="margin:0;font-size:11px;">
      <a href="${PROD_URL}" style="color:#8B2E2A;text-decoration:none;">www.neejee.com</a>
      &nbsp;·&nbsp; <a href="mailto:hello@neejee.com" style="color:#8B2E2A;text-decoration:none;">hello@neejee.com</a>
    </p>
  </div>`;

function wrap(inner: string): string {
  return `<div style="max-width:560px;margin:0 auto;background:#fff;font-family:Georgia,serif;">${brandHeader}${inner}${brandFooter}</div>`;
}

function btn(href: string, label: string, color: '#8B2E2A' | '#1A1613' = '#8B2E2A'): string {
  return `<a href="${href}" style="display:inline-block;background:${color};color:#F4EFE6;padding:14px 28px;text-decoration:none;letter-spacing:0.2em;font-size:12px;">${label}</a>`;
}

function block(label: string, title: string, body: string, cta?: { href: string; label: string }): string {
  return `<div style="padding:40px 32px;">
    <p style="font-size:11px;letter-spacing:0.3em;color:#8B2E2A;margin:0 0 8px;">${label}</p>
    <h1 style="font-size:26px;color:#1A1613;margin:0 0 16px;font-weight:400;line-height:1.3;">${title}</h1>
    <div style="color:#6B6862;line-height:1.7;font-size:14px;">${body}</div>
    ${cta ? `<p style="margin-top:32px;">${btn(cta.href, cta.label)}</p>` : ''}
  </div>`;
}

// Light escape for interpolated user-controlled strings into the template
function esc(s: any): string {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Templates ──────────────────────────────────────────────────
// Each takes a typed `data` payload and returns { subject, html, smsText }.
// smsText is used by SMS / WhatsApp channels (short, no HTML).
type Rendered = { subject: string; html: string; smsText: string };

export function renderTemplate(event: NotificationEvent, data: Record<string, any>): Rendered {
  switch (event) {
    // ─────────── Customer orders ───────────
    case 'ORDER_PLACED': {
      const orderNumber = esc(data.orderNumber);
      const total = paiseToRupees(data.totalPaise || 0);
      return {
        subject: `Order ${orderNumber} received · NEEJEE`,
        html: wrap(block(
          'PERSONALLY RECEIVED',
          `Namaste, ${esc((data.customerName || 'friend').split(' ')[0])}.`,
          `<p>Your order <strong>${orderNumber}</strong> is in our hands. Total: <strong>₹${total}</strong>.</p>
           <p>We will inspect, sign, and pack each piece personally before it travels to you.</p>`,
          { href: `${PROD_URL}/order-confirmation?order=${encodeURIComponent(orderNumber)}`, label: 'VIEW ORDER' },
        )),
        smsText: `NEEJEE: Order ${orderNumber} received. Total ₹${total}. Track at ${PROD_URL}/account`,
      };
    }
    case 'ORDER_CONFIRMED': {
      // v23.40.18 — include a one-click invoice download link in the email.
      // Token is passed in from the caller so we don't have to import crypto here.
      const invoiceLink = data.invoiceUrl
        ? `<p style="margin-top:16px;font-size:13px;">
             Your tax invoice is ready.
             <a href="${esc(data.invoiceUrl)}" style="color:#8B2E2A;text-decoration:underline;">Download or print invoice →</a>
           </p>`
        : '';
      return {
        subject: `Payment confirmed · invoice for ${esc(data.orderNumber)}`,
        html: wrap(block(
          'PAYMENT CONFIRMED',
          'Thank you.',
          `<p>Your payment for order <strong>${esc(data.orderNumber)}</strong> has been confirmed. We're preparing it for dispatch.</p>${invoiceLink}`,
          { href: `${PROD_URL}/account?tab=orders`, label: 'VIEW ORDER & INVOICE' },
        )),
        smsText: `NEEJEE: Payment confirmed for ${esc(data.orderNumber)}. Invoice & tracking on your account.`,
      };
    }
    case 'ORDER_SHIPPED': {
      const tracking = data.trackingNumber ? `<p>Tracking: <strong>${esc(data.trackingNumber)}</strong></p>` : '';
      return {
        subject: `Your order is travelling · ${esc(data.orderNumber)}`,
        html: wrap(block(
          'ON ITS WAY',
          'Your order is travelling.',
          `<p>Order <strong>${esc(data.orderNumber)}</strong> shipped via <strong>${esc(data.courier || 'our partner courier')}</strong>.</p>${tracking}`,
          data.trackingUrl ? { href: data.trackingUrl, label: 'TRACK SHIPMENT' } : undefined,
        )),
        smsText: `NEEJEE: Order ${esc(data.orderNumber)} shipped. ${data.trackingNumber ? `Track: ${esc(data.trackingNumber)}` : ''}`,
      };
    }
    case 'ORDER_DELIVERED': {
      return {
        subject: `Welcome home · ${esc(data.orderNumber)}`,
        html: wrap(block(
          'ARRIVED',
          'Welcome home.',
          `<p>Order <strong>${esc(data.orderNumber)}</strong> has been delivered. We hope the piece settles into your life with quiet grace.</p>
           <p style="margin-top:16px;">If you have a moment, we'd treasure your reflections.</p>`,
          { href: `${PROD_URL}/account?tab=orders`, label: 'WRITE A REVIEW' },
        )),
        smsText: `NEEJEE: Your order ${esc(data.orderNumber)} has been delivered. Welcome home.`,
      };
    }
    case 'ORDER_CANCELLED': {
      return {
        subject: `Order ${esc(data.orderNumber)} cancelled`,
        html: wrap(block(
          'ORDER CANCELLED',
          'Your order has been cancelled.',
          `<p>Order <strong>${esc(data.orderNumber)}</strong> has been cancelled.${data.reason ? ` Reason: ${esc(data.reason)}.` : ''}</p>
           <p>If a payment was made, the refund will be initiated within 5-7 business days.</p>`,
        )),
        smsText: `NEEJEE: Order ${esc(data.orderNumber)} has been cancelled. Refund (if applicable) initiated.`,
      };
    }
    case 'ORDER_REFUNDED': {
      const amt = paiseToRupees(data.amountPaise || 0);
      return {
        subject: `Refund processed for ${esc(data.orderNumber)}`,
        html: wrap(block(
          'REFUND ISSUED',
          'Refund processed.',
          `<p>A refund of <strong>₹${amt}</strong> has been initiated for order <strong>${esc(data.orderNumber)}</strong>.</p>
           <p>It typically reflects in 5-7 business days, depending on your bank.</p>`,
        )),
        smsText: `NEEJEE: Refund of ₹${amt} initiated for ${esc(data.orderNumber)}. Reflects in 5-7 days.`,
      };
    }

    // ─────────── Purchase Orders ───────────
    case 'PO_SENT': {
      return {
        subject: `NEEJEE: New Purchase Order ${esc(data.poNumber)}`,
        html: wrap(block(
          'NEW PURCHASE ORDER',
          `PO ${esc(data.poNumber)}`,
          `<p>You have a new purchase order from NEEJEE.</p>
           <p>Total: <strong>₹${paiseToRupees(data.totalPaise || 0)}</strong> · ${esc(data.lineCount || 0)} line item${data.lineCount === 1 ? '' : 's'}.</p>
           <p>Please review and confirm the PO at your earliest convenience.</p>`,
          { href: `${PROD_URL}/vendor/purchase-orders/${esc(data.poId)}`, label: 'OPEN PO' },
        )),
        smsText: `NEEJEE: New PO ${esc(data.poNumber)} for ₹${paiseToRupees(data.totalPaise || 0)}. Open at ${PROD_URL}/vendor`,
      };
    }
    case 'PO_CONFIRMED': {
      return {
        subject: `Vendor confirmed PO ${esc(data.poNumber)}`,
        html: wrap(block(
          'PO CONFIRMED',
          `${esc(data.vendorName)} confirmed PO ${esc(data.poNumber)}`,
          `<p>The vendor has accepted the PO and will dispatch shortly.</p>`,
          { href: `${PROD_URL}/admin/purchase-orders/${esc(data.poId)}`, label: 'OPEN PO' },
        )),
        smsText: `NEEJEE: ${esc(data.vendorName)} confirmed PO ${esc(data.poNumber)}.`,
      };
    }
    case 'PO_DISPATCHED': {
      const tracking = data.trackingNumber ? `<p>Tracking: <strong>${esc(data.trackingNumber)}</strong></p>` : '';
      return {
        subject: `PO ${esc(data.poNumber)} dispatched`,
        html: wrap(block(
          'PO DISPATCHED',
          `${esc(data.vendorName)} marked PO ${esc(data.poNumber)} dispatched`,
          `${tracking}<p>${data.vendorInvoiceUrl ? 'Vendor uploaded an invoice.' : 'No invoice uploaded yet.'}</p>`,
          { href: `${PROD_URL}/admin/purchase-orders/${esc(data.poId)}`, label: 'OPEN PO' },
        )),
        smsText: `NEEJEE: PO ${esc(data.poNumber)} dispatched by ${esc(data.vendorName)}.`,
      };
    }
    case 'PO_RECEIVED': {
      return {
        subject: `Goods received for PO ${esc(data.poNumber)}`,
        html: wrap(block(
          'GOODS RECEIVED',
          `PO ${esc(data.poNumber)} marked received`,
          `<p>NEEJEE has marked PO <strong>${esc(data.poNumber)}</strong> as received. Payment will be processed per our payment terms.</p>`,
          { href: `${PROD_URL}/vendor/purchase-orders/${esc(data.poId)}`, label: 'OPEN PO' },
        )),
        smsText: `NEEJEE: PO ${esc(data.poNumber)} marked received. Payment processing.`,
      };
    }
    case 'PO_CLOSED': {
      const amt = paiseToRupees(data.totalPaise || 0);
      return {
        subject: `PO ${esc(data.poNumber)} closed · Payment of ₹${amt}`,
        html: wrap(block(
          'PO SETTLED',
          `PO ${esc(data.poNumber)} closed`,
          `<p>Payment of <strong>₹${amt}</strong> for PO <strong>${esc(data.poNumber)}</strong> has been issued.</p>
           <p>You can view the full payout history in your portal.</p>`,
          { href: `${PROD_URL}/vendor/payouts`, label: 'VIEW PAYOUTS' },
        )),
        smsText: `NEEJEE: PO ${esc(data.poNumber)} closed. Payment of ₹${amt} issued.`,
      };
    }
    case 'PO_CANCELLED': {
      return {
        subject: `PO ${esc(data.poNumber)} cancelled`,
        html: wrap(block(
          'PO CANCELLED',
          `PO ${esc(data.poNumber)} cancelled`,
          `<p>${data.reason ? `Reason: ${esc(data.reason)}.` : 'Please reach out if you need clarification.'}</p>`,
        )),
        smsText: `NEEJEE: PO ${esc(data.poNumber)} has been cancelled.`,
      };
    }

    // ─────────── Vendor change requests ───────────
    case 'CHANGE_REQUEST_SUBMITTED': {
      const fields = Array.isArray(data.fields) ? data.fields.join(', ') : '';
      return {
        subject: `${esc(data.vendorName)} submitted a profile change request`,
        html: wrap(block(
          'PROFILE CHANGE PENDING REVIEW',
          `${esc(data.vendorName)} requested changes`,
          `<p>Fields proposed for change: <strong>${esc(fields)}</strong></p>
           <p>Please review with the supporting documents before approving.</p>`,
          { href: `${PROD_URL}/admin/vendor-change-requests`, label: 'REVIEW QUEUE' },
        )),
        smsText: `NEEJEE: ${esc(data.vendorName)} requested profile changes (${esc(fields)}). Review at ${PROD_URL}/admin/vendor-change-requests`,
      };
    }
    case 'CHANGE_REQUEST_APPROVED': {
      const fields = Array.isArray(data.fields) ? data.fields.join(', ') : '';
      return {
        subject: `Your profile changes have been approved`,
        html: wrap(block(
          'CHANGES APPROVED',
          'Your profile has been updated.',
          `<p>The NEEJEE team approved your requested changes to: <strong>${esc(fields)}</strong>.</p>
           ${data.note ? `<p><em>Note from reviewer:</em> ${esc(data.note)}</p>` : ''}`,
          { href: `${PROD_URL}/vendor/profile`, label: 'OPEN PROFILE' },
        )),
        smsText: `NEEJEE: Your profile changes have been approved.`,
      };
    }
    case 'CHANGE_REQUEST_REJECTED': {
      const fields = Array.isArray(data.fields) ? data.fields.join(', ') : '';
      return {
        subject: `Your profile change request needs attention`,
        html: wrap(block(
          'CHANGES NEED ATTENTION',
          'We couldn\'t apply your requested changes.',
          `<p>Your request to change <strong>${esc(fields)}</strong> was not approved.</p>
           ${data.note ? `<p><em>Note from reviewer:</em> ${esc(data.note)}</p>` : ''}
           <p>You can resubmit the request with corrected information or different supporting documents.</p>`,
          { href: `${PROD_URL}/vendor/change-requests`, label: 'OPEN REQUESTS' },
        )),
        smsText: `NEEJEE: Your profile change was not approved. See ${PROD_URL}/vendor/change-requests`,
      };
    }

    // ─────────── Vendor documents ───────────
    case 'DOC_APPROVED': {
      return {
        subject: `Document approved · ${esc(data.docType)}`,
        html: wrap(block(
          'DOCUMENT APPROVED',
          'Document verified.',
          `<p>Your <strong>${esc(data.docTypeLabel || data.docType)}</strong> has been reviewed and approved by the NEEJEE finance team.</p>`,
          { href: `${PROD_URL}/vendor/documents`, label: 'OPEN DOCUMENTS' },
        )),
        smsText: `NEEJEE: Your ${esc(data.docTypeLabel || data.docType)} has been approved.`,
      };
    }
    case 'DOC_REJECTED': {
      return {
        subject: `Document needs attention · ${esc(data.docType)}`,
        html: wrap(block(
          'DOCUMENT REJECTED',
          'We couldn\'t verify your document.',
          `<p>Your <strong>${esc(data.docTypeLabel || data.docType)}</strong> was not approved.</p>
           ${data.note ? `<p><em>Note from reviewer:</em> ${esc(data.note)}</p>` : ''}
           <p>Please re-upload a clearer or corrected version.</p>`,
          { href: `${PROD_URL}/vendor/documents`, label: 'OPEN DOCUMENTS' },
        )),
        smsText: `NEEJEE: Your ${esc(data.docTypeLabel || data.docType)} was not approved. Re-upload at ${PROD_URL}/vendor/documents`,
      };
    }

    // ─────────── Vendor team ───────────
    case 'TEAM_INVITED': {
      const loginUrl = data.loginUrl || `${PROD_URL}/vendor/login`;
      return {
        subject: `${esc(data.invitedByVendorName)} invited you to NEEJEE Vendor Portal`,
        html: wrap(block(
          'YOU\'RE INVITED',
          `${esc(data.invitedByVendorName)} invited you to their NEEJEE portal`,
          `<p>You've been added as a team member with <strong>${esc((data.accessLevel || '').replace('_', ' ').toLowerCase())}</strong> access.</p>`,
          { href: loginUrl, label: 'ACCEPT INVITATION' },
        )),
        smsText: `NEEJEE: ${esc(data.invitedByVendorName)} invited you to their vendor portal. Accept at ${loginUrl}`,
      };
    }

    // ─────────── Vendor finance ───────────
    case 'PAYOUT_SCHEDULED': {
      const net = paiseToRupees(data.netPaise || 0);
      return {
        subject: `Payment scheduled · ₹${net}`,
        html: wrap(block(
          'PAYMENT SCHEDULED',
          `₹${net} scheduled to your account`,
          `<p>A payout of <strong>₹${net}</strong> is scheduled for <strong>${esc(data.scheduledFor || 'shortly')}</strong>.</p>
           ${data.poNumbers ? `<p>Covering POs: ${esc(data.poNumbers)}</p>` : ''}`,
          { href: `${PROD_URL}/vendor/payouts`, label: 'VIEW PAYOUTS' },
        )),
        smsText: `NEEJEE: Payment of ₹${net} scheduled. See ${PROD_URL}/vendor/payouts`,
      };
    }
    case 'PAYOUT_PAID': {
      const net = paiseToRupees(data.netPaise || 0);
      const utr = data.transactionRef ? `<p>UTR: <strong>${esc(data.transactionRef)}</strong></p>` : '';
      return {
        subject: `Payment of ₹${net} sent`,
        html: wrap(block(
          'PAYMENT SENT',
          `₹${net} has been wired to you`,
          `<p>Your payout of <strong>₹${net}</strong> has been transferred. Funds should reflect in your account shortly.</p>${utr}`,
          { href: `${PROD_URL}/vendor/payouts`, label: 'VIEW PAYOUTS' },
        )),
        smsText: `NEEJEE: Payment of ₹${net} sent.${data.transactionRef ? ` UTR: ${esc(data.transactionRef)}` : ''}`,
      };
    }

    case 'EXPENSE_PENDING_APPROVAL': {
      return {
        subject: `Expense pending approval: ₹${esc(data.amount)} — ${esc(data.category)}`,
        html: wrap(block(
          'APPROVAL REQUESTED',
          `An expense entry needs your review`,
          `<p><strong>${esc(data.description)}</strong></p>
           <p>Category: ${esc(data.category)}<br/>
              Amount: ₹${esc(data.amount)}<br/>
              Submitted by: ${esc(data.createdByEmail)}</p>`,
          { href: `${PROD_URL}/admin/finance/expenses?status=PENDING`, label: 'REVIEW NOW' },
        )),
        smsText: `NEEJEE: Expense ₹${esc(data.amount)} pending approval.`,
      };
    }
    case 'EXPENSE_APPROVED': {
      return {
        subject: `Expense approved: ${esc(data.description)}`,
        html: wrap(block(
          'APPROVED',
          `Your expense entry is approved`,
          `<p><strong>${esc(data.description)}</strong> (₹${esc(data.amount)}) has been approved by ${esc(data.reviewerEmail)}.</p>
           ${data.note ? `<p>Note: <em>${esc(data.note)}</em></p>` : ''}`,
          { href: `${PROD_URL}/admin/finance/expenses`, label: 'VIEW EXPENSES' },
        )),
        smsText: `NEEJEE: Expense ₹${esc(data.amount)} approved.`,
      };
    }
    case 'EXPENSE_REJECTED': {
      return {
        subject: `Expense rejected: ${esc(data.description)}`,
        html: wrap(block(
          'REJECTED',
          `Your expense entry was rejected`,
          `<p><strong>${esc(data.description)}</strong> (₹${esc(data.amount)}) was rejected by ${esc(data.reviewerEmail)}.</p>
           ${data.note ? `<p>Reason: <em>${esc(data.note)}</em></p>` : '<p>Please review and resubmit.</p>'}`,
          { href: `${PROD_URL}/admin/finance/expenses`, label: 'VIEW EXPENSES' },
        )),
        smsText: `NEEJEE: Expense ₹${esc(data.amount)} rejected.`,
      };
    }
    case 'FINANCE_WEEKLY_SUMMARY': {
      const narrativeHtml = String(data.narrative || '')
        .split('\n\n')
        .map((p: string) => `<p>${esc(p).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')}</p>`)
        .join('');
      return {
        subject: `NEEJEE weekly P&L — ${esc(data.periodLabel)}`,
        html: wrap(block(
          'WEEKLY P&L BRIEFING',
          esc(data.periodLabel),
          `${narrativeHtml}
           <hr style="border:none;border-top:1px solid #ddd;margin:24px 0"/>
           <p style="font-size:12px;color:#888">Revenue ${esc(data.revenue)} · Gross profit ${esc(data.grossProfit)} · Net profit ${esc(data.netProfit)} · ${esc(data.orderCount)} orders</p>`,
          { href: `${PROD_URL}/admin/finance/pnl`, label: 'OPEN FULL REPORT' },
        )),
        smsText: `NEEJEE weekly P&L: revenue ${esc(data.revenue)}, net profit ${esc(data.netProfit)} (${esc(data.orderCount)} orders).`,
      };
    }

    // ── Seller portal templates ───────────────────────────────
    case 'SELLER_CHANGE_REQUEST_SUBMITTED': {
      return {
        subject: `Seller change request: ${esc(data.sellerName)}`,
        html: wrap(block(
          'CHANGE REQUEST',
          `${esc(data.sellerName)} requested a profile change`,
          `<p>Fields: <strong>${esc(data.fields)}</strong></p>${data.reason ? `<p>Reason: <em>${esc(data.reason)}</em></p>` : ''}`,
          { href: `${PROD_URL}/admin/seller-change-requests?status=PENDING`, label: 'REVIEW NOW' },
        )),
        smsText: `NEEJEE: ${esc(data.sellerName)} requested profile change (${esc(data.fields)}).`,
      };
    }
    case 'SELLER_CHANGE_REQUEST_APPROVED': {
      return {
        subject: `Your studio change is approved`,
        html: wrap(block(
          'APPROVED',
          `Your profile change is live`,
          `<p>Fields updated: <strong>${esc(data.fields)}</strong></p>${data.note ? `<p>Note: <em>${esc(data.note)}</em></p>` : ''}`,
          { href: `${PROD_URL}/seller/profile`, label: 'VIEW PROFILE' },
        )),
        smsText: `NEEJEE: Your studio change is approved.`,
      };
    }
    case 'SELLER_CHANGE_REQUEST_REJECTED': {
      return {
        subject: `Your studio change needs revisiting`,
        html: wrap(block(
          'REJECTED',
          `We've sent back your change request`,
          `<p>Fields: <strong>${esc(data.fields)}</strong></p>${data.note ? `<p>Reason: <em>${esc(data.note)}</em></p>` : '<p>Please review and resubmit.</p>'}`,
          { href: `${PROD_URL}/seller/change-requests`, label: 'OPEN REQUESTS' },
        )),
        smsText: `NEEJEE: Change request rejected. ${data.note ? esc(data.note) : ''}`,
      };
    }
    case 'SELLER_DOC_UPLOADED': {
      return {
        subject: `${esc(data.sellerName)} uploaded ${esc(data.docType)}`,
        html: wrap(block(
          'DOCUMENT UPLOADED',
          `New document from ${esc(data.sellerName)}`,
          `<p>Type: <strong>${esc(data.docType)}</strong></p><p>File: ${esc(data.fileName)}</p>`,
          { href: `${PROD_URL}/admin/sellers`, label: 'REVIEW' },
        )),
        smsText: `NEEJEE: ${esc(data.sellerName)} uploaded ${esc(data.docType)}.`,
      };
    }
    case 'SELLER_DOC_APPROVED': {
      return {
        subject: `Document approved`,
        html: wrap(block('APPROVED', `Your ${esc(data.docType)} is approved`,
          `<p>Your document <strong>${esc(data.docType)}</strong> has been approved.</p>`,
          { href: `${PROD_URL}/seller/documents`, label: 'VIEW DOCUMENTS' })),
        smsText: `NEEJEE: ${esc(data.docType)} approved.`,
      };
    }
    case 'SELLER_DOC_REJECTED': {
      return {
        subject: `Document needs revisiting`,
        html: wrap(block('ACTION NEEDED', `Your ${esc(data.docType)} was rejected`,
          `<p>Reason: <em>${esc(data.note || 'Please re-upload')}</em></p>`,
          { href: `${PROD_URL}/seller/documents`, label: 'RE-UPLOAD' })),
        smsText: `NEEJEE: ${esc(data.docType)} rejected. Please re-upload.`,
      };
    }
    case 'SELLER_TEAM_INVITED': {
      return {
        subject: `You've been invited to ${esc(data.sellerName)} on NEEJEE`,
        html: wrap(block(
          'TEAM INVITATION',
          `Welcome to ${esc(data.sellerName)}`,
          `<p>You've been invited as <strong>${esc(data.accessLevel)}</strong>. Click below to sign in.</p>`,
          { href: esc(data.inviteUrl), label: 'ACCEPT INVITATION' },
        )),
        smsText: `NEEJEE: You're invited to ${esc(data.sellerName)}. ${esc(data.inviteUrl)}`,
      };
    }
    case 'SELLER_INVENTORY_SUBMITTED': {
      return {
        subject: `New inventory submission: ${esc(data.sellerName)}`,
        html: wrap(block(
          'INVENTORY SUBMITTED',
          `${esc(data.sellerName)} submitted ${esc(data.submissionType)}`,
          `<p>Item: <strong>${esc(data.productName)}</strong></p>`,
          { href: `${PROD_URL}/admin/seller-inventory?status=SUBMITTED`, label: 'OPEN QUEUE' },
        )),
        smsText: `NEEJEE: ${esc(data.sellerName)} submitted inventory (${esc(data.productName)}).`,
      };
    }
    case 'SELLER_INVENTORY_UNDER_REVIEW': {
      return {
        subject: `We're reviewing your submission`,
        html: wrap(block('UNDER REVIEW', `${esc(data.productName)}`,
          `<p>We've picked up your submission for review. We'll be in touch shortly.</p>`,
          { href: `${PROD_URL}/seller/inventory`, label: 'VIEW SUBMISSION' })),
        smsText: `NEEJEE: "${esc(data.productName)}" is under review.`,
      };
    }
    case 'SELLER_INVENTORY_NEEDS_INFO': {
      return {
        subject: `We need a bit more information`,
        html: wrap(block('INFO NEEDED', `${esc(data.productName)}`,
          `<p>${esc(data.note)}</p>`,
          { href: `${PROD_URL}/seller/inventory`, label: 'RESPOND' })),
        smsText: `NEEJEE: Info needed for "${esc(data.productName)}". ${esc(data.note)}`,
      };
    }
    case 'SELLER_INVENTORY_APPROVED': {
      return {
        subject: `Your submission is approved`,
        html: wrap(block('APPROVED', `${esc(data.productName)} approved`,
          `<p>Your submission is approved. It will go live on the storefront once we publish it.</p>${data.note ? `<p><em>${esc(data.note)}</em></p>` : ''}`,
          { href: `${PROD_URL}/seller/inventory`, label: 'VIEW' })),
        smsText: `NEEJEE: "${esc(data.productName)}" approved.`,
      };
    }
    case 'SELLER_INVENTORY_REJECTED': {
      return {
        subject: `Your submission was returned`,
        html: wrap(block('REJECTED', `${esc(data.productName)}`,
          `<p>Reason: <em>${esc(data.note)}</em></p>`,
          { href: `${PROD_URL}/seller/inventory`, label: 'OPEN' })),
        smsText: `NEEJEE: "${esc(data.productName)}" rejected. ${esc(data.note)}`,
      };
    }
    case 'SELLER_INVENTORY_PUBLISHED': {
      return {
        subject: `✨ Your product is live!`,
        html: wrap(block('PUBLISHED', `${esc(data.productName)} is live on NEEJEE`,
          `<p>Congratulations — your work is now visible to customers on the storefront.</p>`,
          { href: `${PROD_URL}/seller/products`, label: 'VIEW PRODUCTS' })),
        smsText: `NEEJEE: "${esc(data.productName)}" is now live on the storefront!`,
      };
    }
    case 'SELLER_PRODUCT_SOLD': {
      return {
        subject: `Order received: ${esc(data.productName)}`,
        html: wrap(block(
          'NEW SALE',
          `${esc(data.productName)} just sold`,
          `<p>Order <strong>${esc(data.orderNumber)}</strong> · Quantity ${esc(data.quantity)}</p>
           <p>Buyer details will be shared once we mark the order ready to dispatch.</p>`,
          { href: `${PROD_URL}/seller/orders`, label: 'VIEW ORDER' },
        )),
        smsText: `NEEJEE: New sale — "${esc(data.productName)}" (${esc(data.orderNumber)})`,
      };
    }
    case 'SELLER_ORDER_READY_TO_DISPATCH': {
      return {
        subject: `Buyer info ready for ${esc(data.orderNumber)}`,
        html: wrap(block(
          'READY TO DISPATCH',
          `Order ${esc(data.orderNumber)}`,
          `<p>Full shipping address and buyer details are now visible in your dashboard. Please pack and dispatch within 48 hours.</p>`,
          { href: `${PROD_URL}/seller/orders/${esc(data.orderNumber)}`, label: 'OPEN ORDER' },
        )),
        smsText: `NEEJEE: Order ${esc(data.orderNumber)} ready to dispatch. Buyer info available.`,
      };
    }
    case 'SELLER_PRODUCT_TAKEDOWN': {
      return {
        subject: `Product taken down`,
        html: wrap(block('TAKEDOWN', `${esc(data.productName)}`,
          `<p>This product has been taken down. Reason: <em>${esc(data.reason || 'Admin decision')}</em></p>
           <p>Existing orders will be fulfilled normally.</p>`,
          { href: `${PROD_URL}/seller/products`, label: 'VIEW PRODUCTS' })),
        smsText: `NEEJEE: "${esc(data.productName)}" taken down. ${esc(data.reason || '')}`,
      };
    }
    case 'SELLER_PAYOUT_SCHEDULED': {
      return {
        subject: `Payout of ₹${esc(data.amount)} scheduled`,
        html: wrap(block('PAYOUT SCHEDULED', `₹${esc(data.amount)} scheduled`,
          `<p>For period ${esc(data.periodLabel)}. Expected payout: <strong>${esc(data.expectedDate || 'within 3 business days')}</strong></p>`,
          { href: `${PROD_URL}/seller/payouts`, label: 'VIEW PAYOUTS' })),
        smsText: `NEEJEE: Payout ₹${esc(data.amount)} scheduled.`,
      };
    }
    case 'SELLER_PAYOUT_PAID': {
      return {
        subject: `Payment of ₹${esc(data.amount)} sent`,
        html: wrap(block('PAID', `₹${esc(data.amount)} transferred`,
          `<p>UTR: <strong>${esc(data.utr || '—')}</strong></p>`,
          { href: `${PROD_URL}/seller/payouts`, label: 'VIEW PAYOUTS' })),
        smsText: `NEEJEE: ₹${esc(data.amount)} paid. ${data.utr ? `UTR: ${esc(data.utr)}` : ''}`,
      };
    }

    // ── Marketing maker-checker ────────────────────────────
    case 'MARKETING_APPROVAL_REQUESTED': {
      return {
        subject: `Marketing approval needed: ${esc(data.summary)}`,
        html: wrap(block(
          'APPROVAL NEEDED',
          `${esc(data.resourceType)} — "${esc(data.summary)}"`,
          `<p>Submitted by <strong>${esc(data.createdByEmail)}</strong>. Please review before it goes out.</p>`,
          { href: `${PROD_URL}/admin/marketing-approvals?status=PENDING`, label: 'OPEN QUEUE' },
        )),
        smsText: `NEEJEE: Marketing approval needed — "${esc(data.summary)}".`,
      };
    }
    case 'MARKETING_APPROVED': {
      return {
        subject: `Your ${esc(data.resourceType)} is approved`,
        html: wrap(block('APPROVED', `Your ${esc(data.resourceType)} is approved`,
          `<p>Approved by ${esc(data.reviewerEmail)}.</p>${data.note ? `<p>Note: <em>${esc(data.note)}</em></p>` : ''}`,
          { href: `${PROD_URL}/admin/marketing-approvals?status=APPROVED`, label: 'OPEN' })),
        smsText: `NEEJEE: ${esc(data.resourceType)} approved.`,
      };
    }
    case 'MARKETING_REJECTED': {
      return {
        subject: `Your ${esc(data.resourceType)} needs revisiting`,
        html: wrap(block('REJECTED', `${esc(data.resourceType)} returned`,
          `<p>Reviewer: ${esc(data.reviewerEmail)}</p>${data.note ? `<p>Reason: <em>${esc(data.note)}</em></p>` : '<p>Please update and resubmit.</p>'}`,
          { href: `${PROD_URL}/admin/marketing-approvals?status=REJECTED`, label: 'OPEN' })),
        smsText: `NEEJEE: ${esc(data.resourceType)} rejected. ${data.note ? esc(data.note) : ''}`,
      };
    }
    case 'MARKETING_WITHDRAWN': {
      return {
        subject: `${esc(data.resourceType)} withdrawn`,
        html: wrap(block('WITHDRAWN', `${esc(data.resourceType)} withdrawn from queue`,
          `<p>${esc(data.note || 'No reason given')}</p>`)),
        smsText: `NEEJEE: ${esc(data.resourceType)} withdrawn.`,
      };
    }

    case 'FINANCE_OVERDUE_DIGEST': {
      const list = String(data.firstFew || '').split('\n').map(l => `<p style="margin:4px 0">${esc(l)}</p>`).join('');
      return {
        subject: `${esc(data.count)} overdue bill${data.count === 1 ? '' : 's'} — ₹${esc(data.totalOutstanding)} outstanding`,
        html: wrap(block(
          'OVERDUE BILLS',
          `${esc(data.count)} bills past due`,
          `<p>Total outstanding: <strong>₹${esc(data.totalOutstanding)}</strong></p>${list}`,
          { href: `${PROD_URL}/admin/finance/bills?status=OVERDUE`, label: 'OPEN BILLS' },
        )),
        smsText: `NEEJEE: ${esc(data.count)} overdue bills — ₹${esc(data.totalOutstanding)} outstanding.`,
      };
    }

    default: {
      // Fallback so a missing template never crashes the engine
      return {
        subject: `NEEJEE notification`,
        html: wrap(block('NOTIFICATION', 'NEEJEE update', `<pre>${esc(JSON.stringify(data, null, 2))}</pre>`)),
        smsText: `NEEJEE update: ${event}`,
      };
    }
  }
}
