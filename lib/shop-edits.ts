export const shopEdits = [
  {slug:'sarees', name:'Sarees', title:'The saree edit', paths:['women/sarees'], legacy:['sarees','saris'], image:'/brand/studio-mirror.webp', alt:'A wine-red saree with a woven gold border', headline:'A saree to keep.', note:'Some sarees stay with you for years. Start with the border, the fall of the cloth, the colour you keep coming back to.'},
  {slug:'suits', name:'Suits', title:'The suit edit', paths:['women/apparel/salwar-suits','women/apparel/kurta-sets','women/apparel/anarkali','women/suits'], legacy:['suits','salwar-suits','kurta-sets','anarkali'], image:'/brand/fashion-suit.webp', alt:'A woman wearing a burnt-orange kurta with cream floral salwar trousers and a matching dupatta', headline:'A suit to live in.', note:'A kurta, a favourite pair of trousers, a dupatta worn your way. Start with how you want to feel in it.'},
  {slug:'home', name:'Objects for home', title:'Objects for home', paths:['home'], legacy:['home','home-decor','artefacts','artifacts'], image:'/brand/studio-imagine.webp', alt:'Wooden writing chest and striped mat in a Chettinad room', headline:'A corner of your own.', note:'A small selection of lamps, artefacts and objects to make a room feel like yours.'}
] as const;

export type EditSlug = typeof shopEdits[number]['slug'];
export type Edit = typeof shopEdits[number];
export const editHref = (slug:EditSlug) => '/edits/'+slug;
export const getEdit = (slug:string) => shopEdits.find(edit=>edit.slug===slug);
