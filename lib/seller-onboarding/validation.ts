export type SellerAutoValidationResult = {
  ok: boolean;
  errors: string[];
  checks: {
    pan: boolean;
    gstin: boolean;
    gstMatchesPan: boolean;
    cin: boolean;
    ifsc: boolean;
    bankAccount: boolean;
    msmeNumber: boolean;
  };
};

function clean(value: unknown): string {
  return String(value || '').trim().toUpperCase();
}

export function isValidPan(pan: unknown): boolean {
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(clean(pan));
}

export function isValidCin(cin: unknown): boolean {
  const value = clean(cin);
  if (!value) return true;
  return /^[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/.test(value);
}

export function isValidIfsc(ifsc: unknown): boolean {
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(clean(ifsc));
}

export function isValidBankAccount(bankAccount: unknown): boolean {
  return /^[0-9]{9,18}$/.test(String(bankAccount || '').trim());
}

export function isValidMsmeNumber(msmeNumber: unknown): boolean {
  const value = clean(msmeNumber);
  if (!value) return true;
  return /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/.test(value);
}

function gstCharValue(char: string): number {
  if (/[0-9]/.test(char)) return Number(char);
  return char.charCodeAt(0) - 55;
}

export function computeGstChecksum(input14: string): string {
  const chars = input14.split('');
  let factor = 2;
  let sum = 0;

  for (let i = chars.length - 1; i >= 0; i -= 1) {
    const codePoint = gstCharValue(chars[i]);
    let addend = factor * codePoint;
    factor = factor === 2 ? 1 : 2;
    addend = Math.floor(addend / 36) + (addend % 36);
    sum += addend;
  }

  const remainder = sum % 36;
  const checkCodePoint = (36 - remainder) % 36;

  return checkCodePoint < 10
    ? String(checkCodePoint)
    : String.fromCharCode(checkCodePoint + 55);
}

export function isValidGstin(gstin: unknown): boolean {
  const value = clean(gstin);
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(value)) {
    return false;
  }
  return computeGstChecksum(value.slice(0, 14)) === value.slice(14);
}

export function gstMatchesPan(gstin: unknown, pan: unknown): boolean {
  const g = clean(gstin);
  const p = clean(pan);
  if (!g || !p) return false;
  if (g.length < 12) return false;
  return g.slice(2, 12) === p;
}

export function evaluateSellerAutoKyc(input: {
  pan?: string | null;
  gstin?: string | null;
  cin?: string | null;
  ifsc?: string | null;
  bankAccount?: string | null;
  msmeNumber?: string | null;
}): SellerAutoValidationResult {
  const errors: string[] = [];

  const panOk = isValidPan(input.pan);
  if (!panOk) errors.push('PAN format is invalid');

  const gstRaw = clean(input.gstin);
  const gstOk = gstRaw ? isValidGstin(gstRaw) : true;
  if (!gstOk) errors.push('GSTIN format/checksum is invalid');

  const cinRaw = clean(input.cin);
  const cinOk = cinRaw ? isValidCin(cinRaw) : true;
  if (!cinOk) errors.push('CIN format is invalid');

  const ifscOk = isValidIfsc(input.ifsc);
  if (!ifscOk) errors.push('IFSC format is invalid');

  const bankOk = isValidBankAccount(input.bankAccount);
  if (!bankOk) errors.push('Bank account number format is invalid');

  const msmeOk = isValidMsmeNumber(input.msmeNumber);
  if (!msmeOk) errors.push('MSME/Udyam number format is invalid');

  const gstPanOk = gstRaw ? gstMatchesPan(gstRaw, input.pan) : true;
  if (!gstPanOk) errors.push('GSTIN does not match PAN');

  return {
    ok: errors.length === 0,
    errors,
    checks: {
      pan: panOk,
      gstin: gstOk,
      gstMatchesPan: gstPanOk,
      cin: cinOk,
      ifsc: ifscOk,
      bankAccount: bankOk,
      msmeNumber: msmeOk,
    },
  };
}