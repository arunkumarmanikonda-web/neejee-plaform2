export const pieceFields = {
  colour: 'Colour',
  motif: 'Motif or pattern',
  border: 'Border',
  pallu: 'Pallu',
  designReference: 'Design reference',
  contents: 'What comes with this piece',
  cloth: 'Saree length and width',
  blouse: 'Blouse piece',
  weave: 'Loom and weave',
  handfeel: 'How it feels against the skin',
  drape: 'Weight and fall',
  opacity: 'Sheerness and lining',
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
  if (/soft|scratchy|texture|handfeel|against.*skin/i.test(question)) return 'handfeel';
  if (/drape|drapes|fall|weight|heavy|lightweight/i.test(question)) return 'drape';
  if (/sheer|opaque|opacity|lining|see.through/i.test(question)) return 'opacity';
  if (/weave|loom|बुनाई/i.test(question)) return 'weave';
  if (/differ|vary|variation/i.test(question)) return 'variation';
  if (/pallu|पल्लू/i.test(question)) return 'pallu';
  if (/border|किनारी/i.test(question)) return 'border';
  if (/motif|pattern/i.test(question)) return 'motif';
  if (/colou?r|रंग/i.test(question)) return 'colour';
  if (/design reference|inspir/i.test(question)) return 'designReference';
  return undefined;
}
