import { prisma } from '@/lib/prisma';
import { buildPricing } from '@/lib/catalog/pricing-read';
import { formatINR } from '@/lib/money';
import type { Prisma } from '@prisma/client';
import { isAccessorySku, slots, type Slot, type StyleOption } from '@/lib/stylebook';

const category = (terms:string[]):Prisma.CategoryWhereInput => ({active:true,hidden:false,OR:terms.flatMap(term=>[
  {slug:{contains:term,mode:'insensitive' as const}},{path:{contains:term,mode:'insensitive' as const}},
])});
const jewellery = ['jewel','jhumk','earring','pendant','necklace','bangle','choker','bracelet','anklet'];
const shoes = ['jutti','juti','jooti','mojari'];
const slotWhere:Record<Slot,Prisma.ProductWhereInput> = {
  blouse:{OR:[{category:category(['blouse','choli'])},{category:category(['women-apparel','women/apparel','tops']),name:{contains:'blouse',mode:'insensitive'}}]},
  jewel:{category:category(jewellery)},
  shoe:{OR:[{category:category(shoes)},{category:category(['footwear','shoes']),OR:shoes.map(word=>({name:{contains:word,mode:'insensitive'}}))}]},
};
const merch:Prisma.ProductWhereInput = {status:'ACTIVE',takedownAt:null,catalogueExclude:false,catalogueImageApproved:true,sellingPrice:{gt:0},
  catalogueStockVisibility:{in:['IN_STOCK_ONLY','SHOW_ALL','HIDE_STOCK']}};
const select = {id:true,images:true,color:true,colorHex:true,material:true,size:true,sellingPrice:true,product:{select:{
  id:true,slug:true,name:true,craft:true,region:true,occasion:true,material:true,technique:true,poeticLine:true,images:true,cataloguePreferredImage:true,
  category:{select:{slug:true,path:true}},mrp:true,sellingPrice:true,salePrice:true,saleStartsAt:true,saleEndsAt:true,
  _count:{select:{variants:true}},
}}} satisfies Prisma.VariantSelect;
type Row = Prisma.VariantGetPayload<{select:typeof select}>;
function option(v:Row):StyleOption[] {
  const p=v.product;
  const image=v.images.find(Boolean)||(p._count.variants===1?(p.cataloguePreferredImage||p.images.find(Boolean)):undefined);
  const price=v.sellingPrice??buildPricing(p).effectivePrice;
  if(!image||price<=0) return [];
  const path=[p.category.path,p.category.slug].join(' ').toLowerCase();
  const slot:Slot=jewellery.some(word=>path.includes(word))?'jewel':/blouse|choli/i.test(path+' '+p.name)?'blouse':'shoe';
  return [{id:'sku-'+v.id,slot,productId:p.id,slug:p.slug,image,name:p.name,colour:v.color,hex:v.colorHex,size:v.size,material:v.material||p.material,
    craft:p.craft,technique:p.technique,region:p.region,occasion:p.occasion,description:p.poeticLine,pricePaise:price,price:formatINR(price),
    href:'/products/'+encodeURIComponent(p.slug)+'?variant='+encodeURIComponent(v.id)}];
}
export async function getStyleAccessories(requested:string[]=[],pinsOnly=false):Promise<StyleOption[]> {
  const ids=requested.filter(isAccessorySku).map(id=>id.slice(4));
  const common = {inventory:{gt:0},product:{...merch,OR:Object.values(slotWhere)}};
  const pins = ids.length ? await prisma.variant.findMany({where:{...common,id:{in:ids}},select}) : [];
  const rows = [...pins];
  if(!pinsOnly) {
    for(const slot of slots) {
      // Retrieve across styles first. A long size run must not crowd out other designs.
      const products=await prisma.product.findMany({where:{AND:[merch,slotWhere[slot],{variants:{some:{inventory:{gt:0}}}}]},select:{id:true},
        orderBy:[{catalogueFeatured:'desc'},{createdAt:'desc'},{id:'asc'}],take:60});
      if(products.length) rows.push(...await prisma.variant.findMany({where:{...common,productId:{in:products.map(p=>p.id)}},select,orderBy:{id:'asc'}}));
    }
  }
  return [...new Map(rows.flatMap(option).map(v=>[v.id,v])).values()];
}
