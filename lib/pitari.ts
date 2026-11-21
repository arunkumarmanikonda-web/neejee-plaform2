export type PitariLink = { label: string; href: string };
export type PitariReply = { text: string; links: PitariLink[]; piece?: string };
export const pitariTopics = ['A gift under ₹5,000', 'Where is it from?', 'Shipping to my home'];
const synonyms: [RegExp, string][] = [
  [/\b(lamps?|lighting|roshni)\b|लैंप|रोशनी/i, 'lamp'],
  [/\b(sarees?|saris?)\b|साड़ी/i, 'sari'],
  [/\b(vases?)\b|फूलदान/i, 'vase'], [/\b(cushions?)\b/i,'cushion'],
  [/\b(mugs?)\b/i,'mug'], [/\b(candles?)\b/i,'candle'], [/\b(brass|peetal)\b|पीतल/i,'brass'],
  [/\b(ceramics?)\b|सिरेमिक/i,'ceramic'], [/\b(silks?)\b|रेशम/i,'silk'],
];
export function parsePitari(input: string) {
  const q = input.normalize('NFKC').toLowerCase().replace(/[०-९]/g, n => String('०१२३४५६७८९'.indexOf(n))).replace(/(?<=\d),(?=\d)/g, '');
  const price = q.match(/(?:under|below|less than|within|up to|upto|budget(?: of)?|max(?:imum)?|तक)[\s₹rs.]*(\d+(?:\.\d+)?)\s*(k\b|thousand)?/i) ||
    q.match(/(?:₹|rs\.?)?\s*(\d+(?:\.\d+)?)\s*(k\b|thousand)?\s*(?:रुपये\s*)?(?:से कम|तक|ke andar|se kam)/i);
  const exclusive = !!price && /under|below|less than|से कम|se kam/.test(price[0]);
  const maxPaise = price ? Math.max(0,Math.round(Number(price[1]) * (price[2] ? 100000 : 100)) - (exclusive ? 1 : 0)) : undefined;
  const terms = synonyms.filter(([re]) => re.test(q)).map(([,v]) => v);
  const service = /track|my order|order status|ऑर्डर/.test(q) ? 'track' :
    /return|refund|exchange|वापस/.test(q) ? 'returns' :
    /shipping|deliver|dispatch|pincode|डिलीवरी/.test(q) ? 'shipping' :
    /contact|human|support|speak to/.test(q) ? 'contact' : undefined;
  const detail: 'origin' | 'material' | 'care' | undefined = /where.*from|origin|maker|who made|कहाँ|kahan|made in|craft story/.test(q) ? 'origin' :
    /material|made of|made from|what.*made|सामग्री/.test(q) ? 'material' :
    /care|clean|wash|सफाई/.test(q) ? 'care' : undefined;
  const gift = /\bgifts?\b|gifting|housewarming|tohfa|tohfe|उपहार|तोहफा/.test(q);
  const browse = /\b(piece|pieces|finds|browse|collection|home|ghar|shop|recommend|show me everything)\b|घर|दिखाओ/.test(q);
  const stop = new Set([
    'show me everything do you have any please a an the is it this that in of for my what where from i want would like find buy some looking something available with',
    'under below within up to rs budget can your sell gift gifts gifting or and piece pieces home collection browse take tell more are new housewarming made who its at by than less thousand',
    'surprise today current mom mum mummy sister dad father parents present friend mother birthday which send mujhe need room living bedroom could our thank',
    'care clean wash origin material maker does come shopping inr how about comes whom another different ke andar se kam khoj tohfa tohfe personal',
  ].join(' ').split(' '));
  const words = q.match(/[a-z]{3,}/g)?.filter(x=>!stop.has(x) && !synonyms.some(([re])=>re.test(x))).slice(0,4) || [];
  return { maxPaise, terms, words, service, detail, gift, browse };
}
export const serviceReplies: Record<string, PitariReply> = {
  track: { text: 'You can check the latest update for your own order in order tracking.', links: [{label:'Track my order',href:'/help/track'}] },
  returns: { text: 'Return eligibility depends on the piece. Check its product page and the returns policy before placing your order.', links:[{label:'Read the returns policy',href:'/help/returns'}] },
  shipping: { text: 'The shipping guide explains delivery. Checkout shows the options for your address.', links:[{label:'Shipping and delivery',href:'/help/shipping'}] },
  contact: {text:'The Neejee team can help with a detail that needs a person.',links:[{label:'Contact Neejee',href:'/help/contact'}]},
};
