export const shopEdits = [
  {slug:'sarees', name:'Sarees', title:'The saree edit', paths:['women/sarees'], legacy:['sarees','saris'], image:'/brand/studio-mirror.webp', alt:'A wine-red saree with a woven gold border', headline:'A saree to keep.', note:'Some sarees stay with you for years. Start with the border, the fall of the cloth, the colour you keep coming back to.'},
  {slug:'suits', name:'Suits', title:'The suit edit', paths:['women/apparel/salwar-suits','women/apparel/kurta-sets','women/apparel/anarkali','women/suits'], legacy:['suits','salwar-suits','kurta-sets','anarkali'], image:'/brand/fashion-suit.webp', alt:'A woman wearing a burnt-orange kurta with cream floral salwar trousers and a matching dupatta', headline:'A suit to live in.', note:'A kurta, a favourite pair of trousers, a dupatta worn your way. Start with how you want to feel in it.'},
  {slug:'home', name:'Home & objects', title:'Objects for home', paths:['home'], legacy:['home','home-decor','artefacts','artifacts'], image:'/brand/studio-imagine.webp', alt:'Wooden writing chest and striped mat in a Chettinad room', headline:'A corner of your own.', note:'Lamps, ceramics and objects chosen for the way they live in a room.'},
  {slug:'clothing',name:'Sarees & suits',title:'Sarees & suit sets',paths:['women/sarees','women/apparel','women/suits'],legacy:['sarees','saris','salwar-suits','kurta-sets','suits','kurtas','apparel'],image:'/brand/journey-loom.webp',alt:'A working handloom in Varanasi',headline:'Cloth, close up.',note:'Begin with a saree or a suit. Look at the surface, the fall of the cloth and the finishing that gives each piece its character.'},
  {slug:'furniture',name:'Furniture',title:'The furniture notebook',paths:['home/furniture','home/home-furniture','furniture'],legacy:['furniture','home-furniture'],image:'/brand/journey-furniture.webp',alt:'A decorated wooden bed at the Crafts Museum in New Delhi',headline:'Made for a room.',note:'Before choosing a piece of furniture, look at its joints, its proportions and where a hand rests. A museum bed opens this chapter of our notebook.'}
] as const;

export type EditSlug = typeof shopEdits[number]['slug'];
export type Edit = typeof shopEdits[number];
export const editHref = (slug:EditSlug) => '/edits/'+slug;
export const getEdit = (slug:string) => shopEdits.find(edit=>edit.slug===slug);

export const houseNavigation = [shopEdits[0],shopEdits[1],shopEdits[2]] as const;
