import { studyTextiles } from './study-textiles';
import { editorialLooks } from './stylebook';

export type Study = {
  id: string;
  alias: string;
  name: string;
  shade: string;
  swatch: string;
  image: string;
  caption: string;
  detail: string;
  pairing: string;
  focus: string;
  group: 'sarees' | 'suits';
  price: number;
};

type SareeRow = Pick<Study, 'id' | 'shade' | 'swatch' | 'pairing' | 'focus' | 'price'>;
const sarees: SareeRow[] = [
  {id:'surkh', shade:'Vermilion', swatch:'#a4382a', pairing:'Pick up the gold checks with a small jhumka. A wine blouse brings out the deepest colour in the pallu.', focus:'64% 62%', price:680000},
  {id:'neel', shade:'Indigo', swatch:'#344d6a', pairing:'An ivory blouse picks up the dots. Try silver at the ear and tan juttis below the striped hem.', focus:'68% 59%', price:420000},
  {id:'haldi', shade:'Turmeric', swatch:'#bf8b25', pairing:'Wear a maroon blouse to carry the temple border up to the shoulder. An ivory jutti leaves the yellow in focus.', focus:'66% 55%', price:560000},
  {id:'sage', shade:'Pistachio', swatch:'#919b72', pairing:'Try small gold jhumkas with the fine border, or an ivory blouse and pearl studs for a softer pairing.', focus:'56% 51%', price:480000},
  {id:'rose', shade:'Rose', swatch:'#b76f7f', pairing:'An ivory blouse shows through the sheer shoulder. Pearl studs and an ivory floral jutti pick up that pale note.', focus:'54% 52%', price:520000},
  {id:'indigo', shade:'Indigo', swatch:'#344d6a', pairing:'Tan leather juttis pick up the warmth of the copper-toned border. A silver pendant stands out against the deep blue.', focus:'54% 52%', price:590000},
];
const suits: Study[] = [
  {
    id:'wine-suit', alias:'Gul Booti', name:'Wine floral kurta set', shade:'Wine', swatch:'#893e50',
    image:'/brand/bazaar/wine-suit.webp', group:'suits', focus:'52% 39%', price:390000,
    caption:'Ivory trousers and a cream tasselled dupatta.',
    detail:'Small ivory sprigs run in neat rows down the wine kurta. The straight hem sits over tapered ivory trousers. The cream dupatta picks up the flowers and finishes in small tassels.',
    pairing:'Ivory juttis draw the trousers and dupatta together. Leave the patterned neckline open and try a pearl stud.',
  },
  {
    id:'indigo-suit', alias:'Neel Lakeer', name:'Indigo striped kurta & palazzo set', shade:'Indigo', swatch:'#344d6a',
    image:'/brand/bazaar/indigo-suit.webp', group:'suits', focus:'52% 40%', price:440000,
    caption:'Wide-leg palazzos and a matching tasselled dupatta.',
    detail:'Fine pale stripes run from the split neckline to the hem of the indigo kurta. The wide-leg palazzos carry the same stripe. A matching dupatta finishes in short dark tassels.',
    pairing:'A short silver pendant sits neatly at the split neckline. Pair with plain tan juttis beneath the wide trouser hems.',
  },
];

export const studies: Study[] = [
  ...sarees.map((row): Study => {
    const textile = studyTextiles[row.id];
    const image = editorialLooks.find(look => look.id === row.id)!.image;
    return { ...row, group:'sarees', alias:textile.alias, name:textile.name, caption:textile.caption, detail:textile.description, image };
  }),
  ...suits,
];
export function previewPricingEnabled() {
  return process.env.NEXT_PUBLIC_NEEJEE_SAMPLE_SHOP === '1' && process.env.VERCEL_ENV !== 'production';
}
export function studyIdsFor(department: string) {
  return studies.filter(s => department === 'clothing' || s.group === department).map(s => s.id);
}
