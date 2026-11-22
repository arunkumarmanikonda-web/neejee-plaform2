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
