// v23.39.2 — Type shim for pdf-parse (which ships no .d.ts)
declare module 'pdf-parse' {
  interface PdfParseResult {
    text: string;
    numpages: number;
    info: any;
    metadata: any;
    version: string;
  }
  const pdf: (buffer: Buffer | Uint8Array, options?: any) => Promise<PdfParseResult>;
  export default pdf;
  export = pdf;
}
