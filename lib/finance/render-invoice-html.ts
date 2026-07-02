// v26.4b — Server-side HTML renderer for NEEJEE branded invoices.
// Single-invoice print/export fit fix:
// - removes forced extra page behavior
// - keeps A4 output
// - keeps Print + Save PDF toolbar
// - avoids page breaks inside the key invoice blocks

import { formatINR } from '@/lib/money';
import { numberToWordsINR } from '@/lib/finance/number-to-words';
import type { IssuerProfile } from '@/lib/finance/legal-entity';

function esc(v: any): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Strip auto-generated boilerplate from notes; return null if nothing genuine remains. */
function visibleNotes(notes: string | null | undefined): string | null {
  if (!notes) return null;
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
  return raw.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Tiny SVG seal/medal beside each product badge. */
function badgeSeal(name: string): string {
  const n = (name || '').toLowerCase();
  if (n.includes('gi') || n.includes('handloom mark') || n.includes('silk mark')) {
    return `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#8B2E2A" stroke-width="2"><circle cx="12" cy="9" r="7"/><path d="M7 14l-2 7 7-3 7 3-2-7"/></svg>`;
  }
  if (n.includes('fair') || n.includes('artisan')) {
    return `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#5A6F3F" stroke-width="2"><path d="M12 2L4 6v6c0 5 8 10 8 10s8-5 8-10V6l-8-4z"/></svg>`;
  }
  if (n.includes('hand')) {
    return `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#6B4423" stroke-width="2"><path d="M9 11V6a2 2 0 014 0v5m0-1a2 2 0 014 0v4a6 6 0 01-6 6h-1a6 6 0 01-6-6v-3l2-1"/></svg>`;
  }
  return `<svg width="7" height="7" viewBox="0 0 8 8"><circle cx="4" cy="4" r="3" fill="#8B2E2A"/></svg>`;
}

/** Pull a human-readable order ref from the invoice notes / orderId. */
function extractOrderRef(inv: any): string | null {
  if (!inv) return null;
  const m = (inv.notes || '').match(/order\s+([A-Z0-9-]+)/i);
  if (m) return m[1].replace(/[.,]$/, '');
  if (inv.orderId) {
    return inv.orderId.length > 12
      ? '…' + inv.orderId.slice(-8).toUpperCase()
      : inv.orderId.toUpperCase();
  }
  return null;
}

const BRAND_MARK_SVG = (variant: 'kohl' | 'ivory' = 'kohl', showTagline = true) => {
  const text = variant === 'kohl' ? '#1A1613' : '#F4EFE6';
  const muted = variant === 'kohl' ? '#6B6862' : '#E8DFCF';

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 170" role="img" aria-label="NEEJEE" preserveAspectRatio="xMidYMid meet" style="display:block; width:100%; height:auto; overflow:visible;">
      <text x="230" y="100" text-anchor="end" font-family="'Playfair Display','PT Serif',Georgia,serif" font-weight="600" font-size="86" letter-spacing="4" fill="${text}">NEE</text>
      <circle cx="270" cy="74" r="11" fill="#8B2E2A"/>
      <text x="310" y="100" text-anchor="start" font-family="'Playfair Display','PT Serif',Georgia,serif" font-weight="600" font-size="86" letter-spacing="4" fill="${text}">JEE</text>
      ${
        showTagline
          ? `<text x="270" y="142" text-anchor="middle" font-family="'Inter','Helvetica Neue',Arial,sans-serif" font-weight="500" font-size="13" letter-spacing="6" fill="${muted}">FOUND &#183; PERSONAL</text>`
          : ''
      }
    </svg>
  `;
};

const DIVIDER = `
  <div class="nj-divider" aria-hidden="true">
    <span class="nj-divider-line"></span>
    <span class="nj-divider-dot"></span>
    <span class="nj-divider-line"></span>
  </div>
`;

function renderOneInvoice(inv: any, issuer: IssuerProfile, pageBreak = false): string {
  const status = (inv.paymentStatus || 'UNPAID').toLowerCase();
  const outstanding = (inv.totalPaise || 0) - (inv.paidPaise || 0);
  const realPayments = (inv.payments || []).filter((p: any) => p.amountPaise > 0);
  const refunds = (inv.payments || []).filter((p: any) => p.amountPaise < 0);

  const issuedLabel = new Date(inv.issuedOn).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const dueLabel = inv.dueOn
    ? new Date(inv.dueOn).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : null;

  const orderRef = extractOrderRef(inv);
  const isRetail = inv.invoiceType === 'B2C' || inv.invoiceType === 'POS';

  return `
  <article class="nj-invoice" ${pageBreak ? 'style="page-break-after: always;"' : ''}>
    <header class="nj-header">
      <div class="nj-mark">${BRAND_MARK_SVG('kohl', true)}</div>
      <div class="nj-meta">
        <div class="nj-doc-type">Tax Invoice</div>
        <div class="nj-doc-no">${esc(inv.invoiceNumber)}</div>
        ${orderRef ? `<div class="nj-doc-order">Order · <b>${esc(orderRef)}</b></div>` : ''}
        <div class="nj-doc-date">Issued ${esc(issuedLabel)}</div>
        ${dueLabel ? `<div class="nj-doc-date">Due ${esc(dueLabel)}</div>` : ''}
        <div class="nj-status nj-status-${esc(status)}">${esc(
          (inv.paymentStatus || 'UNPAID').replace(/_/g, ' ')
        )}</div>
      </div>
    </header>

    ${DIVIDER}

    <section class="nj-issuer">
      <div>
        <div class="nj-label">From</div>
        <div class="nj-issuer-name">${esc(issuer.legalName)}</div>
        <div class="nj-line" style="white-space: pre-line">${esc(issuer.addressMultiline)}</div>
        ${issuer.email ? `<div class="nj-line">${esc(issuer.email)}</div>` : ''}
        ${issuer.phone ? `<div class="nj-line">${esc(issuer.phone)}</div>` : ''}
      </div>
      <div>
        ${
          issuer.gstin
            ? `
          <div class="nj-label">GSTIN</div>
          <div class="nj-mono">${esc(issuer.gstin)}</div>
        `
            : ''
        }
        ${
          !isRetail && issuer.pan
            ? `
          <div class="nj-label" style="margin-top:8px">PAN</div>
          <div class="nj-mono">${esc(issuer.pan)}</div>
        `
            : ''
        }
        ${
          !isRetail && issuer.cin
            ? `
          <div class="nj-label" style="margin-top:8px">CIN</div>
          <div class="nj-mono">${esc(issuer.cin)}</div>
        `
            : ''
        }
      </div>
      <div>
        <div class="nj-label">Web</div>
        <div class="nj-line">${esc(issuer.website)}</div>
      </div>
    </section>

    <section class="nj-parties">
      <div class="nj-party">
        <div class="nj-label">Bill to</div>
        <div class="nj-party-name">${esc(inv.customerName)}</div>
        ${inv.customerGstin ? `<div class="nj-line nj-mono">GSTIN ${esc(inv.customerGstin)}</div>` : ''}
        ${inv.customerEmail ? `<div class="nj-line">${esc(inv.customerEmail)}</div>` : ''}
        ${inv.customerPhone ? `<div class="nj-line">${esc(inv.customerPhone)}</div>` : ''}
        ${
          inv.billingAddress
            ? `<div class="nj-line" style="margin-top:6px; white-space:pre-wrap">${esc(inv.billingAddress)}</div>`
            : ''
        }
      </div>
      <div class="nj-party">
        <div class="nj-label">Ship to</div>
        ${
          inv.shippingAddress
            ? `<div class="nj-line" style="white-space:pre-wrap">${esc(inv.shippingAddress)}</div>`
            : inv.billingAddress
            ? `<div class="nj-line" style="white-space:pre-wrap">${esc(inv.billingAddress)}</div>`
            : `<div class="nj-line">Same as billing</div>`
        }
        ${
          inv.placeOfSupply
            ? `<div class="nj-line" style="margin-top:6px">Place of supply: <b>${esc(
                inv.placeOfSupply
              )}</b></div>`
            : ''
        }
      </div>
    </section>

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
        ${(inv.lines || [])
          .map((l: any, i: number) => {
            const p = l.product;
            const originBits = [p?.craft, p?.region].filter(Boolean);
            const origin = originBits.length ? originBits.join(' · ') : null;
            const storyLine = (p?.story || p?.craftNote || '').trim();
            const storyShort =
              storyLine.length > 140 ? storyLine.slice(0, 138).trimEnd() + '…' : storyLine;
            const badges = Array.isArray(p?.badges) ? p.badges : [];
            const prettyBadges = badges.map((b: string) => prettyBadge(b));

            return `
          <tr>
            <td class="r nj-muted">${i + 1}</td>
            <td>
              <div class="nj-desc">${esc(l.description)}</div>
              ${
                origin
                  ? `<div class="nj-origin">${esc(origin)}${
                      p?.artisanName ? ` · by <i>${esc(p.artisanName)}</i>` : ''
                    }</div>`
                  : ''
              }
              ${storyShort ? `<div class="nj-story">“${esc(storyShort)}”</div>` : ''}
              ${
                prettyBadges.length
                  ? `<div class="nj-badges">${prettyBadges
                      .map(
                        (b: string) => `<span class="nj-badge">${badgeSeal(b)} ${esc(b)}</span>`
                      )
                      .join('<span class="nj-badge-sep">·</span>')}</div>`
                  : ''
              }
            </td>
            <td class="nj-mono nj-muted">${esc(l.hsnSac || '—')}</td>
            <td class="r">${esc(l.quantity)}</td>
            <td class="r">${formatINR(l.unitPricePaise)}</td>
            <td class="r nj-muted">${l.discountPaise ? formatINR(l.discountPaise) : '—'}</td>
            <td class="r">${formatINR(l.taxableValuePaise)}</td>
            <td class="r">
              ${l.gstRatePercent || 0}%<br/>
              <span class="nj-sub">${formatINR(
                (l.cgstPaise || 0) + (l.sgstPaise || 0) + (l.igstPaise || 0)
              )}</span>
            </td>
            <td class="r" style="font-weight:600">${formatINR(l.totalPaise)}</td>
          </tr>
        `;
          })
          .join('')}
      </tbody>
    </table>

    <div class="nj-totals-wrap">
      <div>
        <div class="nj-words">
          <div class="nj-label">Amount in words</div>
          <div>${esc(numberToWordsINR(inv.totalPaise))} only</div>
        </div>
        ${
          visibleNotes(inv.notes)
            ? `
          <div class="nj-notes">
            <div class="nj-label">A note from us</div>
            <div style="white-space:pre-wrap">${esc(visibleNotes(inv.notes))}</div>
          </div>`
            : ''
        }
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

    ${
      realPayments.length > 0 || refunds.length > 0
        ? `
      <section class="nj-payments">
        <h3>Payment history</h3>
        <table>
          <thead><tr><th>Date</th><th>Method</th><th>Reference</th><th class="r">Amount</th></tr></thead>
          <tbody>
            ${realPayments
              .map(
                (p: any) => `
              <tr>
                <td>${new Date(p.paidOn).toLocaleDateString('en-IN')}</td>
                <td>${esc(p.method || '—')}</td>
                <td>${esc(p.reference || '—')}</td>
                <td class="r">${formatINR(p.amountPaise)}</td>
              </tr>`
              )
              .join('')}
            ${refunds
              .map(
                (p: any) => `
              <tr class="refund">
                <td>${new Date(p.paidOn).toLocaleDateString('en-IN')}</td>
                <td>REFUND${p.method ? ` (${esc(p.method)})` : ''}</td>
                <td>${esc(p.reference || p.notes || '—')}</td>
                <td class="r">– ${formatINR(Math.abs(p.amountPaise))}</td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </section>
    `
        : ''
    }

    ${DIVIDER}

    <section class="nj-bank-terms">
      <div>
        <div class="nj-label">Bank details for payment</div>
        <div class="nj-line"><b>${esc(issuer.bankAccountName || issuer.legalName)}</b></div>
        ${
          issuer.bankName || issuer.bankAccountNumber
            ? `
          <div class="nj-line">${esc(issuer.bankName)}${
                issuer.bankBranch ? `, ${esc(issuer.bankBranch)}` : ''
              }${
                issuer.bankAccountNumber
                  ? ` · A/C <span class="nj-mono">${esc(issuer.bankAccountNumber)}</span>`
                  : ''
              }</div>
        `
            : ''
        }
        ${issuer.bankIfsc ? `<div class="nj-line">IFSC <span class="nj-mono">${esc(issuer.bankIfsc)}</span></div>` : ''}
      </div>
      <div>
        <div class="nj-label">Terms</div>
        <div class="nj-line">Payment due as per invoice terms. Goods governed by ${esc(
          issuer.brandName
        )} return policy at ${esc(issuer.website)}/returns. Disputes subject to ${esc(
    issuer.city || 'Mumbai'
  )} jurisdiction.</div>
      </div>
    </section>

    <section class="nj-signoff">
      <div class="nj-signoff-greeting">With gratitude,</div>
      ${
        issuer.signatureUrl
          ? `
        <img class="nj-signature-img" src="${esc(issuer.signatureUrl)}" alt="${esc(
              issuer.signatory
            )} signature" />
      `
          : `<div class="nj-signature-name">${esc(issuer.signatory.split(' ')[0])}</div>`
      }
      <div class="nj-signoff-name">${esc(issuer.signatory)}</div>
      <div class="nj-signoff-title">${esc(
        issuer.signatoryTitle || 'Founder'
      )}, ${esc(issuer.brandName)}</div>
    </section>

    <div class="nj-thanks">
      Thank you for choosing ${esc(issuer.brandName)}.
      <span class="nj-thanks-cta">${esc(issuer.tagline)} — explore more at ${esc(
    issuer.website
  )}</span>
    </div>
  </article>
  `;
}

export interface RenderOptions {
  autoPrint?: boolean;
  hideToolbar?: boolean;
  backHref?: string;
}

export async function renderInvoiceHtml(inv: any, opts: RenderOptions = {}): Promise<string> {
  const { getIssuerProfile } = await import('./legal-entity');
  const issuer = await getIssuerProfile();
  return renderHtmlDocument([inv], inv.invoiceNumber, issuer, opts);
}

export async function renderBulkInvoicesHtml(
  invoices: any[],
  opts: RenderOptions = {}
): Promise<string> {
  const { getIssuerProfile } = await import('./legal-entity');
  const issuer = await getIssuerProfile();
  const title = `${invoices.length} invoices — ${issuer.brandName}`;
  return renderHtmlDocument(invoices, title, issuer, opts);
}

function renderHtmlDocument(
  invoices: any[],
  title: string,
  issuer: IssuerProfile,
  opts: RenderOptions
): string {
  const {
    autoPrint = true,
    hideToolbar = false,
    backHref = '/admin/finance/sales-invoices',
  } = opts;

  const body = invoices
    .map((inv, i) => renderOneInvoice(inv, issuer, i < invoices.length - 1))
    .join('\n');

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
${
  hideToolbar
    ? ''
    : `
<div class="nj-toolbar" data-noprint>
  <a class="nj-back" href="${esc(backHref)}">← Back</a>
  <div class="nj-actions">
    <button class="nj-btn nj-btn-secondary" onclick="window.print()">Save PDF</button>
    <button class="nj-btn" onclick="window.print()">Print</button>
  </div>
</div>
<div class="nj-toolbar-hint" data-noprint>
  For the cleanest export, use paper size A4 and zero browser margins. Background graphics should remain enabled.
</div>`
}
<main class="nj-stage">
  ${body}
</main>
${
  autoPrint && !hideToolbar
    ? `<script>
  window.addEventListener('load', function () {
    setTimeout(function () { try { window.print(); } catch (e) {} }, 500);
  });
</script>`
    : ''
}
</body>
</html>`;
}

const INVOICE_CSS = `
  *, *::before, *::after { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: #ECE6D9;
    color: #1A1613;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 11pt;
    line-height: 1.45;
  }
  body { min-height: 100vh; }

  a { color: #8B2E2A; text-decoration: none; }
  a:hover { text-decoration: underline; }

  .nj-toolbar {
    position: sticky;
    top: 0;
    z-index: 50;
    background: #1A1613;
    color: #F4EFE6;
    padding: 14px 28px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13px;
    border-bottom: 2px solid #8B2E2A;
  }
  .nj-back { color: #E8DFCF; }
  .nj-back:hover { color: #fff; }

  .nj-btn {
    background: #8B2E2A;
    color: #F4EFE6;
    border: none;
    padding: 9px 22px;
    font-family: inherit;
    font-size: 11px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    cursor: pointer;
    font-weight: 500;
  }
  .nj-btn:hover { background: #A33A35; }

  .nj-btn-secondary { background: #6B4423; }
  .nj-btn-secondary:hover { background: #7A5131; }

  .nj-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .nj-toolbar-hint {
    padding: 10px 28px 0 28px;
    text-align: right;
    font-size: 11px;
    color: #6B6862;
  }

  .nj-stage { padding: 18px 0; }

  .nj-invoice {
    width: 210mm;
    min-height: 297mm;
    max-width: 210mm;
    margin: 0 auto 18px auto;
    background: #F4EFE6;
    background-image:
      radial-gradient(rgba(107,104,98,0.04) 1px, transparent 1px),
      radial-gradient(rgba(139,46,42,0.025) 1px, transparent 1px);
    background-size: 6px 6px, 11px 11px;
    background-position: 0 0, 3px 3px;
    padding: 12mm 12mm 10mm 12mm;
    box-shadow: 0 8px 40px rgba(26,22,19,0.18);
    color: #1A1613;
  }

  .nj-header {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 18px;
    align-items: flex-start;
    margin-bottom: 12px;
  }
  .nj-mark { width: 250px; max-width: 100%; overflow: visible; }
  .nj-meta { text-align: right; font-size: 10pt; color: #6B6862; }

  .nj-doc-type {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 24pt;
    font-weight: 600;
    color: #1A1613;
    line-height: 1;
    letter-spacing: -0.5px;
    margin-bottom: 5px;
  }
  .nj-doc-no {
    font-family: 'Inter', monospace;
    color: #8B2E2A;
    font-size: 10.5pt;
    letter-spacing: 0.06em;
    margin-bottom: 4px;
    font-weight: 500;
  }
  .nj-doc-order { color: #6B4423; font-size: 9.2pt; margin-bottom: 6px; }
  .nj-doc-order b {
    color: #1A1613;
    font-family: 'Inter', monospace;
    letter-spacing: 0.04em;
  }
  .nj-doc-date { color: #6B6862; font-size: 9.2pt; }

  .nj-status {
    display: inline-block;
    margin-top: 8px;
    padding: 5px 14px;
    font-size: 8.6pt;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    font-weight: 600;
  }
  .nj-status-paid { background: #5A6F3F; color: #F4EFE6; }
  .nj-status-unpaid { background: #D4A02A; color: #1A1613; }
  .nj-status-partially_paid { background: #D4A02A; color: #1A1613; }
  .nj-status-refunded { background: #8B2E2A; color: #F4EFE6; }
  .nj-status-partially_refunded { background: #8B2E2A; color: #F4EFE6; }
  .nj-status-cancelled { background: #6B6862; color: #F4EFE6; }
  .nj-status-void { background: #6B6862; color: #F4EFE6; }

  .nj-divider {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin: 12px 0;
  }
  .nj-divider-line {
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, transparent, #6B4423 30%, #6B4423 70%, transparent);
  }
  .nj-divider-dot {
    width: 8px;
    height: 8px;
    background: #8B2E2A;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .nj-issuer {
    background: #1A1613;
    color: #E8DFCF;
    padding: 12px 16px;
    display: grid;
    grid-template-columns: 1.4fr 1fr 1fr;
    gap: 18px;
    font-size: 8.8pt;
    margin-bottom: 14px;
    border: 1.5px solid #1A1613;
  }
  .nj-issuer .nj-label { color: #C4A585; }
  .nj-issuer-name {
    color: #F4EFE6;
    font-weight: 600;
    font-size: 9.8pt;
    margin-bottom: 3px;
  }
  .nj-issuer .nj-mono { color: #F4EFE6; font-weight: 500; }
  .nj-issuer .nj-line { color: #E8DFCF; }

  .nj-parties {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 14px;
  }
  .nj-party {
    background: rgba(107, 68, 35, 0.06);
    padding: 12px 14px;
    border: 1px solid rgba(107, 68, 35, 0.25);
    border-left: 3px solid #8B2E2A;
  }
  .nj-party-name {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 12pt;
    font-weight: 600;
    color: #1A1613;
    margin-bottom: 4px;
  }

  .nj-label {
    font-size: 7.7pt;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: #6B6862;
    margin-bottom: 5px;
    font-weight: 500;
  }
  .nj-line {
    font-size: 9pt;
    color: #6B4423;
    margin-top: 2px;
    line-height: 1.35;
  }
  .nj-mono {
    font-family: 'Inter', 'Courier New', monospace;
    letter-spacing: 0.04em;
    font-feature-settings: 'tnum' 1;
  }
  .nj-muted { color: #6B6862; }
  .nj-desc { font-weight: 500; color: #1A1613; }
  .nj-sub { font-size: 8pt; color: #6B6862; }

  table.nj-lines {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    margin-bottom: 12px;
    border: 1.5px solid #1A1613;
  }
  table.nj-lines thead th {
    background: #1A1613;
    color: #F4EFE6;
    padding: 9px 8px;
    text-align: left;
    font-size: 8pt;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    font-weight: 500;
    border-right: 1px solid rgba(244,239,230,0.18);
  }
  table.nj-lines thead th:last-child { border-right: none; }
  table.nj-lines thead th.r { text-align: right; }
  table.nj-lines thead th.w-num { width: 30px; text-align: right; }

  table.nj-lines tbody td {
    padding: 10px 8px;
    border-bottom: 1px solid rgba(107, 68, 35, 0.22);
    border-right: 1px solid rgba(107, 68, 35, 0.14);
    font-size: 8.9pt;
    vertical-align: top;
    line-height: 1.3;
  }
  table.nj-lines tbody td:last-child { border-right: none; }

  .nj-origin {
    margin-top: 2px;
    font-family: 'Cormorant Garamond', 'Playfair Display', Georgia, serif;
    font-style: italic;
    font-size: 9.2pt;
    color: #6B4423;
    line-height: 1.25;
  }
  .nj-origin i { color: #1A1613; font-style: italic; }

  .nj-story {
    margin-top: 3px;
    font-family: 'Cormorant Garamond', 'Playfair Display', Georgia, serif;
    font-style: italic;
    font-size: 9pt;
    color: #6B6862;
    line-height: 1.28;
    max-width: 360px;
    text-align: justify;
    text-justify: inter-word;
    hyphens: auto;
  }

  .nj-badges {
    margin-top: 5px;
    font-size: 8.2pt;
    color: #6B4423;
    letter-spacing: 0.02em;
    line-height: 1.3;
    display: flex;
    flex-wrap: wrap;
    gap: 4px 6px;
    align-items: center;
  }
  .nj-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-weight: 500;
  }
  .nj-badge-sep {
    color: #8B2E2A;
    margin: 0 2px;
    font-weight: 700;
  }

  table.nj-lines tbody td.r {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  table.nj-lines tbody tr:last-child td { border-bottom: none; }
  table.nj-lines tbody tr:nth-child(even) td { background: rgba(107, 68, 35, 0.025); }

  .nj-totals-wrap {
    display: grid;
    grid-template-columns: 1fr 280px;
    gap: 18px;
    align-items: start;
    margin-bottom: 14px;
  }

  .nj-words {
    background: rgba(212, 160, 42, 0.08);
    padding: 10px 14px;
    border: 1px solid rgba(212, 160, 42, 0.35);
    border-left: 3px solid #D4A02A;
    margin-bottom: 10px;
  }
  .nj-words div:last-child {
    font-family: 'Cormorant Garamond', 'Playfair Display', Georgia, serif;
    font-style: italic;
    font-size: 11pt;
    color: #1A1613;
    margin-top: 2px;
    line-height: 1.25;
  }

  .nj-totals { width: 100%; }
  .nj-totals tr td { padding: 4px 0; font-size: 9.4pt; }
  .nj-totals tr td.l { color: #6B4423; }
  .nj-totals tr td.r { text-align: right; font-variant-numeric: tabular-nums; color: #1A1613; }
  .nj-totals tr.grand td {
    border-top: 2px solid #1A1613;
    border-bottom: 2px solid #1A1613;
    padding: 9px 0;
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 14pt;
    font-weight: 600;
  }
  .nj-totals tr.grand td.r { color: #8B2E2A; }
  .nj-totals tr.paid td { color: #5A6F3F; padding-top: 6px; }
  .nj-totals tr.due td { color: #8B2E2A; font-weight: 600; }

  .nj-notes {
    margin-top: 10px;
    padding: 10px 14px;
    background: #FFFFFF;
    border: 1px dashed #C9A87C;
    font-size: 8.8pt;
    text-align: justify;
    text-justify: inter-word;
    line-height: 1.32;
  }

  .nj-payments { margin-top: 12px; margin-bottom: 10px; }
  .nj-payments h3 {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 11pt;
    color: #1A1613;
    margin: 0 0 6px 0;
    font-weight: 600;
  }
  .nj-payments table {
    width: 100%;
    border-collapse: collapse;
    font-size: 8.6pt;
  }
  .nj-payments th, .nj-payments td {
    padding: 5px 7px;
    border-bottom: 1px solid rgba(107,68,35,0.15);
    text-align: left;
  }
  .nj-payments th {
    background: rgba(107,68,35,0.06);
    font-size: 7.8pt;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #6B4423;
    font-weight: 500;
  }
  .nj-payments td.r { text-align: right; font-variant-numeric: tabular-nums; }
  .nj-payments .refund { color: #8B2E2A; }

  .nj-bank-terms {
    display: grid;
    grid-template-columns: 1.2fr 1fr;
    gap: 18px;
    margin-top: 12px;
    padding: 12px 14px;
    background: rgba(107, 68, 35, 0.04);
    border: 1px solid rgba(107, 68, 35, 0.18);
    font-size: 8.7pt;
    color: #6B4423;
    text-align: justify;
    text-justify: inter-word;
  }
  .nj-bank-terms .nj-line { color: #6B4423; }

  .nj-signoff {
    margin-top: 18px;
    text-align: center;
  }
  .nj-signoff-greeting {
    font-family: 'Cormorant Garamond', 'Playfair Display', Georgia, serif;
    font-style: italic;
    font-size: 11.5pt;
    color: #6B4423;
    margin-bottom: 4px;
  }
  .nj-signature-img {
    display: block;
    max-width: 160px;
    max-height: 58px;
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
    font-size: 28pt;
    font-weight: 500;
    color: #1A1613;
    letter-spacing: 1px;
    line-height: 1;
  }
  .nj-signoff-name {
    margin-top: 5px;
    font-family: 'Inter', sans-serif;
    font-size: 9.2pt;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: #1A1613;
    font-weight: 500;
  }
  .nj-signoff-title {
    font-family: 'Inter', sans-serif;
    font-size: 8pt;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #6B6862;
    margin-top: 2px;
  }

  .nj-thanks {
    text-align: center;
    margin-top: 18px;
    font-family: 'Cormorant Garamond', 'Playfair Display', Georgia, serif;
    font-style: italic;
    color: #8B2E2A;
    font-size: 11.5pt;
    line-height: 1.2;
  }
  .nj-thanks-cta {
    display: block;
    font-family: 'Inter', sans-serif;
    font-style: normal;
    font-size: 8.2pt;
    color: #6B6862;
    margin-top: 6px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    line-height: 1.25;
  }

  @media print {
    @page { size: A4; margin: 0; }

    html, body {
      width: 210mm;
      min-height: 297mm;
      background: #F4EFE6 !important;
    }

    [data-noprint], .nj-toolbar, .nj-toolbar-hint {
      display: none !important;
    }

    .nj-stage { padding: 0; }

    .nj-invoice {
      width: 210mm;
      min-height: 297mm;
      max-width: none;
      margin: 0;
      padding: 12mm 12mm 10mm 12mm;
      box-shadow: none;
      background-image: none;
      background: #F4EFE6;
      break-after: auto;
      page-break-after: auto;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .nj-header,
    .nj-issuer,
    .nj-parties,
    .nj-totals-wrap,
    .nj-bank-terms,
    .nj-signoff,
    .nj-thanks,
    .nj-words,
    .nj-notes,
    .nj-payments {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    table.nj-lines thead {
      display: table-header-group;
    }

    table.nj-lines tr {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
  }
`;
