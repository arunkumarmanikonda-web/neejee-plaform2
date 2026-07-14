import path from 'path';

export type ApplicationDocType =
  | 'PAN_CARD'
  | 'GST_CERTIFICATE'
  | 'MSME_CERTIFICATE'
  | 'CANCELLED_CHEQUE'
  | 'BANK_STATEMENT'
  | 'CERTIFICATION'
  | 'OTHER';

export type ExtractedDocFields = {
  pans: string[];
  gstins: string[];
  cins: string[];
  ifscs: string[];
  bankAccounts: string[];
  msmeNumbers: string[];
};

export type UploadedApplicationDocument = {
  docType: ApplicationDocType;
  title: string | null;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storageKey: string;
  extractedTextPreview: string;
  extractedFields: ExtractedDocFields;
};

function uniq(items: string[]): string[] {
  return Array.from(new Set(items.filter(Boolean)));
}

function normalizeText(text: string): string {
  return String(text || '')
    .replace(/\u0000/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractStructuredFields(text: string): ExtractedDocFields {
  const source = String(text || '').toUpperCase();

  return {
    pans: uniq(source.match(/\b[A-Z]{5}[0-9]{4}[A-Z]\b/g) || []),
    gstins: uniq(source.match(/\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/g) || []),
    cins: uniq(source.match(/\b[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}\b/g) || []),
    ifscs: uniq(source.match(/\b[A-Z]{4}0[A-Z0-9]{6}\b/g) || []),
    bankAccounts: uniq(source.match(/\b[0-9]{9,18}\b/g) || []),
    msmeNumbers: uniq(source.match(/\bUDYAM-[A-Z]{2}-\d{2}-\d{7}\b/g) || []),
  };
}

function isPdf(mimeType: string, fileName: string): boolean {
  return mimeType === 'application/pdf' || path.extname(fileName).toLowerCase() === '.pdf';
}

function isCsvOrText(mimeType: string, fileName: string): boolean {
  const ext = path.extname(fileName).toLowerCase();
  return ['.csv', '.txt'].includes(ext)
    || ['text/csv', 'text/plain', 'application/csv', 'application/vnd.ms-excel'].includes(mimeType);
}

function isImage(mimeType: string, fileName: string): boolean {
  const ext = path.extname(fileName).toLowerCase();
  return ['.png', '.jpg', '.jpeg', '.webp'].includes(ext) || mimeType.startsWith('image/');
}

export async function extractTextFromDocument(input: {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
}): Promise<string> {
  if (isPdf(input.mimeType, input.fileName)) {
    const pdfParseMod = await import('pdf-parse');
    const pdfParse = (pdfParseMod.default || pdfParseMod) as any;
    const parsed = await pdfParse(input.buffer);
    return normalizeText(parsed?.text || '');
  }

  if (isCsvOrText(input.mimeType, input.fileName)) {
    return normalizeText(input.buffer.toString('utf8'));
  }

  if (isImage(input.mimeType, input.fileName)) {
    const tesseract = await import('tesseract.js');
    const result: any = await (tesseract as any).recognize(input.buffer, 'eng');
    return normalizeText(result?.data?.text || '');
  }

  return '';
}