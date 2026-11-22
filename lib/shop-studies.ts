import { editorialLooks } from './stylebook';

export type Study = {
  id: string;
  name: string;
  shade: string;
  swatch: string;
  image: string;
  detail: string;
  pairing: string;
  focus: string;
  group: 'sarees' | 'suits';
  price: number;
};

type Row = [string, string, string, string, string, string, string, number];
const sarees: Row[] = [
  ['surkh', 'Surkh Gold Check', 'Vermilion', '#a4382a', 'A fine gold grid opens into a broad, wine-coloured floral pallu.', 'Antique-gold juttis and small jhumkas echo the checks.', '64% 62%', 680000],
  ['neel', 'Neel Diamond', 'Indigo', '#344d6a', 'Ivory dotted diamonds sit inside bands of indigo and fine stripes.', 'Try tan juttis and a silver pendant against the indigo.', '68% 59%', 420000],
  ['haldi', 'Haldi Kinari', 'Turmeric', '#bf8b25', 'Deep maroon triangles follow the edge of a turmeric-yellow drape.', 'Ivory juttis leave the maroon border in focus.', '66% 55%', 560000],
  ['sage', 'Pista Gold Edge', 'Pistachio', '#919b72', 'A narrow gold edge traces the pale pistachio drape.', 'Bring the fine gold edge into a pair of jhumkas.', '56% 51%', 480000],
  ['rose', 'Gulabi', 'Rose', '#b76f7f', 'Soft rose folds frame the blouse and fall into a long pallu.', 'Try pearl studs and an ivory floral jutti.', '54% 52%', 520000],
  ['indigo', 'Saanjh Blue', 'Indigo', '#344d6a', 'An inky blue drape with a contrasting edge.', 'Pair it with a silver pendant and tan leather juttis.', '54% 52%', 590000],
];
const suits: Row[] = [
  ['wine-suit', 'Gul Booti Suit', 'Wine', '#893e50', 'Ivory sprigs scatter across a wine kurta, shown with tapered ivory trousers and a cream dupatta.', 'Tan flats pick up the warm ground. Try a small pearl at the ear.', '52% 39%', 390000],
  ['indigo-suit', 'Neel Lakeer Suit', 'Indigo', '#344d6a', 'Fine pale stripes run down the long kurta and dupatta, over wide indigo palazzos.', 'Try a silver pendant at the split neckline and simple tan flats.', '52% 40%', 440000],
];

function makeStudy(group: Study['group'], row: Row): Study {
  const [id, name, shade, swatch, detail, pairing, focus, price] = row;
  const image = editorialLooks.find(look => look.id === id)?.image || '/brand/bazaar/' + id + '.webp';
  return { id, name, shade, swatch, detail, pairing, focus, price, group, image };
}
export const studies: Study[] = [
  ...sarees.map(row => makeStudy('sarees', row)),
  ...suits.map(row => makeStudy('suits', row)),
];
export function previewPricingEnabled() {
  return process.env.VERCEL_ENV === 'preview' || process.env.NODE_ENV === 'development';
}
export function studyIdsFor(department: string) {
  return studies.filter(s => department === 'clothing' || s.group === department).map(s => s.id);
}
