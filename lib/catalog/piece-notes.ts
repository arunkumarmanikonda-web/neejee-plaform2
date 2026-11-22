export const pieceFields = {
  contents: 'What comes with this piece',
  cloth: 'Saree length and width',
  blouse: 'Blouse piece',
  weave: 'Loom and weave',
  fit: 'Fit and garment measurements',
  dimensions: 'Object dimensions',
  finish: 'Material and finish',
  variation: 'What can vary by hand',
} as const;
export type PieceFacts = Partial<Record<keyof typeof pieceFields, string>>;
export const notesPageType = 'piece-notes';
export const notesTemplate = 'SYSTEM_JSON';
export const notesSlug = (id:string) => 'piece-notes-'+id;

export function readPieceFacts(input: unknown): PieceFacts {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const result: PieceFacts = {};
  for (const key of Object.keys(pieceFields) as (keyof PieceFacts)[]) {
    const value = (input as Record<string, unknown>)[key];
    if (typeof value === 'string' && value.trim()) result[key] = value.trim().slice(0,400);
  }
  return result;
}

export function requestedPieceField(question: string): keyof PieceFacts | undefined {
  if (/blouse|ब्लाउज|ब्लाउज़/i.test(question)) return 'blouse';
  if (/what comes|what.*included|include|set contain|साथ|saath/i.test(question)) return 'contents';
  if (/saree.*(long|wide|length|width)|sari.*length|length.*(sari|saree)/i.test(question)) return 'cloth';
  if (/height|depth|object dimensions|lamp.*(tall|wide)|how tall|चौड़ाई/i.test(question)) return 'dimensions';
  if (/fit|garment measurements|kurta.*long|bust|sleeve/i.test(question)) return 'fit';
  if (/weave|loom|बुनाई/i.test(question)) return 'weave';
  if (/differ|vary|variation/i.test(question)) return 'variation';
  return undefined;
}
