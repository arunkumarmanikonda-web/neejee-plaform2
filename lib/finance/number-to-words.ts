// v23.40.13 — Indian-format paise → words (e.g. "₹ 1,51,050 paise" → "Rupees One Thousand Five Hundred Ten and Five Paise")
// Used for the "Amount in words" line on Tax Invoices (mandatory under GST rules).

const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
              'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n: number): string {
  if (n < 20) return ones[n];
  const t = Math.floor(n / 10), o = n % 10;
  return tens[t] + (o ? ' ' + ones[o] : '');
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100), r = n % 100;
  const parts: string[] = [];
  if (h) parts.push(ones[h] + ' Hundred');
  if (r) parts.push(twoDigits(r));
  return parts.join(' ');
}

/** Convert an integer rupee amount to Indian-format words (lakh, crore). */
export function rupeesToWords(n: number): string {
  if (n === 0) return 'Zero';
  if (n < 0) return 'Minus ' + rupeesToWords(-n);

  const crore   = Math.floor(n / 10_000_000); n %= 10_000_000;
  const lakh    = Math.floor(n / 100_000);    n %= 100_000;
  const thousand = Math.floor(n / 1_000);     n %= 1_000;
  const rest    = n;

  const parts: string[] = [];
  if (crore)    parts.push(twoDigits(crore)    + ' Crore');
  if (lakh)     parts.push(twoDigits(lakh)     + ' Lakh');
  if (thousand) parts.push(twoDigits(thousand) + ' Thousand');
  if (rest)     parts.push(threeDigits(rest));
  return parts.join(' ').trim();
}

/** Convert paise (integer) to a "Rupees X and Y Paise" string. */
export function numberToWordsINR(paise: number): string {
  const rupees    = Math.floor(paise / 100);
  const paiseLeft = paise % 100;
  let s = 'Rupees ' + rupeesToWords(rupees);
  if (paiseLeft > 0) s += ' and ' + twoDigits(paiseLeft) + ' Paise';
  return s;
}
