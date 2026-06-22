// Render a Form 16A-style HTML statement for a TdsCertificate.
// This is NOT the official TRACES-issued certificate — it's a vendor-friendly
// statement of TDS deducted by NEEJEE, with all the data the vendor's CA needs.
//
// For the OFFICIAL Form 16A: TRACES portal (download after quarterly filing).
// This statement complements that — sent to vendors immediately after each quarter.

export function renderTdsStatementHtml(args: {
  cert: any;                  // TdsCertificate row
  vendor: any;                // Vendor row (for current PAN / GSTIN)
  legalEntity: any;           // NEEJEE LegalEntity row
  payouts: any[];             // VendorPayout rows (for the line-item table)
}): string {
  const { cert, vendor, legalEntity, payouts } = args;
  const inr = (paise: number) =>
    '₹' + (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const date = (d: Date | string | null) =>
    d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const esc = (s: any) => String(s ?? '').replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' } as any)[c]);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>TDS Statement — ${esc(cert.certificateNumber || cert.id)}</title>
  <style>
    @page { size: A4; margin: 18mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Inter', -apple-system, sans-serif; color: #1a1410; font-size: 11px; line-height: 1.5; max-width: 210mm; margin: 0 auto; padding: 16mm; background: #fefcf8; }
    .header { display: flex; justify-content: space-between; align-items: start; padding-bottom: 16px; border-bottom: 2px solid #8b1d33; margin-bottom: 24px; }
    .brand-name { font-size: 28px; font-weight: 600; letter-spacing: 2px; color: #1a1410; font-family: 'Playfair Display', serif; }
    .brand-tag { font-size: 10px; color: #6e5a48; font-style: italic; margin-top: 2px; }
    .doc-title { text-align: right; }
    .doc-label { font-size: 9px; letter-spacing: 2.5px; color: #8b1d33; font-weight: 600; }
    .doc-id { font-size: 16px; color: #1a1410; margin-top: 4px; font-weight: 600; }
    .doc-period { font-size: 11px; color: #6e5a48; margin-top: 2px; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
    .meta-box h3 { font-size: 9px; letter-spacing: 2px; color: #8b1d33; margin: 0 0 8px; }
    .meta-box p { margin: 2px 0; font-size: 11px; }
    .meta-box .name { font-weight: 600; font-size: 13px; color: #1a1410; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th { background: #f5efe5; padding: 8px; text-align: left; font-size: 9px; letter-spacing: 1.5px; color: #6e5a48; border-bottom: 1px solid #d9cdb7; }
    td { padding: 8px; border-bottom: 1px solid #ece4d4; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .summary { background: #f5efe5; padding: 16px 20px; margin-top: 24px; border-left: 4px solid #c89b3c; }
    .summary-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; }
    .summary-row.total { font-size: 16px; font-weight: 600; padding-top: 8px; margin-top: 8px; border-top: 1px solid #d9cdb7; }
    .note { background: #fdf6e8; padding: 12px 16px; margin-top: 24px; font-size: 10px; color: #6e5a48; border-left: 3px solid #c89b3c; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #ece4d4; font-size: 9px; color: #6e5a48; text-align: center; }
    .sig { margin-top: 60px; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    .sig-block { border-top: 1px solid #6e5a48; padding-top: 8px; font-size: 10px; color: #6e5a48; }
  </style>
</head>
<body>

  <div class="header">
    <div>
      <div class="brand-name">NEEJEE</div>
      <div class="brand-tag">${esc(legalEntity?.brandName || 'A slow Indian craft house')}</div>
      <p style="margin-top:12px;font-size:10px;color:#6e5a48;">
        ${esc(legalEntity?.legalName || '')}<br>
        ${esc([legalEntity?.addressLine1, legalEntity?.addressLine2, legalEntity?.city, legalEntity?.state, legalEntity?.pincode].filter(Boolean).join(', '))}<br>
        ${legalEntity?.gstin ? `GSTIN: ${esc(legalEntity.gstin)}` : ''}
        ${legalEntity?.pan ? ` &middot; PAN: ${esc(legalEntity.pan)}` : ''}
      </p>
    </div>
    <div class="doc-title">
      <div class="doc-label">TDS STATEMENT</div>
      <div class="doc-id">${esc(cert.certificateNumber || cert.id)}</div>
      <div class="doc-period">FY ${esc(cert.financialYear)} · Quarter ${esc(cert.quarter)}</div>
      <div class="doc-period">${date(cert.periodStart)} – ${date(new Date(new Date(cert.periodEnd).getTime() - 86400000))}</div>
    </div>
  </div>

  <div class="meta">
    <div class="meta-box">
      <h3>DEDUCTOR (NEEJEE)</h3>
      <p class="name">${esc(legalEntity?.legalName || 'NEEJEE')}</p>
      <p>${esc([legalEntity?.addressLine1, legalEntity?.city, legalEntity?.state, legalEntity?.pincode].filter(Boolean).join(', '))}</p>
      <p>PAN: <strong>${esc(legalEntity?.pan || '—')}</strong></p>
      <p>TAN: <strong>${esc(legalEntity?.cinNumber || '—')}</strong></p>
    </div>
    <div class="meta-box">
      <h3>DEDUCTEE (VENDOR)</h3>
      <p class="name">${esc(cert.vendorNameSnapshot)}</p>
      <p>${esc(cert.vendorAddressSnapshot || '—')}</p>
      <p>PAN: <strong>${esc(cert.vendorPanSnapshot || vendor?.gstin ? String(vendor.gstin).slice(2, 12) : '—')}</strong></p>
      <p>GSTIN: <strong>${esc(vendor?.gstin || '—')}</strong></p>
    </div>
  </div>

  <h3 style="font-size:10px;letter-spacing:2px;color:#8b1d33;margin:24px 0 8px;">PAYMENT DETAILS</h3>
  <table>
    <thead>
      <tr>
        <th>PAID ON</th>
        <th>PO REFERENCES</th>
        <th class="num">GROSS PAYMENT</th>
        <th class="num">TDS DEDUCTED</th>
        <th class="num">NET PAID</th>
      </tr>
    </thead>
    <tbody>
      ${payouts.length === 0
        ? `<tr><td colspan="5" style="text-align:center;color:#6e5a48;padding:24px;font-style:italic">No PAID payouts in this period</td></tr>`
        : payouts.map(p => `
            <tr>
              <td>${date(p.paidAt)}</td>
              <td style="font-size:10px;color:#6e5a48">${esc((p.poIds || []).join(', ').slice(0, 60) || '—')}</td>
              <td class="num">${inr(p.grossPaise || 0)}</td>
              <td class="num">${inr(p.tdsPaise || 0)}</td>
              <td class="num">${inr(p.netPaise || 0)}</td>
            </tr>
          `).join('')
      }
    </tbody>
  </table>

  <div class="summary">
    <div class="summary-row">
      <span>Gross payments in quarter</span>
      <span class="num">${inr(cert.grossPaymentsPaise || 0)}</span>
    </div>
    <div class="summary-row">
      <span>TDS rate applied</span>
      <span class="num">${esc(cert.tdsRate)}% (Section ${esc(cert.section)})</span>
    </div>
    <div class="summary-row total">
      <span>Total TDS deducted</span>
      <span class="num">${inr(cert.tdsDeductedPaise || 0)}</span>
    </div>
  </div>

  ${cert.tracesReceiptNo ? `
    <div class="note">
      <strong>TRACES filing reference:</strong> ${esc(cert.tracesReceiptNo)}
      ${cert.tracesFilingDate ? ` &middot; Filed on ${date(cert.tracesFilingDate)}` : ''}
    </div>
  ` : `
    <div class="note">
      <strong>Heads up:</strong> The official Form 16A is generated by TRACES portal after our quarterly TDS return filing. This statement is a working copy from NEEJEE for your records. Once filed, the TRACES receipt number will appear here.
    </div>
  `}

  <div class="sig">
    <div class="sig-block">
      ${legalEntity?.signatureUrl ? `<img src="${esc(legalEntity.signatureUrl)}" style="max-height:48px;margin-bottom:8px"/>` : ''}
      <strong>${esc(legalEntity?.authorisedSignatory || 'Authorised Signatory')}</strong><br>
      ${esc(legalEntity?.signatoryTitle || '')}<br>
      ${esc(legalEntity?.legalName || 'NEEJEE')}
    </div>
    <div class="sig-block">
      Place: ${esc(legalEntity?.city || 'Mumbai')}<br>
      Date: ${date(cert.issuedAt || cert.updatedAt)}
    </div>
  </div>

  <div class="footer">
    Generated by NEEJEE on ${new Date().toLocaleString('en-IN')} · This is an electronically generated statement.
  </div>

</body>
</html>`;
}
