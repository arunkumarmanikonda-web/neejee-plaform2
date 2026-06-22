// Money helpers — single source of truth for paise/rupee conversion
// All DB amounts are stored as integer PAISE (₹1 = 100 paise).
// All UI surfaces display/edit in RUPEES.

/** Convert paise (DB) to rupees (UI). Always returns a number. */
export const paiseToRupees = (paise: number | null | undefined): number => {
  if (paise == null) return 0;
  return Math.round(paise) / 100;
};

/** Convert rupees (UI input) to paise (DB). Accepts string or number. */
export const rupeesToPaise = (rupees: number | string | null | undefined): number => {
  if (rupees == null || rupees === '') return 0;
  const n = typeof rupees === 'string' ? parseFloat(rupees) : rupees;
  if (isNaN(n)) return 0;
  return Math.round(n * 100);
};

/** Format paise as Indian Rupee string with ₹ symbol and Indian number grouping. */
export const formatINR = (paise: number | null | undefined): string => {
  if (paise == null) return '₹0';
  const rupees = paise / 100;
  return '₹' + rupees.toLocaleString('en-IN', {
    minimumFractionDigits: rupees % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
};

/** Short form: ₹1.5L, ₹24.8k */
export const formatINRShort = (paise: number | null | undefined): string => {
  if (paise == null) return '₹0';
  const r = paise / 100;
  if (r >= 10000000) return '₹' + (r / 10000000).toFixed(2).replace(/\.00$/, '') + 'Cr';
  if (r >= 100000) return '₹' + (r / 100000).toFixed(2).replace(/\.00$/, '') + 'L';
  if (r >= 1000) return '₹' + (r / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return '₹' + r.toLocaleString('en-IN');
};

/** Compute final price considering sale window. Returns paise. */
export const effectivePricePaise = (
  sellingPrice: number,
  salePrice: number | null | undefined,
  saleStartsAt: Date | string | null | undefined,
  saleEndsAt: Date | string | null | undefined,
  now: Date = new Date()
): { price: number; onSale: boolean; original?: number } => {
  if (!salePrice) return { price: sellingPrice, onSale: false };
  const start = saleStartsAt ? new Date(saleStartsAt) : null;
  const end = saleEndsAt ? new Date(saleEndsAt) : null;
  if (start && now < start) return { price: sellingPrice, onSale: false };
  if (end && now > end) return { price: sellingPrice, onSale: false };
  return { price: salePrice, onSale: true, original: sellingPrice };
};

/** Discount percentage based on MRP and selling price. */
export const discountPct = (mrp: number, price: number): number => {
  if (!mrp || mrp <= price) return 0;
  return Math.round(((mrp - price) / mrp) * 100);
};
