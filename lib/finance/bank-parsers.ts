// v23.39 — Bank statement CSV parsers.
// Each parser detects its own format from headers and returns normalized rows.

import { createHash } from 'crypto';

export interface ParsedTxn {
  txnDate: Date;
  description: string;
  reference: string | null;
  debitPaise: number;
  creditPaise: number;
  balancePaise: number | null;
  rowHash: string;        // dedup hash
}

export type BankFormat = 'HDFC' | 'GENERIC';

/**
 * Parse a CSV file's text content into normalized bank transactions.
 * Throws if the format cannot be detected or if required columns are missing.
 */
export function parseBankCsv(csvText: string): { format: BankFormat; rows: ParsedTxn[] } {
  // Normalize line endings + remove BOM
  const text = csvText.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  if (lines.length === 0) throw new Error('CSV is empty');

  // Detect HDFC: header line containing "Narration" and "Withdrawal Amt"
  // HDFC statements have a preamble (logo, account holder, address etc.)
  // before the header — search the full file, not just first 10 lines.
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    if (lower.includes('narration') && (lower.includes('withdrawal') || lower.includes('debit'))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx >= 0) {
    return { format: 'HDFC', rows: parseHdfc(lines.slice(headerIdx)) };
  }

  // Generic fallback: try to parse as Date,Description,Debit,Credit,Balance
  return { format: 'GENERIC', rows: parseGeneric(lines) };
}

function splitCsvRow(line: string): string[] {
  // Handles quoted fields with commas inside
  const out: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) {
      out.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map(s => s.trim());
}

function parseAmount(s: string): number {
  if (!s) return 0;
  // Remove ₹, commas, spaces, "INR"
  const cleaned = s.replace(/[₹,\s]/g, '').replace(/INR/gi, '').trim();
  if (!cleaned || cleaned === '-' || cleaned === '0' || cleaned === '0.00') return 0;
  const n = parseFloat(cleaned);
  if (isNaN(n)) return 0;
  return Math.round(n * 100); // to paise
}

function parseDate(s: string): Date | null {
  if (!s) return null;
  const cleaned = s.trim();
  // Common Indian formats: DD/MM/YY, DD/MM/YYYY, DD-MM-YY, DD-MM-YYYY
  const m = cleaned.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = '20' + y;
    const yr = parseInt(y), mn = parseInt(mo), dy = parseInt(d);
    if (yr < 2000 || mn < 1 || mn > 12 || dy < 1 || dy > 31) return null;
    return new Date(yr, mn - 1, dy);
  }
  // ISO yyyy-mm-dd
  const iso = new Date(cleaned);
  if (!isNaN(iso.getTime())) return iso;
  return null;
}

function rowHash(...parts: (string | number | null | undefined)[]): string {
  return createHash('sha1').update(parts.map(p => p ?? '').join('|')).digest('hex').slice(0, 16);
}

/**
 * HDFC statement CSV — typical columns:
 *   Date | Narration | Chq./Ref.No. | Value Dt | Withdrawal Amt. | Deposit Amt. | Closing Balance
 */
function parseHdfc(lines: string[]): ParsedTxn[] {
  const header = splitCsvRow(lines[0]).map(h => h.toLowerCase());
  const ci = {
    date: header.findIndex(h => h === 'date'),
    narration: header.findIndex(h => h.includes('narration')),
    ref: header.findIndex(h => h.includes('chq') || h.includes('ref')),
    valueDate: header.findIndex(h => h.includes('value')),
    debit: header.findIndex(h => h.includes('withdrawal') || h === 'debit' || h.includes('debit amt')),
    credit: header.findIndex(h => h.includes('deposit') || h === 'credit' || h.includes('credit amt')),
    balance: header.findIndex(h => h.includes('balance')),
  };
  if (ci.date < 0 || ci.narration < 0 || (ci.debit < 0 && ci.credit < 0)) {
    throw new Error('HDFC CSV: missing required columns (Date / Narration / Withdrawal / Deposit)');
  }
  const rows: ParsedTxn[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvRow(lines[i]);
    if (cells.length < 3) continue;
    // Skip HDFC's row of asterisks separating header from data
    if (cells[0].includes('***') || cells[1].includes('***')) continue;
    // Skip statement-summary footer rows
    if (cells[0].toLowerCase().includes('statement') || cells[0].toLowerCase().includes('opening')) continue;
    const date = parseDate(cells[ci.valueDate] || cells[ci.date]);
    if (!date) continue; // skip malformed
    const debit = ci.debit >= 0 ? parseAmount(cells[ci.debit]) : 0;
    const credit = ci.credit >= 0 ? parseAmount(cells[ci.credit]) : 0;
    if (debit === 0 && credit === 0) continue;
    const description = (cells[ci.narration] || '').trim();
    const reference = ci.ref >= 0 ? (cells[ci.ref] || '').trim() || null : null;
    const balance = ci.balance >= 0 ? parseAmount(cells[ci.balance]) || null : null;
    rows.push({
      txnDate: date,
      description,
      reference,
      debitPaise: debit,
      creditPaise: credit,
      balancePaise: balance,
      rowHash: rowHash(date.toISOString().slice(0, 10), description, reference, debit, credit),
    });
  }
  return rows;
}

/**
 * Generic CSV fallback: best-effort parsing.
 * Expects columns: Date, Description, Debit, Credit, (Balance)
 */
function parseGeneric(lines: string[]): ParsedTxn[] {
  const header = splitCsvRow(lines[0]).map(h => h.toLowerCase());
  const ci = {
    date: header.findIndex(h => h.includes('date')),
    desc: header.findIndex(h => h.includes('description') || h.includes('narration') || h.includes('details')),
    debit: header.findIndex(h => h.includes('debit') || h.includes('withdraw') || h.includes('amount out')),
    credit: header.findIndex(h => h.includes('credit') || h.includes('deposit') || h.includes('amount in')),
    balance: header.findIndex(h => h.includes('balance')),
    ref: header.findIndex(h => h.includes('ref') || h.includes('utr')),
  };
  if (ci.date < 0 || ci.desc < 0) {
    throw new Error('CSV format not recognized. Expected columns: Date, Description, Debit, Credit (optional Balance, Reference)');
  }
  const rows: ParsedTxn[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvRow(lines[i]);
    if (cells.length < 3) continue;
    const date = parseDate(cells[ci.date]);
    if (!date) continue;
    const debit = ci.debit >= 0 ? parseAmount(cells[ci.debit]) : 0;
    const credit = ci.credit >= 0 ? parseAmount(cells[ci.credit]) : 0;
    if (debit === 0 && credit === 0) continue;
    const description = (cells[ci.desc] || '').trim();
    const reference = ci.ref >= 0 ? (cells[ci.ref] || '').trim() || null : null;
    const balance = ci.balance >= 0 ? parseAmount(cells[ci.balance]) || null : null;
    rows.push({
      txnDate: date,
      description,
      reference,
      debitPaise: debit,
      creditPaise: credit,
      balancePaise: balance,
      rowHash: rowHash(date.toISOString().slice(0, 10), description, reference, debit, credit),
    });
  }
  return rows;
}
