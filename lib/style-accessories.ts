import { prisma } from '@/lib/prisma';
import { buildPricing } from '@/lib/catalog/pricing-read';
import { formatINR } from '@/lib/money';
import type { Prisma } from '@prisma/client';
import { isAccessorySku, type StyleOption } from '@/lib/stylebook';

const categories=(terms:string[]):Prisma.CategoryWhereInput=>({active:true,hidden:false,OR:terms.flatMap(t=>[
  {slug:{contains:t,mode:'insensitive' as const}},{path:{contains:t,mode:'insensitive' as const}},
])});
const jewellery=categories(['jewel','jhumk','earring','pendant','necklace','bangle']);
const footwear=categories(['jutti','jooti','mojari']);
const shoeNames:Prisma.ProductWhereInput={category:categories(['footwear','shoes']),OR:['jutti','jooti','mojari'].map(word=>({name:{contains:word,mode:'insensitive'}}))};
const select={id:true,images:true,color:true,size:true,product:{select:{id:true,slug:true,name:true,images:true,cataloguePreferredImage:true,category:{select:{slug:true,path:true}},
  mrp:true,sellingPrice:true,salePrice:true,saleStartsAt:true,saleEndsAt:true,variants:{select:{color:true},where:{inventory:{gt:0}}}}}} satisfies Prisma.VariantSelect;
export async function getStyleAccessories(requested:string[]=[],pinsOnly=false):Promise<StyleOption[]> {
  const ids=requested.filter(isAccessorySku).map(id=>id.slice(4));
  if(pinsOnly && !ids.length)return [];
  const where:Prisma.VariantWhereInput={inventory:{gt:0},product:{status:'ACTIVE',takedownAt:null,catalogueExclude:false,catalogueImageApproved:true,sellingPrice:{gt:0},catalogueStockVisibility:{in:['IN_STOCK_ONLY','SHOW_ALL','HIDE_STOCK']},OR:[{category:jewellery},{category:footwear},shoeNames]}};
  const pins=ids.length?await prisma.variant.findMany({where:{...where,id:{in:ids}},select}):[];
  const shelf=pinsOnly?[]:await prisma.variant.findMany({where,select,take:36,orderBy:[{product:{catalogueFeatured:'desc'}},{product:{createdAt:'desc'}},{id:'asc'}]});
  const seen=new Set<string>();
  return [...pins,...shelf].flatMap(v=>{
    const p=v.product;
    const image=v.images.find(Boolean)||(new Set(p.variants.map(x=>x.color)).size<=1?(p.cataloguePreferredImage||p.images.find(Boolean)):undefined);
    if(!image||seen.has(v.id))return [];
    seen.add(v.id);
    const category=[p.category.slug,p.category.path].join(' ').toLowerCase();
    const slot=/jewel|jhumk|earring|pendant|necklace|bangle/.test(category)?'jewel' as const:'shoe' as const;
    return [{id:'sku-'+v.id,name:[p.name,v.color,v.size].filter(Boolean).join(' · '),slot,image,productId:p.id,
      href:'/products/'+encodeURIComponent(p.slug)+'?variant='+encodeURIComponent(v.id),price:formatINR(buildPricing(p).effectivePrice)}];
  });
}
