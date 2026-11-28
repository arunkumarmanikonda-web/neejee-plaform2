import { shoppingHints } from './sakhi-match';

const topics = {
  jewellery: {match:/jewell?ery|necklace|jhumk|earrings?|pearls?|bangles?|kundan|झुमक|गहन/i, tip:'If the border is intricate, try one focal piece, such as jhumkas, and leave the neckline open. A plain pallu gives a necklace more room.'},
  blouse: {match:/blouse|neckline|sleeves?|ब्लाउज/i, tip:'Pick up the smallest accent colour in the border for the blouse. For a quieter look, choose a matte blouse close to the body of the saree.'},
  footwear: {match:/jutti|jooti|shoes?|sandals?|heels?|footwear/i, tip:'Try the shoes before you set the saree length. A low jutti works well for long evenings. Match its embroidery to one tone in the border.'},
  drape: {match:/drap(?:e|ing)|pleats?|pallu|पल्लू/i, tip:'Put on your shoes first, set the hem just above the floor, then make even front pleats. Try an open pallu for a broad border or a narrow shoulder pleat for easier movement.'},
  lighting: {match:/light(?:ing)?|lamps?/i, tip:'Place a table lamp below eye level when seated. Try it against a plain wall to let the painted shade stand out, and check its measurements against your table.'},
  outfit: {match:/style|wear|pair|match|dress for|what goes|outfit|accessori/i, tip:'Start with the piece you want to wear, then repeat one of its colours in the shoes or blouse. Tell me the colour and the occasion and we can narrow it down.'},
};
type Topic = keyof typeof topics;
export function styleBrief(q: string) {
  if (!/how|what|help|could|can i|should|advise|suggest|style|pair|match|go(?:es)? with|tips|कैसे|पहन/i.test(q)) return;
  if (/how.*(?:aaina|mirror)|own (?:accessory|blouse|jutti|jewellery)|how much|under [₹\d]|where.*buy/i.test(q)) return;
  const topic=(Object.keys(topics) as Topic[]).find(t=>topics[t].match.test(q));
  if (!topic) return;
  const hints=shoppingHints(q);
  const fabric = ['silk','cotton','organza','chiffon','linen','velvet','banarasi','bandhani'].find(word=>q.toLowerCase().includes(word));
  return {topic, colour:hints.colours[0] || '', fabric:fabric || '', occasion:hints.occasion || '', language:/[\u0900-\u097f]/.test(q)?'Hindi':'English'};
}
export const styleTip = (topic: Topic) => topics[topic].tip;
