// v23.39.1 — Multi-format bank statement import.
// Accepts: CSV / TSV / pipe-delimited TXT / Excel (xlsx/xls) / PDF (text-layer)
// Converts to CSV text in-memory, then delegates to the existing CSV import logic.
//
// POST /api/admin/finance/bank-accounts/{id}/import-file
// multipart/form-data with field 'file'

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireFinancePerm } from '@/lib/finance/roles';
import { parseBankCsv } from '@/lib/finance/bank-parsers';
import { autoMatchAll } from '@/lib/finance/bank-matcher';
import { recordAudit } from '@/lib/finance/audit-log';
import { randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

const MAX_FILE_MB = 20;

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.write');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const account = await prisma.bankAccount.findUnique({ where: { id: params.id } });
  if (!account) return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });

  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      return NextResponse.json({ error: `File exceeds ${MAX_FILE_MB} MB` }, { status: 400 });
    }

    const filename = file.name || 'upload';
    const ext = filename.toLowerCase().split('.').pop() || '';
    const buf = Buffer.from(await file.arrayBuffer());

    // Convert to CSV text based on extension
    let csvText: string;
    let sourceKind: string;

    if (['csv', 'txt', 'tsv'].includes(ext)) {
      csvText = buf.toString('utf-8');
      // Convert pipe/tab to comma
      if (ext === 'tsv' || csvText.includes('\t')) {
        csvText = csvText.replace(/\t/g, ',');
      } else if (csvText.includes('|') && !csvText.includes(',')) {
        csvText = csvText.replace(/\|/g, ',');
      }
      sourceKind = 'CSV';
    } else if (['xlsx', 'xls', 'xlsm'].includes(ext)) {
      csvText = await excelToCsv(buf);
      sourceKind = 'EXCEL';
    } else if (ext === 'pdf') {
      csvText = await pdfToCsv(buf);
      sourceKind = 'PDF';
    } else {
      return NextResponse.json({
        error: `Unsupported file type: .${ext}. Accepted: CSV, TSV, TXT, XLSX, XLS, PDF.`,
      }, { status: 400 });
    }

    if (!csvText.trim()) {
      return NextResponse.json({
        error: `Couldn't extract any text from the ${sourceKind}. Try saving it as CSV/Excel.`,
      }, { status: 400 });
    }

    // Parse + insert (mirrors /import-csv flow)
    const { format, rows } = parseBankCsv(csvText);
    if (rows.length === 0) {
      return NextResponse.json({
        error: `Parsed file but no valid transactions found. (Source: ${sourceKind})`,
        debug: { format, csvPreview: csvText.slice(0, 500) },
      }, { status: 400 });
    }

    let inserted = 0, skipped = 0;
    for (const r of rows) {
      const exists = await prisma.bankTransaction.findFirst({
        where: { bankAccountId: account.id, sourceRowHash: r.rowHash },
        select: { id: true },
      });
      if (exists) { skipped++; continue; }
      await prisma.bankTransaction.create({
        data: {
          id: 'btxn_' + randomBytes(10).toString('hex'),
          bankAccountId: account.id,
          txnDate: r.txnDate,
          description: r.description,
          reference: r.reference,
          debitPaise: r.debitPaise,
          creditPaise: r.creditPaise,
          balancePaise: r.balancePaise,
          source: `${sourceKind}_${format}`,
          sourceRowHash: r.rowHash,
          status: 'UNMATCHED',
        },
      });
      inserted++;
    }

    await prisma.bankAccount.update({
      where: { id: account.id },
      data: { lastSyncedAt: new Date(), lastSyncedSource: `${sourceKind}_${format}` },
    });

    const matchResult = await autoMatchAll(account.id);

    await recordAudit({
      action: 'UPDATE',
      entityType: 'BankAccount',
      entityId: account.id,
      before: { lastSyncedAt: account.lastSyncedAt },
      after: { lastSyncedAt: new Date(), sourceKind, format, inserted, skipped, ...matchResult },
      session,
      req,
    });

    return NextResponse.json({
      ok: true,
      sourceKind,
      format,
      parsedRows: rows.length,
      inserted,
      skipped,
      matched: matchResult,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Import failed' }, { status: 500 });
  }
}

// ─── Excel → CSV ────────────────────────────────────────────────────────────
async function excelToCsv(buf: Buffer): Promise<string> {
  // HDFC sometimes ships .xls files that are actually HTML tables.
  const head = buf.slice(0, 8).toString('utf-8').toLowerCase();
  if (head.startsWith('<html') || head.startsWith('<!doc') || head.startsWith('<table') || head.startsWith('<?xml')) {
    return htmlTableToCsv(buf.toString('utf-8'));
  }

  // SheetJS first — supports BOTH .xls (BIFF) and .xlsx (OOXML).
  // exceljs only supports xlsx so it would silently fail on .xls.
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - xlsx (SheetJS) ships its own types but we keep it loose
    const XLSX: any = await import('xlsx');
    const wb = XLSX.read(buf, { type: 'buffer', cellDates: true, cellFormula: false, cellStyles: false });
    if (wb.SheetNames?.length) {
      let chosen: any = null;
      for (const name of wb.SheetNames) {
        const ws = wb.Sheets[name];
        if (ws && ws['!ref']) { chosen = ws; break; }
      }
      if (!chosen) chosen = wb.Sheets[wb.SheetNames[0]];
      const csv: string = XLSX.utils.sheet_to_csv(chosen, { dateNF: 'dd/mm/yyyy', strip: false, blankrows: false });
      if (csv.trim()) return csv;
    }
  } catch (e: any) {
    // fall through to exceljs
  }

  // Fallback: exceljs (xlsx only)
  try {
    const ExcelJS: any = (await import('exceljs')).default || (await import('exceljs'));
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    let sheet: any;
    for (const ws of wb.worksheets) {
      if (ws.rowCount > 1) { sheet = ws; break; }
    }
    if (!sheet) sheet = wb.worksheets[0];
    if (!sheet) return '';

    const lines: string[] = [];
    sheet.eachRow({ includeEmpty: false }, (row: any) => {
      const cells: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell: any) => {
        const v = cell.value;
        let s: string;
        if (v == null) s = '';
        else if (v instanceof Date) s = v.toISOString().slice(0, 10);
        else if (typeof v === 'object' && 'text' in v) s = String((v as any).text);
        else if (typeof v === 'object' && 'result' in v) s = String((v as any).result);
        else s = String(v);
        if (s.includes(',') || s.includes('"')) s = '"' + s.replace(/"/g, '""') + '"';
        cells.push(s);
      });
      lines.push(cells.join(','));
    });
    return lines.join('\n');
  } catch {
    throw new Error('Could not parse this Excel file. If it is a legacy .xls, save it as .xlsx in Excel and retry. For HDFC, try downloading the CSV version from netbanking instead.');
  }
}

/** HTML table → CSV (for HDFC's HTML-disguised .xls files). */
function htmlTableToCsv(html: string): string {
  const lines: string[] = [];
  const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRe = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRe.exec(html)) !== null) {
    const inner = rowMatch[1];
    const cells: string[] = [];
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRe.exec(inner)) !== null) {
      let txt = cellMatch[1]
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim();
      if (txt.includes(',') || txt.includes('"')) txt = '"' + txt.replace(/"/g, '""') + '"';
      cells.push(txt);
    }
    if (cells.length > 0) lines.push(cells.join(','));
  }
  return lines.join('\n');
}

// ─── PDF → CSV (best effort) ────────────────────────────────────────────────
async function pdfToCsv(buf: Buffer): Promise<string> {
  // Lazy import — pdf-parse is heavy
  let pdfParse: any;
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - pdf-parse types provided via types/pdf-parse.d.ts shim
    const mod: any = await import('pdf-parse');
    pdfParse = mod.default || mod;
  } catch (e: any) {
    throw new Error('PDF support requires `pdf-parse` package. If you just deployed, the next build cycle will include it.');
  }
  const data: any = await pdfParse(buf);
  const text: string = data.text || '';
  if (!text.trim()) {
    throw new Error('PDF has no extractable text — likely scanned/image-only. Re-save as CSV or Excel.');
  }

  // Heuristic: try to detect lines that look like transactions
  // Banks typically have lines like: "15/06/2026  NEFT-ABC123  5000.00  Dr  1234.00"
  // Convert text rows to CSV with best-effort column splitting on 2+ spaces
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const out: string[] = [];

  // Find header line
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    if (lower.includes('narration') || lower.includes('description') ||
        (lower.includes('date') && (lower.includes('debit') || lower.includes('withdrawal')))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) {
    // No header found — emit a generic header
    out.push('Date,Description,Reference,Debit,Credit,Balance');
  } else {
    out.push(lines[headerIdx].split(/\s{2,}/).join(','));
  }
  const startIdx = headerIdx >= 0 ? headerIdx + 1 : 0;
  for (let i = startIdx; i < lines.length; i++) {
    const cells = lines[i].split(/\s{2,}|\t+/);
    if (cells.length < 3) continue;
    out.push(cells.map(c => {
      if (c.includes(',')) return '"' + c.replace(/"/g, '""') + '"';
      return c;
    }).join(','));
  }
  return out.join('\n');
}
