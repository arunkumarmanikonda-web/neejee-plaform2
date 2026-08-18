import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';
import { sendSellerTransactionalEmail } from '@/lib/seller-onboarding/transactional-email';
import {
  buildWorkflowForInstrument,
  createCommercialInstrument,
  getCurrentEffectiveInstrument,
  getLatestRelationshipInstrument,
  listCommercialInstruments,
  listRelationshipEvents,
  markInstrumentIssued,
  normalizeTerms,
  parseCommercialDate,
  relationshipReferences,
  synchronizeEffectiveCommercialTerms,
  type CommercialInstrumentType,
} from '@/lib/seller-commercial-lifecycle';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function actionToType(value: unknown): CommercialInstrumentType {
  const action = String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (['INITIAL', 'CREATE_INITIAL', 'INITIAL_AGREEMENT'].includes(action)) return 'INITIAL';
  if (['ADDENDUM', 'CREATE_ADDENDUM'].includes(action)) return 'ADDENDUM';
  if (['RENEW', 'RENEWAL', 'CREATE_RENEWAL'].includes(action)) return 'RENEWAL';
  if (['END', 'TERMINATE', 'TERMINATION', 'CREATE_TERMINATION'].includes(action)) return 'TERMINATION';
  throw new Error('Unsupported commercial lifecycle action.');
}

function instrumentEmail(input: {
  firstName: string;
  businessName: string;
  instrumentTitle: string;
  instrumentNumber: string;
  type: CommercialInstrumentType;
  validFrom: string;
  validTo: string;
  signingUrl?: string | null;
  reason?: string | null;
}) {
  const actionCopy = input.type === 'TERMINATION'
    ? 'A termination instrument has been prepared for the seller relationship.'
    : input.type === 'ADDENDUM'
      ? 'A commercial addendum has been prepared for the current seller agreement.'
      : input.type === 'RENEWAL'
        ? 'A renewal agreement has been prepared for the next commercial term.'
        : 'Your initial NEEJEE marketplace seller agreement has been prepared.';

  return `
    <div style="max-width:620px;margin:0 auto;font-family:Georgia,serif;color:#1c1917;background:#fff;">
      <div style="background:#1A1613;color:#F4EFE6;padding:34px;text-align:center;">
        <div style="font-size:29px;letter-spacing:.18em;">NEEJEE</div>
        <div style="font-size:10px;letter-spacing:.32em;color:#B79B6C;margin-top:10px;">FOUND. PERSONAL.</div>
      </div>
      <div style="padding:38px 34px;">
        <p style="font-size:15px;">Dear ${escapeHtml(input.firstName || 'Seller')},</p>
        <p style="line-height:1.7;">${escapeHtml(actionCopy)}</p>
        <div style="background:#F7F2E9;padding:18px;margin:22px 0;line-height:1.7;">
          <strong>${escapeHtml(input.instrumentTitle)}</strong><br/>
          Reference: ${escapeHtml(input.instrumentNumber)}<br/>
          Validity: ${escapeHtml(input.validFrom)}${input.validTo ? ` to ${escapeHtml(input.validTo)}` : ''}<br/>
          Seller: ${escapeHtml(input.businessName)}
          ${input.reason ? `<br/>Reason / context: ${escapeHtml(input.reason)}` : ''}
        </div>
        ${input.signingUrl ? `
          <p style="line-height:1.7;">Please review the instrument and complete the secure signing process.</p>
          <p style="margin:28px 0;"><a href="${escapeHtml(input.signingUrl)}" style="display:inline-block;background:#1A1613;color:#fff;padding:13px 20px;text-decoration:none;">Review & sign</a></p>
        ` : `<p style="line-height:1.7;">The instrument is being prepared in the NEEJEE legal workbench. You will receive the secure review/signing link when it is issued.</p>`}
        <p style="line-height:1.7;">All prior agreements, addenda and renewals remain part of the permanent NEEJEE relationship record and are referenced by subsequent instruments.</p>
      </div>
    </div>`;
}

async function loadSeller(id: string) {
  return prisma.seller.findUnique({
    where: { id },
    select: {
      id: true,
      businessName: true,
      contactName: true,
      email: true,
      phone: true,
      kycStatus: true,
      commissionPct: true,
      qualityScore: true,
      payoutCycle: true,
      isNeejeeSelect: true,
      autoKycSummary: true,
    },
  });
}

async function lifecyclePayload(id: string) {
  await synchronizeEffectiveCommercialTerms(id).catch(() => []);
  const [instruments, events, current, latest] = await Promise.all([
    listCommercialInstruments(id),
    listRelationshipEvents(id),
    getCurrentEffectiveInstrument(id),
    getLatestRelationshipInstrument(id),
  ]);

  return {
    instruments,
    events,
    current,
    latest,
    counts: {
      total: instruments.length,
      addenda: instruments.filter((item) => item.instrumentType === 'ADDENDUM').length,
      renewals: instruments.filter((item) => item.instrumentType === 'RENEWAL').length,
      terminations: instruments.filter((item) => item.instrumentType === 'TERMINATION').length,
    },
  };
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const seller = await loadSeller(params.id);
  if (!seller) return NextResponse.json({ error: 'Seller not found' }, { status: 404 });

  const lifecycle = await lifecyclePayload(params.id);
  return NextResponse.json({ seller, ...lifecycle });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const seller = await loadSeller(params.id);
    if (!seller) return NextResponse.json({ error: 'Seller not found' }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const type = actionToType(body.action || body.instrumentType);
    const validFrom = parseCommercialDate(body.validFrom, type === 'TERMINATION' ? 'Termination effective date' : 'Valid from');
    const validTo = type === 'TERMINATION'
      ? null
      : parseCommercialDate(body.validTo, 'Valid until');

    if (type !== 'INITIAL' && !['APPROVED', 'SUSPENDED'].includes(String(seller.kycStatus))) {
      return NextResponse.json(
        { error: 'Addenda, renewals and termination instruments are available only after the seller relationship has been approved.' },
        { status: 400 },
      );
    }

    if (type !== 'TERMINATION' && validTo && validTo <= validFrom) {
      return NextResponse.json({ error: 'Valid until must be later than Valid from.' }, { status: 400 });
    }

    const terms = normalizeTerms({
      commissionPct: body.commissionPct ?? seller.commissionPct,
      qualityScore: body.qualityScore ?? seller.qualityScore,
      payoutCycle: body.payoutCycle ?? seller.payoutCycle,
      isNeejeeSelect: body.isNeejeeSelect ?? seller.isNeejeeSelect,
      paymentTerms: body.paymentTerms,
      settlementBasis: body.settlementBasis,
      returnsCommercialTreatment: body.returnsCommercialTreatment,
      marketingContribution: body.marketingContribution,
      logisticsCommercialTerms: body.logisticsCommercialTerms,
      taxTreatment: body.taxTreatment,
      otherTerms: body.otherTerms,
    });

    const instrument = await createCommercialInstrument({
      seller,
      type,
      validFrom,
      validTo,
      terms,
      changeReason: String(body.changeReason || '').trim(),
      actorUserId: user?.id || null,
    });

    if (!instrument) throw new Error('Commercial instrument could not be created.');

    const allInstruments = await listCommercialInstruments(seller.id);
    const prior = allInstruments.filter((item) => item.id !== instrument.id);
    const references = relationshipReferences(prior);
    const nextSummary = buildWorkflowForInstrument({
      sellerSummary: seller.autoKycSummary,
      instrument,
      terms,
      references,
    });

    await prisma.seller.update({
      where: { id: seller.id },
      data: {
        autoKycSummary: nextSummary as any,
        ...(type === 'INITIAL'
          ? {
              commissionPct: terms.commissionPct,
              qualityScore: terms.qualityScore,
              payoutCycle: terms.payoutCycle,
              isNeejeeSelect: terms.isNeejeeSelect,
            }
          : {}),
      },
      select: { id: true },
    });

    let signingUrl = '';
    let emailSent = false;
    let warning = '';
    const autoIssue = body.autoIssue !== false && String(seller.kycStatus) === 'APPROVED';

    if (autoIssue) {
      try {
        const workflowUrl = new URL(`/api/admin/sellers/${seller.id}/agreement-workflow`, request.url);
        const workflowResponse = await fetch(workflowUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            cookie: request.headers.get('cookie') || '',
          },
          body: JSON.stringify({
            action: 'SEND_FOR_SIGNATURE',
            phone: seller.phone,
          }),
          cache: 'no-store',
        });
        const workflowJson = await workflowResponse.json().catch(() => ({}));
        if (!workflowResponse.ok) {
          throw new Error(workflowJson?.error || 'Could not issue seller signing link.');
        }
        signingUrl = String(workflowJson?.agreement?.sellerSigningUrl || workflowJson?.sellerSigningUrl || '').trim();
        await markInstrumentIssued(instrument.id);
      } catch (error: any) {
        warning = `Instrument created, but the signing link could not be issued automatically: ${String(error?.message || 'unknown error')}`;
      }
    }

    try {
      const firstName = String(seller.contactName || 'Seller').split(/\s+/)[0] || 'Seller';
      await sendSellerTransactionalEmail({
        to: seller.email,
        subject: `${instrument.title} — NEEJEE seller relationship`,
        html: instrumentEmail({
          firstName,
          businessName: seller.businessName,
          instrumentTitle: instrument.title,
          instrumentNumber: instrument.instrumentNumber,
          type,
          validFrom: instrument.effectiveFrom.toISOString().slice(0, 10),
          validTo: instrument.effectiveTo ? instrument.effectiveTo.toISOString().slice(0, 10) : '',
          signingUrl: signingUrl || null,
          reason: instrument.changeReason,
        }),
      });
      emailSent = true;
    } catch (error: any) {
      warning = [warning, `Seller notification could not be sent: ${String(error?.message || 'unknown error')}`].filter(Boolean).join(' ');
    }

    const lifecycle = await lifecyclePayload(seller.id);
    return NextResponse.json({
      success: true,
      instrument,
      signingUrl: signingUrl || null,
      emailSent,
      autoIssued: !!signingUrl,
      warning: warning || null,
      ...lifecycle,
    });
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || 'Commercial lifecycle action failed') }, { status: 400 });
  }
}
