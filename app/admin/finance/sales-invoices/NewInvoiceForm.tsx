'use client';
// v23.40.5 — New Sales Invoice form (POS / B2B / BULK / COMMISSION).
import { useEffect, useState } from 'react';
import { X, Plus, Trash2, Calculator } from 'lucide-react';
import { formatINR } from '@/lib/money';
import { CustomerAutocomplete } from '@/components/admin/finance/CustomerAutocomplete';

interface LineDraft {
  description: string;
  hsnSac: string;
  quantity: number;
  unitPriceRupees: number;
  discountRupees: number;
  gstRatePercent: number;
  unitCostRupees: number | null;
  saleType: 'DIRECT' | 'MARKETPLACE';
  sellerId?: string | null;
}

const blankLine = (): LineDraft => ({
  description: '', hsnSac: '', quantity: 1, unitPriceRupees: 0,
  discountRupees: 0, gstRatePercent: 5, unitCostRupees: null, saleType: 'DIRECT', sellerId: null,
});

export default function NewInvoiceForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [head, setHead] = useState({
    invoiceType: 'POS',
    saleChannel: 'POS',
    saleType: 'DIRECT' as 'DIRECT' | 'MARKETPLACE',
    customerId: null as string | null, // v23.40.11
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    customerGstin: '',
    billingAddress: '',
    shippingAddress: '',
    customerUserId: null as string | null,
    sellerId: null as string | null,
    placeOfSupply: '',
    isInterState: false,
    issuedOn: today,
    dueOn: '',
    shippingRupees: 0,
    shippingGstRatePercent: 0,
    notes: '',
  });
  const [lines, setLines] = useState<LineDraft[]>([blankLine()]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  // Customer autocomplete is handled inside <CustomerAutocomplete> (v23.40.11).

  // Compute live totals
  const totals = (() => {
    let subtotal = 0, discount = 0, taxable = 0, cgst = 0, sgst = 0, igst = 0;
    for (const l of lines) {
      const taxBase = Math.max(0, (l.quantity * l.unitPriceRupees) - l.discountRupees);
      const tax     = taxBase * (l.gstRatePercent / 100);
      subtotal += l.quantity * l.unitPriceRupees;
      discount += l.discountRupees;
      taxable  += taxBase;
      if (head.isInterState) igst += tax;
      else { cgst += tax / 2; sgst += tax / 2; }
    }
    const shipping    = head.shippingRupees;
    const shippingTax = shipping * (head.shippingGstRatePercent / 100);
    const total = taxable + cgst + sgst + igst + shipping + shippingTax;
    return { subtotal, discount, taxable, cgst, sgst, igst, shipping, shippingTax, total };
  })();

  async function submit() {
    setErr(''); setSaving(true);
    try {
      if (!head.customerName) throw new Error('Customer / payee name required');
      if (!lines.length) throw new Error('Add at least one line');
      const r = await fetch('/api/admin/finance/sales-invoices', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...head,
          lines: lines.map(l => ({
            description: l.description,
            hsnSac: l.hsnSac || null,
            quantity: l.quantity,
            unitPriceRupees: l.unitPriceRupees,
            discountRupees: l.discountRupees,
            gstRatePercent: l.gstRatePercent,
            unitCostRupees: l.unitCostRupees,
            saleType: l.saleType,
            sellerId: l.sellerId,
          })),
          autoPost: true,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      onSaved();
    } catch (e: any) { setErr(e.message); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-kohl/50 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-ivory max-w-5xl w-full my-8 max-h-[calc(100vh-4rem)] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Sticky header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-mitti/10 sticky top-0 bg-ivory z-10">
          <div>
            <h3 className="font-display text-xl text-kohl">New sales invoice</h3>
            <p className="text-xs text-mitti">POS / B2B / Bulk / Commission — auto-posts to revenue ledger on save</p>
          </div>
          <button onClick={onClose} className="text-mitti hover:text-madder"><X className="w-5 h-5" /></button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-6 space-y-6">
          {/* Invoice classification */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <p className="label text-banarasi mb-1">INVOICE TYPE</p>
              <select value={head.invoiceType} onChange={e => setHead({ ...head, invoiceType: e.target.value, saleChannel: e.target.value === 'COMMISSION' ? 'MARKETPLACE_COMMISSION' : e.target.value })}
                className="w-full border border-mitti/30 px-3 py-2 bg-ivory text-sm">
                <option value="POS">POS / Offline</option>
                <option value="B2C">B2C (consumer)</option>
                <option value="B2B">B2B</option>
                <option value="BULK">Bulk order</option>
                <option value="COMMISSION">Commission (bill seller)</option>
              </select>
            </div>
            <div>
              <p className="label text-banarasi mb-1">CHANNEL</p>
              <select value={head.saleChannel} onChange={e => setHead({ ...head, saleChannel: e.target.value })}
                className="w-full border border-mitti/30 px-3 py-2 bg-ivory text-sm">
                <option value="POS">POS</option>
                <option value="WEBSITE">Website</option>
                <option value="BULK">Bulk</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="MARKETPLACE_COMMISSION">Marketplace commission</option>
              </select>
            </div>
            <div>
              <p className="label text-banarasi mb-1">SALE TYPE</p>
              <select value={head.saleType} onChange={e => setHead({ ...head, saleType: e.target.value as any })}
                className="w-full border border-mitti/30 px-3 py-2 bg-ivory text-sm">
                <option value="DIRECT">Direct (Neejee-owned)</option>
                <option value="MARKETPLACE">Marketplace (seller)</option>
              </select>
            </div>
            <div>
              <p className="label text-banarasi mb-1">ISSUED ON</p>
              <input type="date" value={head.issuedOn} onChange={e => setHead({ ...head, issuedOn: e.target.value })}
                className="w-full border border-mitti/30 px-3 py-2 bg-ivory text-sm" />
            </div>
          </div>

          {/* Customer block */}
          <div>
            <h4 className="label text-banarasi mb-2 pb-1 border-b border-mitti/10">Buyer / Payee</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <CustomerAutocomplete
                  customerId={head.customerId}
                  customerName={head.customerName}
                  customerEmail={head.customerEmail}
                  customerPhone={head.customerPhone}
                  customerGstin={head.customerGstin}
                  onChange={(v) => setHead({
                    ...head,
                    customerId: v.customerId,
                    customerName: v.customerName,
                    customerEmail: v.customerEmail ?? head.customerEmail,
                    customerPhone: v.customerPhone ?? head.customerPhone,
                    customerGstin: v.customerGstin ?? head.customerGstin,
                    customerUserId: null,
                  })}
                  label="CUSTOMER *"
                />
              </div>
              <Field label="EMAIL" value={head.customerEmail} onChange={v => setHead({ ...head, customerEmail: v })} />
              <Field label="PHONE" value={head.customerPhone} onChange={v => setHead({ ...head, customerPhone: v })} />
              <Field label="GSTIN" value={head.customerGstin} onChange={v => setHead({ ...head, customerGstin: v.toUpperCase() })} placeholder="29ABCDE1234F1Z5" />
              <Field label="PLACE OF SUPPLY" value={head.placeOfSupply} onChange={v => setHead({ ...head, placeOfSupply: v.toUpperCase() })} placeholder="e.g. 27 (Maharashtra)" />
            </div>
            <label className="flex items-center gap-2 text-sm mt-3">
              <input type="checkbox" checked={head.isInterState} onChange={e => setHead({ ...head, isInterState: e.target.checked })} />
              <span>Inter-state supply (apply IGST instead of CGST + SGST)</span>
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              <div>
                <p className="label text-banarasi mb-1">BILLING ADDRESS</p>
                <textarea value={head.billingAddress} onChange={e => setHead({ ...head, billingAddress: e.target.value })} rows={2}
                  className="w-full border border-mitti/30 px-3 py-2 bg-ivory text-sm" />
              </div>
              <div>
                <p className="label text-banarasi mb-1">SHIPPING ADDRESS</p>
                <textarea value={head.shippingAddress} onChange={e => setHead({ ...head, shippingAddress: e.target.value })} rows={2}
                  className="w-full border border-mitti/30 px-3 py-2 bg-ivory text-sm" />
              </div>
            </div>
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="label text-banarasi">Line items</h4>
              <button onClick={() => setLines([...lines, blankLine()])}
                className="flex items-center gap-1 px-2 py-1 bg-kohl text-ivory text-[10px] tracking-widest">
                <Plus className="w-3 h-3" /> ADD LINE
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[900px]">
                <thead className="bg-beige/50 text-mitti label">
                  <tr>
                    <th className="text-left p-2">DESCRIPTION *</th>
                    <th className="text-left p-2">HSN/SAC</th>
                    <th className="text-right p-2">QTY</th>
                    <th className="text-right p-2">PRICE (₹)</th>
                    <th className="text-right p-2">DISCOUNT (₹)</th>
                    <th className="text-right p-2">GST %</th>
                    <th className="text-right p-2">COST (₹)</th>
                    <th className="text-right p-2">TOTAL</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => {
                    const taxBase = Math.max(0, (l.quantity * l.unitPriceRupees) - l.discountRupees);
                    const tax = taxBase * (l.gstRatePercent / 100);
                    const lineTotal = taxBase + tax;
                    return (
                      <tr key={i} className="border-t border-mitti/10">
                        <td className="p-1"><input value={l.description} onChange={e => updateLine(i, { description: e.target.value })} className="w-full border border-mitti/20 px-2 py-1 text-xs" placeholder="Item name" /></td>
                        <td className="p-1"><input value={l.hsnSac} onChange={e => updateLine(i, { hsnSac: e.target.value })} className="w-24 border border-mitti/20 px-2 py-1 text-xs" /></td>
                        <td className="p-1"><input type="number" value={l.quantity} onChange={e => updateLine(i, { quantity: parseFloat(e.target.value) || 0 })} className="w-16 text-right border border-mitti/20 px-2 py-1 text-xs" /></td>
                        <td className="p-1"><input type="number" step="0.01" value={l.unitPriceRupees} onChange={e => updateLine(i, { unitPriceRupees: parseFloat(e.target.value) || 0 })} className="w-24 text-right border border-mitti/20 px-2 py-1 text-xs" /></td>
                        <td className="p-1"><input type="number" step="0.01" value={l.discountRupees} onChange={e => updateLine(i, { discountRupees: parseFloat(e.target.value) || 0 })} className="w-20 text-right border border-mitti/20 px-2 py-1 text-xs" /></td>
                        <td className="p-1">
                          <select value={l.gstRatePercent} onChange={e => updateLine(i, { gstRatePercent: parseFloat(e.target.value) })}
                            className="w-16 border border-mitti/20 px-1 py-1 text-xs">
                            {[0, 0.25, 3, 5, 12, 18, 28].map(r => <option key={r} value={r}>{r}%</option>)}
                          </select>
                        </td>
                        <td className="p-1"><input type="number" step="0.01" value={l.unitCostRupees ?? ''}
                          onChange={e => updateLine(i, { unitCostRupees: e.target.value ? parseFloat(e.target.value) : null })}
                          placeholder="landing" className="w-24 text-right border border-mitti/20 px-2 py-1 text-xs" /></td>
                        <td className="p-1 text-right tabular-nums">{formatINR(Math.round(lineTotal * 100))}</td>
                        <td className="p-1">
                          {lines.length > 1 && (
                            <button onClick={() => setLines(lines.filter((_, j) => j !== i))} className="text-madder hover:text-madder/70">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Shipping + totals */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="grid grid-cols-2 gap-3">
              <RupeeField label="SHIPPING / HANDLING (₹)" value={head.shippingRupees}
                onChange={v => setHead({ ...head, shippingRupees: v })} />
              <div>
                <p className="label text-banarasi mb-1">SHIPPING GST %</p>
                <select value={head.shippingGstRatePercent} onChange={e => setHead({ ...head, shippingGstRatePercent: parseFloat(e.target.value) })}
                  className="w-full border border-mitti/30 px-3 py-2 bg-ivory text-sm">
                  {[0, 5, 12, 18].map(r => <option key={r} value={r}>{r}%</option>)}
                </select>
              </div>
            </div>
            <div className="bg-beige/50 p-3 text-sm space-y-1">
              <Total label="Subtotal" amount={Math.round(totals.subtotal * 100)} />
              <Total label="Discount"  amount={-Math.round(totals.discount * 100)} muted />
              <Total label="Taxable value" amount={Math.round(totals.taxable * 100)} muted />
              {head.isInterState
                ? <Total label="IGST" amount={Math.round(totals.igst * 100)} muted />
                : <>
                    <Total label="CGST" amount={Math.round(totals.cgst * 100)} muted />
                    <Total label="SGST" amount={Math.round(totals.sgst * 100)} muted />
                  </>}
              {totals.shipping > 0    && <Total label="Shipping"      amount={Math.round(totals.shipping * 100)} muted />}
              {totals.shippingTax > 0 && <Total label="Shipping GST"  amount={Math.round(totals.shippingTax * 100)} muted />}
              <div className="border-t border-mitti/30 pt-2 flex justify-between font-display text-lg">
                <span>TOTAL</span>
                <span className="tabular-nums">{formatINR(Math.round(totals.total * 100))}</span>
              </div>
            </div>
          </div>

          <div>
            <p className="label text-banarasi mb-1">NOTES</p>
            <textarea value={head.notes} onChange={e => setHead({ ...head, notes: e.target.value })} rows={2}
              className="w-full border border-mitti/30 px-3 py-2 bg-ivory text-sm" />
          </div>

          {err && <div className="bg-madder/10 border border-madder/30 p-3 text-madder text-sm">{err}</div>}
        </div>

        {/* Sticky footer */}
        <div className="flex gap-2 p-6 pt-4 border-t border-mitti/10 sticky bottom-0 bg-ivory">
          <button onClick={submit} disabled={saving}
            className="flex-1 bg-kohl text-ivory px-4 py-2 text-xs tracking-widest disabled:opacity-50">
            {saving ? 'SAVING & POSTING…' : 'SAVE INVOICE & POST TO LEDGER'}
          </button>
          <button onClick={onClose} className="px-4 py-2 border border-mitti/30 text-mitti text-xs tracking-widest">CANCEL</button>
        </div>
      </div>
    </div>
  );

  function updateLine(i: number, patch: Partial<LineDraft>) {
    const next = [...lines];
    next[i] = { ...next[i], ...patch };
    setLines(next);
  }
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <p className="label text-banarasi mb-1">{label}</p>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full border border-mitti/30 px-3 py-2 bg-ivory text-sm" />
    </div>
  );
}
function RupeeField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <p className="label text-banarasi mb-1">{label}</p>
      <input type="number" step="0.01" value={value} onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className="w-full border border-mitti/30 px-3 py-2 bg-ivory text-sm" />
    </div>
  );
}
function Total({ label, amount, muted }: { label: string; amount: number; muted?: boolean }) {
  return (
    <div className={`flex justify-between text-xs ${muted ? 'text-mitti' : ''}`}>
      <span>{label}</span>
      <span className="tabular-nums">{amount ? formatINR(amount) : '—'}</span>
    </div>
  );
}
