const colours = [
  {key:'red', aliases:['red','laal','lal','surkh','vermilion','लाल']},
  {key:'indigo', aliases:['indigo','neel','नील']},
  {key:'blue', aliases:['blue','navy','neela','नीला']},
  {key:'pink', aliases:['pink','gulabi','gulaabi','गुलाबी']},
  {key:'yellow', aliases:['yellow','haldi','turmeric','peela','पीला']},
  {key:'green', aliases:['green','hara','हरा']},
  {key:'ivory', aliases:['ivory','cream','off white','off-white']},
  {key:'black', aliases:['black','kala','काला']},
  {key:'white', aliases:['white','safed','सफेद']},
  {key:'maroon', aliases:['maroon','wine','burgundy']},
];
const occasions = {
  wedding:['wedding','shaadi','shadi','शादी'], festive:['festive','festival','diwali','eid','diwali party'],
  work:['office','work','workwear'], everyday:['everyday','daily','casual'], gift:['gift','gifts','gifting','housewarming'],
} as const;
const has = (text: string, word: string) => new RegExp('(^|[^\\p{L}])'+word+'(?=$|[^\\p{L}])','iu').test(text);

export function shoppingHints(message: string) {
  const text=message.normalize('NFKC').toLowerCase();
  const wanted=colours.filter(group => group.aliases.some(alias=>has(text,alias)));
  const occasion=(Object.keys(occasions) as Array<keyof typeof occasions>).find(key=>occasions[key].some(x=>has(text,x)));
  const ignored=new Set([...wanted.flatMap(c=>c.aliases.flatMap(a=>a.split(/[- ]/))),...Object.values(occasions).flatMap(x=>[...x])]);
  return {colours:wanted.flatMap(g=>g.aliases), occasion, ignored};
}
export function wantsStyling(message:string) {
  return /(?:pair|style|match|wear|go(?:es)? with).*(?:saree|sari|jutti|blouse|jewel|jhumk|this|it)|(?:blouse|jutti|jewel|jhumk).*(?:pair|match|go(?:es)? with|wear)|my own (?:blouse|jewel|jutti)/i.test(message);
}
type Facts = {material:string|null;craft:string|null;occasion:string|null;color:string|null};
export type Occasion = NonNullable<ReturnType<typeof shoppingHints>['occasion']>;
export function rankingBrief(occasion: Occasion, facts: Facts[]) {
  // Only the agreed occasion and public merchandise fields are sent. No shopper text, id or history.
  return JSON.stringify({occasion, choices:facts.map((f,index)=>({index,material:f.material?.slice(0,80),craft:f.craft?.slice(0,80),occasion:f.occasion?.slice(0,80),colour:f.color?.slice(0,45)}))});
}
export function rankedIndices(raw: unknown, count: number) {
  const all=Array.from({length:count},(_,i)=>i);
  if (!Array.isArray(raw)) return all;
  const result=raw.filter((n):n is number=>Number.isInteger(n)&&n>=0&&n<count);
  return [...new Set([...result,...all])];
}
