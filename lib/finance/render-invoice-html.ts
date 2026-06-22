// v23.40.15 — Server-side HTML renderer for NEEJEE branded invoices.
// Returns a complete <html> document string (own <head>, own <body>) so the
// print route can serve it as raw text/html, completely bypassing the admin
// layout chrome ("Finance" header, sidebar, etc.).
//
// Design follows the NEEJEE Brand Book:
//   • Ivory Cotton paper (#F4EFE6) background with subtle texture
//   • Kohl Black ink (#1A1613) for text
//   • Madder Red (#8B2E2A) accents (bindi, dividers, totals)
//   • Mitti Brown (#6B4423) for secondary text
//   • Playfair Display serif for display type, Inter for body & UI
//   • Decorative dividers inspired by the "Personal Library" motifs
//   • Inline SVG wordmark — no external image dependencies

import { formatINR } from '@/lib/money';
import { numberToWordsINR } from '@/lib/finance/number-to-words';
import type { IssuerProfile } from '@/lib/finance/legal-entity';

function esc(v: any): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Strip auto-generated boilerplate from notes; return null if nothing genuine remains. */
function visibleNotes(notes: string | null | undefined): string | null {
  if (!notes) return null;
  // Drop common auto-generated patterns; what's left is the human note (if any)
  const cleaned = notes
    .replace(/Auto[- ]generated from website order[^.]*\.?/gi, '')
    .replace(/\[Auto[^\]]*\]/gi, '')
    .trim();
  return cleaned.length > 0 ? cleaned : null;
}

/** Convert badge tokens like FOUNDERS_EDIT → "Founder's Edit" for invoice display. */
function prettyBadge(raw: string): string {
  if (!raw) return '';
  const t = raw.trim().toUpperCase();
  const map: Record<string, string> = {
    FOUNDERS_EDIT: "Founder's Edit",
    NEEJEE_SELECT: 'NEEJEE Select',
    ARTISAN_MADE: 'Artisan Made',
    AUTHENTICITY_GUARANTEED: 'Authenticity Guaranteed',
    SLOW_MADE: 'Slow Made',
    HAND_MADE: 'Hand Made',
    HANDLOOM_MARK: 'Handloom Mark',
    SILK_MARK: 'Silk Mark',
    GI_TAG: 'GI Tag',
    FAIR_TRADE: 'Fair Trade',
    LIMITED_EDITION: 'Limited Edition',
    ONE_OF_ONE: 'One of One',
  };
  if (map[t]) return map[t];
  // Generic fallback: SLOW_MADE → Slow Made
  return raw.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

/** Tiny SVG seal/medal beside each product badge. Uses the badge name as a key. */
function badgeSeal(name: string): string {
  const n = (name || '').toLowerCase();
  // Pick an icon based on keyword — simple but recognisable
  if (n.includes('gi') || n.includes('handloom mark') || n.includes('silk mark')) {
    return `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#8B2E2A" stroke-width="2"><circle cx="12" cy="9" r="7"/><path d="M7 14l-2 7 7-3 7 3-2-7"/></svg>`;
  }
  if (n.includes('fair') || n.includes('artisan')) {
    return `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#5A6F3F" stroke-width="2"><path d="M12 2L4 6v6c0 5 8 10 8 10s8-5 8-10V6l-8-4z"/></svg>`;
  }
  if (n.includes('hand')) {
    return `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#6B4423" stroke-width="2"><path d="M9 11V6a2 2 0 014 0v5m0-1a2 2 0 014 0v4a6 6 0 01-6 6h-1a6 6 0 01-6-6v-3l2-1"/></svg>`;
  }
  // Default: a small bindi-style dot
  return `<svg width="7" height="7" viewBox="0 0 8 8"><circle cx="4" cy="4" r="3" fill="#8B2E2A"/></svg>`;
}

/** Pull a human-readable order ref from the invoice notes / orderId. */
function extractOrderRef(inv: any): string | null {
  if (!inv) return null;
  // Pattern matches the auto-note "Auto-generated from website order NEE-W545NPP2."
  const m = (inv.notes || '').match(/order\s+([A-Z0-9-]+)/i);
  if (m) return m[1].replace(/[.,]$/, '');
  // Otherwise return the orderId itself (truncated to last 8 chars for readability)
  if (inv.orderId) return inv.orderId.length > 12 ? '…' + inv.orderId.slice(-8).toUpperCase() : inv.orderId.toUpperCase();
  return null;
}

const BRAND_MARK_SVG = (variant: 'kohl' | 'ivory' = 'kohl', showTagline = true) => {
  const text  = variant === 'kohl' ? '#1A1613' : '#F4EFE6';
  const muted = variant === 'kohl' ? '#6B6862' : '#E8DFCF';
  // Wider viewBox + textLength on each half so the wordmark CANNOT clip.
  // Layout: NEE (140w) — gap — bindi — gap — JEE (140w), centred in 540 wide canvas.
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 170" role="img" aria-label="NEEJEE" preserveAspectRatio="xMidYMid meet" style="display:block; width:100%; height:auto; overflow:visible;">
      <text x="230" y="100" text-anchor="end" font-family="'Playfair Display','PT Serif',Georgia,serif" font-weight="600" font-size="86" letter-spacing="4" fill="${text}">NEE</text>
      <circle cx="270" cy="74" r="11" fill="#8B2E2A"/>
      <text x="310" y="100" text-anchor="start" font-family="'Playfair Display','PT Serif',Georgia,serif" font-weight="600" font-size="86" letter-spacing="4" fill="${text}">JEE</text>
      ${showTagline ? `<text x="270" y="142" text-anchor="middle" font-family="'Inter','Helvetica Neue',Arial,sans-serif" font-weight="500" font-size="13" letter-spacing="6" fill="${muted}">FOUND &#183; PERSONAL</text>` : ''}
    </svg>
  `;
};

// Decorative divider from the "Personal Library" motifs: a thin Mitti line,
// a Madder bindi, a thin line — used as section separators
const DIVIDER = `
  <div class="nj-divider" aria-hidden="true">
    <span class="nj-divider-line"></span>
    <span class="nj-divider-dot"></span>
    <span class="nj-divider-line"></span>
  </div>
`;

function renderOneInvoice(inv: any, issuer: IssuerProfile, pageBreak: boolean = false): string {
  const status = (inv.paymentStatus || 'UNPAID').toLowerCase();
  const outstanding = inv.totalPaise - inv.paidPaise;
  const realPayments = (inv.payments || []).filter((p: any) => p.amountPaise > 0);
  const refunds      = (inv.payments || []).filter((p: any) => p.amountPaise < 0);

  const issuedLabel = new Date(inv.issuedOn).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  const dueLabel    = inv.dueOn ? new Date(inv.dueOn).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : null;

  // Order number (snipped from notes if present, otherwise from orderId)
  const orderRef = extractOrderRef(inv);
  // For retail (B2C/POS) invoices, PAN + CIN are NOT required — only GSTIN.
  // For B2B / BULK we show them (they're often demanded by the recipient's accountant).
  const isRetail = inv.invoiceType === 'B2C' || inv.invoiceType === 'POS';

  return `
  <article class="nj-invoice" ${pageBreak ? 'style="page-break-after: always;"' : ''}>
    <!-- WORDMARK + DOC META BAND -->
    <header class="nj-header">
      <div class="nj-mark">${BRAND_MARK_SVG('kohl', true)}</div>
      <div class="nj-meta">
        <div class="nj-doc-type">Tax Invoice</div>
        <div class="nj-doc-no">${esc(inv.invoiceNumber)}</div>
        ${orderRef ? `<div class="nj-doc-order">Order · <b>${esc(orderRef)}</b></div>` : ''}
        <div class="nj-doc-date">Issued ${esc(issuedLabel)}</div>
        ${dueLabel ? `<div class="nj-doc-date">Due ${esc(dueLabel)}</div>` : ''}
        <div class="nj-status nj-status-${esc(status)}">${esc((inv.paymentStatus || 'UNPAID').replace(/_/g, ' '))}</div>
      </div>
    </header>

    ${DIVIDER}

    <!-- ISSUER (NEEJEE) BAND — fed live from the Legal Entity record -->
    <section class="nj-issuer">
      <div>
        <div class="nj-label">From</div>
        <div class="nj-issuer-name">${esc(issuer.legalName)}</div>
        <div class="nj-line" style="white-space: pre-line">${esc(issuer.addressMultiline)}</div>
        ${issuer.email ? `<div class="nj-line">${esc(issuer.email)}</div>` : ''}
        ${issuer.phone ? `<div class="nj-line">${esc(issuer.phone)}</div>` : ''}
      </div>
      <div>
        ${issuer.gstin ? `
          <div class="nj-label">GSTIN</div>
          <div class="nj-mono">${esc(issuer.gstin)}</div>
        ` : ''}
        ${!isRetail && issuer.pan ? `
          <div class="nj-label" style="margin-top:8px">PAN</div>
          <div class="nj-mono">${esc(issuer.pan)}</div>
        ` : ''}
        ${!isRetail && issuer.cin ? `
          <div class="nj-label" style="margin-top:8px">CIN</div>
          <div class="nj-mono">${esc(issuer.cin)}</div>
        ` : ''}
      </div>
      <div>
        <div class="nj-label">Web</div>
        <div class="nj-line">${esc(issuer.website)}</div>
      </div>
    </section>

    <!-- BILL / SHIP -->
    <section class="nj-parties">
      <div class="nj-party">
        <div class="nj-label">Bill to</div>
        <div class="nj-party-name">${esc(inv.customerName)}</div>
        ${inv.customerGstin ? `<div class="nj-line nj-mono">GSTIN ${esc(inv.customerGstin)}</div>` : ''}
        ${inv.customerEmail ? `<div class="nj-line">${esc(inv.customerEmail)}</div>` : ''}
        ${inv.customerPhone ? `<div class="nj-line">${esc(inv.customerPhone)}</div>` : ''}
        ${inv.billingAddress ? `<div class="nj-line" style="margin-top:6px; white-space:pre-wrap">${esc(inv.billingAddress)}</div>` : ''}
      </div>
      <div class="nj-party">
        <div class="nj-label">Ship to</div>
        ${inv.shippingAddress
          ? `<div class="nj-line" style="white-space:pre-wrap">${esc(inv.shippingAddress)}</div>`
          : inv.billingAddress
            ? `<div class="nj-line" style="white-space:pre-wrap">${esc(inv.billingAddress)}</div>`
            : `<div class="nj-line">Same as billing</div>`}
        ${inv.placeOfSupply ? `<div class="nj-line" style="margin-top:6px">Place of supply: <b>${esc(inv.placeOfSupply)}</b></div>` : ''}
      </div>
    </section>

    <!-- LINE ITEMS — with the craft story under each description -->
    <table class="nj-lines">
      <thead>
        <tr>
          <th class="w-num">#</th>
          <th>Description &amp; craft</th>
          <th>HSN/SAC</th>
          <th class="r">Qty</th>
          <th class="r">Rate</th>
          <th class="r">Disc.</th>
          <th class="r">Taxable</th>
          <th class="r">GST</th>
          <th class="r">Total</th>
        </tr>
      </thead>
      <tbody>
        ${(inv.lines || []).map((l: any, i: number) => {
          const p = l.product;
          // Build the origin tag (Banarasi · Varanasi)
          const originBits = [p?.craft, p?.region].filter(Boolean);
          const origin = originBits.length ? originBits.join(' · ') : null;
          // Trim story to ~140 chars so the line stays compact; longer stories live on web
          const storyLine = (p?.story || p?.craftNote || '').trim();
          const storyShort = storyLine.length > 140 ? storyLine.slice(0, 138).trimEnd() + '…' : storyLine;
          const badges = Array.isArray(p?.badges) ? p.badges : [];
          // Humanise badge tokens: FOUNDERS_EDIT → Founder's Edit, NEEJEE_SELECT → NEEJEE Select.
          const prettyBadges = badges.map((b: string) => prettyBadge(b));
          return `
          <tr>
            <td class="r nj-muted">${i + 1}</td>
            <td>
              <div class="nj-desc">${esc(l.description)}</div>
              ${origin ? `<div class="nj-origin">${esc(origin)}${p?.artisanName ? ` · by <i>${esc(p.artisanName)}</i>` : ''}</div>` : ''}
              ${storyShort ? `<div class="nj-story">“${esc(storyShort)}”</div>` : ''}
              ${prettyBadges.length ? `<div class="nj-badges">${prettyBadges.map((b: string) => `<span class="nj-badge">${esc(b)}</span>`).join('<span class="nj-badge-sep">·</span>')}</div>` : ''}
            </td>
            <td class="nj-mono nj-muted">${esc(l.hsnSac || '—')}</td>
            <td class="r">${esc(l.quantity)}</td>
            <td class="r">${formatINR(l.unitPricePaise)}</td>
            <td class="r nj-muted">${l.discountPaise ? formatINR(l.discountPaise) : '—'}</td>
            <td class="r">${formatINR(l.taxableValuePaise)}</td>
            <td class="r">
              ${l.gstRatePercent || 0}%<br/>
              <span class="nj-sub">${formatINR((l.cgstPaise || 0) + (l.sgstPaise || 0) + (l.igstPaise || 0))}</span>
            </td>
            <td class="r" style="font-weight:600">${formatINR(l.totalPaise)}</td>
          </tr>
        `;}).join('')}
      </tbody>
    </table>

    <!-- AMOUNT IN WORDS + TOTALS -->
    <div class="nj-totals-wrap">
      <div>
        <div class="nj-words">
          <div class="nj-label">Amount in words</div>
          <div>${esc(numberToWordsINR(inv.totalPaise))} only</div>
        </div>
        ${visibleNotes(inv.notes) ? `
          <div class="nj-notes">
            <div class="nj-label">A note from us</div>
            <div style="white-space:pre-wrap">${esc(visibleNotes(inv.notes))}</div>
          </div>` : ''}
      </div>
      <table class="nj-totals" style="margin-top:0">
        <tbody>
          <tr><td class="l">Taxable value</td><td class="r">${formatINR(inv.taxableValuePaise)}</td></tr>
          ${inv.discountPaise > 0 ? `<tr><td class="l">Discount</td><td class="r">– ${formatINR(inv.discountPaise)}</td></tr>` : ''}
          ${inv.cgstPaise > 0 ? `<tr><td class="l">CGST</td><td class="r">${formatINR(inv.cgstPaise)}</td></tr>` : ''}
          ${inv.sgstPaise > 0 ? `<tr><td class="l">SGST</td><td class="r">${formatINR(inv.sgstPaise)}</td></tr>` : ''}
          ${inv.igstPaise > 0 ? `<tr><td class="l">IGST</td><td class="r">${formatINR(inv.igstPaise)}</td></tr>` : ''}
          ${inv.shippingPaise > 0 ? `<tr><td class="l">Shipping</td><td class="r">${formatINR(inv.shippingPaise)}</td></tr>` : ''}
          ${inv.shippingTaxPaise > 0 ? `<tr><td class="l">Shipping GST</td><td class="r">${formatINR(inv.shippingTaxPaise)}</td></tr>` : ''}
          ${inv.roundOffPaise ? `<tr><td class="l">Round-off</td><td class="r">${formatINR(inv.roundOffPaise)}</td></tr>` : ''}
          <tr class="grand">
            <td class="l">TOTAL</td>
            <td class="r">${formatINR(inv.totalPaise)}</td>
          </tr>
          ${inv.paidPaise > 0 ? `<tr class="paid"><td class="l">Paid</td><td class="r">${formatINR(inv.paidPaise)}</td></tr>` : ''}
          ${outstanding > 0 ? `<tr class="due"><td class="l">Balance due</td><td class="r">${formatINR(outstanding)}</td></tr>` : ''}
        </tbody>
      </table>
    </div>

    <!-- PAYMENT HISTORY -->
    ${(realPayments.length > 0 || refunds.length > 0) ? `
      <section class="nj-payments">
        <h3>Payment history</h3>
        <table>
          <thead><tr><th>Date</th><th>Method</th><th>Reference</th><th class="r">Amount</th></tr></thead>
          <tbody>
            ${realPayments.map((p: any) => `
              <tr>
                <td>${new Date(p.paidOn).toLocaleDateString('en-IN')}</td>
                <td>${esc(p.method || '—')}</td>
                <td>${esc(p.reference || '—')}</td>
                <td class="r">${formatINR(p.amountPaise)}</td>
              </tr>`).join('')}
            ${refunds.map((p: any) => `
              <tr class="refund">
                <td>${new Date(p.paidOn).toLocaleDateString('en-IN')}</td>
                <td>REFUND${p.method ? ` (${esc(p.method)})` : ''}</td>
                <td>${esc(p.reference || p.notes || '—')}</td>
                <td class="r">– ${formatINR(Math.abs(p.amountPaise))}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </section>
    ` : ''}

    ${DIVIDER}

    <!-- BANK + TERMS -->
    <section class="nj-bank-terms">
      <div>
        <div class="nj-label">Bank details for payment</div>
        <div class="nj-line"><b>${esc(issuer.bankAccountName || issuer.legalName)}</b></div>
        ${issuer.bankName || issuer.bankAccountNumber ? `
          <div class="nj-line">${esc(issuer.bankName)}${issuer.bankBranch ? `, ${esc(issuer.bankBranch)}` : ''}${issuer.bankAccountNumber ? ` · A/C <span class="nj-mono">${esc(issuer.bankAccountNumber)}</span>` : ''}</div>
        ` : ''}
        ${issuer.bankIfsc ? `<div class="nj-line">IFSC <span class="nj-mono">${esc(issuer.bankIfsc)}</span></div>` : ''}
      </div>
      <div>
        <div class="nj-label">Terms</div>
        <div class="nj-line">Payment due as per invoice terms. Goods governed by ${esc(issuer.brandName)} return policy at ${esc(issuer.website)}/returns. Disputes subject to ${esc(issuer.city || 'Mumbai')} jurisdiction.</div>
      </div>
    </section>

    <!-- CENTRED, PERSONAL SIGN-OFF — hand-signed by Nidhi -->
    <section class="nj-signoff">
      <div class="nj-signoff-greeting">With gratitude,</div>
      ${issuer.signatureUrl ? `
        <img class="nj-signature-img" src="${esc(issuer.signatureUrl)}" alt="${esc(issuer.signatory)} signature" />
      ` : `<div class="nj-signature-name">${esc(issuer.signatory.split(' ')[0])}</div>`}
      <div class="nj-signoff-name">${esc(issuer.signatory)}</div>
      <div class="nj-signoff-title">${esc(issuer.signatoryTitle || 'Founder')}, ${esc(issuer.brandName)}</div>
    </section>

    <div class="nj-thanks">
      Thank you for choosing ${esc(issuer.brandName)}.
      <span class="nj-thanks-cta">${esc(issuer.tagline)} — explore more at ${esc(issuer.website)}</span>
    </div>
  </article>
  `;
}

export interface RenderOptions {
  /** Auto-open the print dialog on load. Default: true */
  autoPrint?: boolean;
  /** Hide the toolbar (for headless PDF generation). Default: false */
  hideToolbar?: boolean;
  /** Back link shown on the toolbar */
  backHref?: string;
}

/** Render one invoice as a complete HTML document. */
export async function renderInvoiceHtml(inv: any, opts: RenderOptions = {}): Promise<string> {
  const { getIssuerProfile } = await import('./legal-entity');
  const issuer = await getIssuerProfile();
  return renderHtmlDocument([inv], inv.invoiceNumber, issuer, opts);
}

/** Render N invoices stacked with page-breaks, as a complete HTML document. */
export async function renderBulkInvoicesHtml(invoices: any[], opts: RenderOptions = {}): Promise<string> {
  const { getIssuerProfile } = await import('./legal-entity');
  const issuer = await getIssuerProfile();
  const title = `${invoices.length} invoices — ${issuer.brandName}`;
  return renderHtmlDocument(invoices, title, issuer, opts);
}

function renderHtmlDocument(invoices: any[], title: string, issuer: IssuerProfile, opts: RenderOptions): string {
  const { autoPrint = true, hideToolbar = false, backHref = '/admin/finance/sales-invoices' } = opts;

  const body = invoices.map((inv, i) => renderOneInvoice(inv, issuer, i < invoices.length - 1)).join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)} · ${esc(issuer.brandName)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" crossorigin />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&family=Inter:wght@400;500;600&family=Cormorant+Garamond:ital,wght@1,400;1,500&display=swap" />
<style>${INVOICE_CSS}</style>
</head>
<body>
${hideToolbar ? '' : `
<div class="nj-toolbar" data-noprint>
  <a class="nj-back" href="${esc(backHref)}">← Back to invoices</a>
  <div>
    <button class="nj-btn" onclick="window.print()">Print / Save as PDF</button>
  </div>
</div>`}
<main class="nj-stage">
  ${body}
</main>
${autoPrint && !hideToolbar ? `<script>
  window.addEventListener('load', function () {
    setTimeout(function () { try { window.print(); } catch (e) {} }, 500);
  });
</script>` : ''}
</body>
</html>`;
}

const INVOICE_CSS = `
  /* ─── Reset & base ─── */
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #ECE6D9; color: #1A1613; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; font-size: 11pt; line-height: 1.55; }
  body { min-height: 100vh; }

  a { color: #8B2E2A; text-decoration: none; }
  a:hover { text-decoration: underline; }

  /* ─── Toolbar (screen only) ─── */
  .nj-toolbar {
    position: sticky; top: 0; z-index: 50;
    background: #1A1613; color: #F4EFE6;
    padding: 14px 28px;
    display: flex; justify-content: space-between; align-items: center;
    font-size: 13px;
    border-bottom: 2px solid #8B2E2A;
  }
  .nj-back { color: #E8DFCF; }
  .nj-back:hover { color: #fff; }
  .nj-btn { background: #8B2E2A; color: #F4EFE6; border: none; padding: 9px 22px; font-family: inherit; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; cursor: pointer; font-weight: 500; }
  .nj-btn:hover { background: #A33A35; }

  .nj-stage { padding: 24px 16px; }

  /* ─── Invoice card ─── */
  .nj-invoice {
    max-width: 210mm;
    margin: 0 auto 24px auto;
    background: #F4EFE6;
    /* paper-texture feel via two layered gradients */
    background-image:
      radial-gradient(rgba(107,104,98,0.04) 1px, transparent 1px),
      radial-gradient(rgba(139,46,42,0.025) 1px, transparent 1px);
    background-size: 6px 6px, 11px 11px;
    background-position: 0 0, 3px 3px;
    padding: 22mm 18mm 18mm 18mm;
    box-shadow: 0 8px 40px rgba(26,22,19,0.18);
    color: #1A1613;
  }

  /* ─── Header band ─── */
  .nj-header {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    align-items: flex-start;
    margin-bottom: 18px;
  }
  .nj-mark { width: 280px; max-width: 100%; overflow: visible; }
  .nj-meta { text-align: right; font-size: 10pt; color: #6B6862; }
  .nj-doc-type {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 26pt; font-weight: 600; color: #1A1613; line-height: 1;
    letter-spacing: -0.5px;
    margin-bottom: 6px;
  }
  .nj-doc-no { font-family: 'Inter', monospace; color: #8B2E2A; font-size: 11pt; letter-spacing: 0.06em; margin-bottom: 4px; font-weight: 500; }
  .nj-doc-order { color: #6B4423; font-size: 9.5pt; margin-bottom: 8px; }
  .nj-doc-order b { color: #1A1613; font-family: 'Inter', monospace; letter-spacing: 0.04em; }
  .nj-doc-date { color: #6B6862; font-size: 9.5pt; }

  .nj-status { display: inline-block; margin-top: 10px; padding: 5px 14px; font-size: 9pt; letter-spacing: 0.16em; text-transform: uppercase; font-weight: 600; }
  .nj-status-paid              { background: #5A6F3F; color: #F4EFE6; }
  .nj-status-unpaid            { background: #D4A02A; color: #1A1613; }
  .nj-status-partially_paid    { background: #D4A02A; color: #1A1613; }
  .nj-status-refunded          { background: #8B2E2A; color: #F4EFE6; }
  .nj-status-partially_refunded{ background: #8B2E2A; color: #F4EFE6; }
  .nj-status-cancelled         { background: #6B6862; color: #F4EFE6; }
  .nj-status-void              { background: #6B6862; color: #F4EFE6; }

  /* ─── Decorative divider (Personal Library motif) ─── */
  .nj-divider {
    display: flex; align-items: center; justify-content: center;
    gap: 16px; margin: 18px 0;
  }
  .nj-divider-line { flex: 1; height: 1px; background: linear-gradient(90deg, transparent, #6B4423 30%, #6B4423 70%, transparent); }
  .nj-divider-dot  { width: 8px; height: 8px; background: #8B2E2A; border-radius: 50%; flex-shrink: 0; }

  /* ─── Issuer band ─── */
  .nj-issuer {
    background: #1A1613;
    color: #E8DFCF;
    padding: 16px 22px;
    display: grid;
    grid-template-columns: 1.4fr 1fr 1fr;
    gap: 24px;
    font-size: 9pt;
    margin-bottom: 18px;
    border: 1.5px solid #1A1613;
  }
  .nj-issuer .nj-label { color: #C4A585; }
  .nj-issuer-name { color: #F4EFE6; font-weight: 600; font-size: 10pt; margin-bottom: 3px; }
  .nj-issuer .nj-mono { color: #F4EFE6; font-weight: 500; }
  .nj-issuer .nj-line { color: #E8DFCF; }

  /* ─── Parties (Bill / Ship) ─── */
  .nj-parties {
    display: grid; grid-template-columns: 1fr 1fr; gap: 16px;
    margin-bottom: 22px;
  }
  .nj-party {
    background: rgba(107, 68, 35, 0.06);
    padding: 14px 18px;
    border: 1px solid rgba(107, 68, 35, 0.25);
    border-left: 3px solid #8B2E2A;
  }
  .nj-party-name {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 13pt; font-weight: 600; color: #1A1613; margin-bottom: 4px;
  }

  /* ─── Labels & lines (shared) ─── */
  .nj-label { font-size: 8pt; letter-spacing: 0.2em; text-transform: uppercase; color: #6B6862; margin-bottom: 6px; font-weight: 500; }
  .nj-line  { font-size: 9.5pt; color: #6B4423; margin-top: 2px; }
  .nj-mono  { font-family: 'Inter', 'Courier New', monospace; letter-spacing: 0.04em; font-feature-settings: 'tnum' 1; }
  .nj-muted { color: #6B6862; }
  .nj-desc  { font-weight: 500; color: #1A1613; }
  .nj-sub   { font-size: 8pt; color: #6B6862; }

  /* ─── Line items ─── */
  /* Wrapped in a Mitti-bordered frame to add the grid presence the user asked for */
  table.nj-lines {
    width: 100%;
    border-collapse: separate; border-spacing: 0;
    margin-bottom: 16px;
    border: 1.5px solid #1A1613;
  }
  table.nj-lines thead th {
    background: #1A1613; color: #F4EFE6;
    padding: 11px 10px;
    text-align: left;
    font-size: 8.5pt; letter-spacing: 0.16em; text-transform: uppercase; font-weight: 500;
    border-right: 1px solid rgba(244,239,230,0.18);
  }
  table.nj-lines thead th:last-child { border-right: none; }
  table.nj-lines thead th.r { text-align: right; }
  table.nj-lines thead th.w-num { width: 34px; text-align: right; }
  table.nj-lines tbody td {
    padding: 14px 10px;
    border-bottom: 1px solid rgba(107, 68, 35, 0.22);
    border-right: 1px solid rgba(107, 68, 35, 0.14);
    font-size: 9.5pt; vertical-align: top;
  }
  table.nj-lines tbody td:last-child { border-right: none; }
  /* Craft story under the description */
  .nj-origin {
    margin-top: 3px;
    font-family: 'Cormorant Garamond', 'Playfair Display', Georgia, serif;
    font-style: italic; font-size: 10pt; color: #6B4423;
  }
  .nj-origin i { color: #1A1613; font-style: italic; }
  .nj-story {
    margin-top: 4px;
    font-family: 'Cormorant Garamond', 'Playfair Display', Georgia, serif;
    font-style: italic; font-size: 10pt; color: #6B6862;
    line-height: 1.55;
    max-width: 380px;
    text-align: justify;
    text-justify: inter-word;
    hyphens: auto;
  }
  /* Compact inline strip — single line, dot separators, no chips */
  .nj-badges {
    margin-top: 6px;
    font-size: 8.5pt;
    color: #6B4423;
    letter-spacing: 0.04em;
    line-height: 1.4;
  }
  .nj-badge {
    display: inline; font-weight: 500;
  }
  .nj-badge-sep {
    color: #8B2E2A; margin: 0 7px; font-weight: 700;
  }
  table.nj-lines tbody td.r { text-align: right; font-variant-numeric: tabular-nums; }
  table.nj-lines tbody tr:last-child td { border-bottom: none; }
  /* Zebra rows for visual rhythm on multi-line invoices */
  table.nj-lines tbody tr:nth-child(even) td { background: rgba(107, 68, 35, 0.025); }

  /* ─── Totals ─── */
  .nj-totals-wrap {
    display: grid; grid-template-columns: 1fr 300px; gap: 24px;
    align-items: start;
    margin-bottom: 18px;
  }
  .nj-words {
    background: rgba(212, 160, 42, 0.08);
    padding: 12px 16px;
    border: 1px solid rgba(212, 160, 42, 0.35);
    border-left: 3px solid #D4A02A;
    margin-bottom: 12px;
  }
  .nj-words div:last-child {
    font-family: 'Cormorant Garamond', 'Playfair Display', Georgia, serif;
    font-style: italic; font-size: 12pt; color: #1A1613; margin-top: 2px;
  }
  .nj-totals { width: 100%; }
  .nj-totals tr td { padding: 5px 0; font-size: 10pt; }
  .nj-totals tr td.l { color: #6B4423; }
  .nj-totals tr td.r { text-align: right; font-variant-numeric: tabular-nums; color: #1A1613; }
  .nj-totals tr.grand td {
    border-top: 2px solid #1A1613; border-bottom: 2px solid #1A1613;
    padding: 12px 0;
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 16pt; font-weight: 600;
  }
  .nj-totals tr.grand td.r { color: #8B2E2A; }
  .nj-totals tr.paid td { color: #5A6F3F; padding-top: 8px; }
  .nj-totals tr.due  td { color: #8B2E2A; font-weight: 600; }

  .nj-notes {
    margin-top: 12px;
    padding: 12px 16px;
    background: #FFFFFF;
    border: 1px dashed #C9A87C;
    font-size: 9.5pt;
    text-align: justify;
    text-justify: inter-word;
  }

  /* ─── Payment history ─── */
  .nj-payments { margin-top: 16px; margin-bottom: 14px; }
  .nj-payments h3 {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 12pt; color: #1A1613; margin: 0 0 8px 0; font-weight: 600;
  }
  .nj-payments table { width: 100%; border-collapse: collapse; font-size: 9pt; }
  .nj-payments th, .nj-payments td { padding: 6px 8px; border-bottom: 1px solid rgba(107,68,35,0.15); text-align: left; }
  .nj-payments th { background: rgba(107,68,35,0.06); font-size: 8pt; letter-spacing: 0.16em; text-transform: uppercase; color: #6B4423; font-weight: 500; }
  .nj-payments td.r { text-align: right; font-variant-numeric: tabular-nums; }
  .nj-payments .refund { color: #8B2E2A; }

  /* ─── Bank + Terms band ─── */
  .nj-bank-terms {
    display: grid; grid-template-columns: 1.2fr 1fr; gap: 28px;
    margin-top: 18px;
    padding: 14px 18px;
    background: rgba(107, 68, 35, 0.04);
    border: 1px solid rgba(107, 68, 35, 0.18);
    font-size: 9pt; color: #6B4423;
    text-align: justify;
    text-justify: inter-word;
  }
  .nj-bank-terms .nj-line { color: #6B4423; }

  /* ─── Personal, centred sign-off ─── */
  .nj-signoff {
    margin-top: 26px;
    text-align: center;
  }
  .nj-signoff-greeting {
    font-family: 'Cormorant Garamond', 'Playfair Display', Georgia, serif;
    font-style: italic; font-size: 13pt; color: #6B4423;
    margin-bottom: 6px;
  }
  .nj-signature-img {
    display: block;
    max-width: 180px; max-height: 70px;
    margin: 0 auto 4px auto;
    object-fit: contain;
    filter: contrast(1.05);
  }
  .nj-signature-name {
    display: block;
    text-align: center;
    margin: 4px 0;
    font-family: 'Cormorant Garamond', 'Playfair Display', Georgia, serif;
    font-style: italic;
    font-size: 32pt;
    font-weight: 500;
    color: #1A1613;
    letter-spacing: 1px;
    line-height: 1;
  }
  .nj-signoff-name {
    margin-top: 6px;
    font-family: 'Inter', sans-serif;
    font-size: 10pt; letter-spacing: 0.2em; text-transform: uppercase;
    color: #1A1613; font-weight: 500;
  }
  .nj-signoff-title {
    font-family: 'Inter', sans-serif;
    font-size: 8.5pt; letter-spacing: 0.18em; text-transform: uppercase;
    color: #6B6862; margin-top: 2px;
  }

  /* ─── Closing line ─── */
  .nj-thanks {
    text-align: center; margin-top: 30px;
    font-family: 'Cormorant Garamond', 'Playfair Display', Georgia, serif;
    font-style: italic; color: #8B2E2A; font-size: 13pt;
  }
  .nj-thanks-cta {
    display: block;
    font-family: 'Inter', sans-serif; font-style: normal;
    font-size: 9pt; color: #6B6862; margin-top: 8px;
    letter-spacing: 0.18em; text-transform: uppercase;
  }

  /* ─── PRINT-only rules ─── */
  @media print {
    @page { size: A4; margin: 12mm; }
    html, body { background: #F4EFE6 !important; }
    [data-noprint], .nj-toolbar { display: none !important; }
    .nj-stage { padding: 0; }
    .nj-invoice {
      margin: 0; padding: 8mm 6mm; max-width: none;
      box-shadow: none;
      background-image: none;  /* drop the dotted texture for cleaner print */
      background: #F4EFE6;
    }
    /* Force colours to print (Chromium) */
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
  }
`;
