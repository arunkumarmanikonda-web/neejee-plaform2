// /api/webhooks/razorpayx
// RazorpayX dashboard → webhooks → endpoint here.
// Subscribe to: payout.processed, payout.failed, payout.reversed, payout.updated
//
// Auth: X-Razorpay-Signature header (HMAC-SHA256 of raw body using
// RAZORPAYX_WEBHOOK_SECRET).

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyWebhookSignature } from '@/lib/razorpayx';
import { mapRzpxStatusToVendor, mapRzpxStatusToSeller } from '@/lib/payouts/orchestrator';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Events may repeat or arrive out of order. Only a reversal supersedes a processed payout.
function acceptsStatus(previous: string | null, current: string, incoming: string) {
  const stages: Record<string, number> = { pending: 1, queued: 1, initiated: 1, processing: 2, processed: 3, failed: 3, rejected: 3, cancelled: 3, reversed: 4 };
  if (!Object.prototype.hasOwnProperty.call(stages, incoming)) return false;
  if (previous === incoming || previous === 'reversed') return false;
  if (previous === 'processed' || current === 'PAID') return incoming === 'reversed';
  if (previous && ['failed','rejected','cancelled'].includes(previous)) return false;
  return stages[incoming] >= (stages[previous || ''] || 0);
}

export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get('x-razorpay-signature') || '';
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }
  if (!verifyWebhookSignature(raw, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: any;
  try { payload = JSON.parse(raw); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const event = String(payload?.event || '');
  // payout.* events ship under payload.payload.payout.entity
  const payout = payload?.payload?.payout?.entity;
  if (!event.startsWith('payout.') || !payout) {
    // Acknowledge unknown events so RazorpayX doesn't retry forever
    return NextResponse.json({ ok: true, ignored: event });
  }

  const rzpxId        = String(payout.id || '');
  const rawStatus     = String(payout.status || '').toLowerCase();
  const failureReason = payout.failure_reason || payout.error_description || null;
  const utr           = payout.utr || null;

  if (!rzpxId) {
    return NextResponse.json({ error: 'No payout id in payload' }, { status: 400 });
  }

  // Try VendorPayout first
  const vp = await prisma.vendorPayout.findFirst({
    where: { rzpxPayoutId: rzpxId },
    include: { vendor: true },
  });
  if (vp) {
    const mapped = mapRzpxStatusToVendor(rawStatus);
    if (vp.rzpxStatus === rawStatus && utr && vp.transactionRef !== utr) {
      await prisma.vendorPayout.updateMany({where:{id:vp.id,rzpxPayoutId:rzpxId,rzpxStatus:rawStatus,transactionRef:vp.transactionRef},data:{transactionRef:utr}});
    }
    if (!acceptsStatus(vp.rzpxStatus, vp.status, rawStatus)) return NextResponse.json({ok:true, ignored:true});
    const wasPaid = vp.status === 'PAID';
    const changed = await prisma.vendorPayout.updateMany({
      where: { id: vp.id, rzpxPayoutId: rzpxId, status: vp.status, rzpxStatus: vp.rzpxStatus },
      data: {
        status: mapped,
        rzpxStatus: rawStatus,
        rzpxFailReason: mapped === 'FAILED' ? (failureReason || vp.rzpxFailReason || null) : vp.rzpxFailReason,
        transactionRef: utr || vp.transactionRef,
        paidAt: mapped === 'PAID' ? (vp.paidAt || new Date()) : vp.paidAt,
      },
    });

    if (!changed.count) return NextResponse.json({error:'Retry payout event'}, {status:503});

    // v23.37: fire PAYOUT_PAID notification once (only on transition to PAID)
    if (mapped === 'PAID' && !wasPaid) {
      try {
        const { notify } = await import('@/lib/notifications');
        const vendor: any = vp.vendor;
        const phoneStr: string = vendor?.contactPhone ? String(vendor.contactPhone) : '';
        const emailStr: string = vendor?.contactEmail ? String(vendor.contactEmail) : '';
        if (phoneStr || emailStr) {
          const amountRs = Math.round((vp.netPaise || 0) / 100);
          const vendorNameStr: string = (vendor?.displayName || vendor?.legalName) ? String(vendor.displayName || vendor.legalName) : '';
          notify({
            event: 'PAYOUT_PAID',
            recipients: [{
              ...(phoneStr ? { phone: phoneStr } : {}),
              ...(emailStr ? { email: emailStr } : {}),
              ...(vendorNameStr ? { name: vendorNameStr } : {}),
            }],
            data: {
              vendorName: vendor?.displayName || vendor?.legalName,
              amountPaise: vp.netPaise,
              utr: utr || vp.transactionRef,
              invoiceRef: vp.id,
            },
            context: {
              type: 'VENDOR_PAYOUT',
              id: vp.id,
              smsVars: {
                amount: amountRs.toString(),
                invoice: vp.id.slice(-8).toUpperCase(),
                utr: utr || vp.transactionRef || 'n/a',
              },
            } as any,
          }).catch(e => console.warn('[notify PAYOUT_PAID]', e?.message));
        }
      } catch (e: any) {
        console.warn('[razorpayx webhook] vendor notify failed:', e?.message);
      }
    }

    return NextResponse.json({ ok: true, kind: 'vendor', id: vp.id, status: mapped });
  }

  // Then seller Payout
  const sp = await prisma.payout.findFirst({
    where: { rzpxPayoutId: rzpxId },
    include: { seller: true },
  });
  if (sp) {
    const mapped = mapRzpxStatusToSeller(rawStatus);
    if (sp.rzpxStatus === rawStatus && utr && sp.utr !== utr) {
      await prisma.payout.updateMany({where:{id:sp.id,rzpxPayoutId:rzpxId,rzpxStatus:rawStatus,utr:sp.utr},data:{utr:utr}});
    }
    if (!acceptsStatus(sp.rzpxStatus, sp.status, rawStatus)) return NextResponse.json({ok:true, ignored:true});
    const wasPaid = sp.status === 'PAID';
    const changed = await prisma.payout.updateMany({
      where: { id: sp.id, rzpxPayoutId: rzpxId, status: sp.status, rzpxStatus: sp.rzpxStatus },
      data: {
        status: mapped,
        rzpxStatus: rawStatus,
        rzpxFailReason: mapped === 'ON_HOLD' ? (failureReason || sp.rzpxFailReason || null) : sp.rzpxFailReason,
        utr: utr || sp.utr || rzpxId,
        paidAt: mapped === 'PAID' ? (sp.paidAt || new Date()) : sp.paidAt,
      },
    });

    if (!changed.count) return NextResponse.json({error:'Retry payout event'}, {status:503});

    // v23.37: fire SELLER_PAYOUT_PAID notification once
    if (mapped === 'PAID' && !wasPaid) {
      try {
        const { notify } = await import('@/lib/notifications');
        const seller: any = sp.seller;
        const phoneStr: string = seller?.phone ? String(seller.phone) : '';
        const emailStr: string = seller?.email ? String(seller.email) : '';
        if (phoneStr || emailStr) {
          const amountRs = Math.round((sp.netPayoutPaise || 0) / 100);
          const sellerNameStr: string = (seller?.contactName || seller?.businessName) ? String(seller.contactName || seller.businessName) : '';
          notify({
            event: 'SELLER_PAYOUT_PAID',
            recipients: [{
              ...(phoneStr ? { phone: phoneStr } : {}),
              ...(emailStr ? { email: emailStr } : {}),
              ...(sellerNameStr ? { name: sellerNameStr } : {}),
            }],
            data: {
              sellerName: seller?.contactName || seller?.businessName,
              amountPaise: sp.netPayoutPaise,
              utr: utr || sp.utr,
            },
            context: {
              type: 'SELLER_PAYOUT',
              id: sp.id,
              smsVars: {
                amount: amountRs.toString(),
                utr: utr || sp.utr || 'n/a',
              },
            } as any,
          }).catch(e => console.warn('[notify SELLER_PAYOUT_PAID]', e?.message));
        }
      } catch (e: any) {
        console.warn('[razorpayx webhook] seller notify failed:', e?.message);
      }
    }

    return NextResponse.json({ ok: true, kind: 'seller', id: sp.id, status: mapped });
  }

  // Unknown payout — log but acknowledge
  console.warn('[razorpayx webhook] unknown payout', rzpxId, event);
  return NextResponse.json({ ok: true, kind: 'unmatched', rzpxId });
}
