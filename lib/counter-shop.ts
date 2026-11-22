import { prisma } from '@/lib/prisma';
import { editProductWhere } from '@/lib/shop-edit-catalog';
import { getEdit } from '@/lib/shop-edits';
import { buildPricing } from '@/lib/catalog/pricing-read';
import { formatINR } from '@/lib/money';
import { productLinks, safeHex, type CounterCloth } from '@/lib/counter';
import type { Prisma } from '@prisma/client';

const select = {
  id:true,color:true,colorHex:true,size:true,images:true,
  product:{select:{slug:true,name:true,material:true,region:true,images:true,cataloguePreferredImage:true,aiTryOnEligible:true,
    sellingPrice:true,mrp:true,salePrice:true,saleStartsAt:true,saleEndsAt:true}},
} satisfies Prisma.VariantSelect;
type Row=Prisma.VariantGetPayload<{select:typeof select}>;
function mapCloth(variant:Row): CounterCloth | null {
  const p=variant.product;
  const hasOwn=variant.images.find(Boolean);
  // A variant with a different colour must use its own photo for colour ranking.
  const image=hasOwn || p.cataloguePreferredImage || p.images.find(Boolean);
  if (!image) return null;
  const tone=hasOwn?safeHex(variant.colorHex):'';
  return {id:'v-'+variant.id,kind:'shop',name:p.name,image,alt:p.name+(hasOwn&&variant.color?' in '+variant.color:''),
    palette:tone?[tone]:[],price:formatINR(buildPricing(p).effectivePrice),
    description:[variant.color,variant.size,p.material,p.region].filter(Boolean).join(' · '),...productLinks(p.slug,variant.id,p.aiTryOnEligible)};
}
export async function getCounterStock(requested:string[]) {
  const where={inventory:{gt:0},product:editProductWhere(getEdit('clothing')!)};
  const ids=requested.filter(k=>k.startsWith('v-')).map(k=>k.slice(2));
  // Fetch linked pieces even when they have moved out of the first edit.
  const pinned=ids.length?await prisma.variant.findMany({where:{...where,id:{in:ids}},select}):[];
  const rows=await prisma.variant.findMany({where,select,take:60,orderBy:[{product:{catalogueFeatured:'desc'}},{product:{createdAt:'desc'}},{id:'asc'}]});
  const unique=new Set<string>();
  const seenLooks=new Set<string>();
  const pinnedIds=new Set(pinned.map(v=>'v-'+v.id));
  return [...pinned,...rows].map(mapCloth).filter((item):item is CounterCloth=>{
    if(!item || unique.has(item.id)) return false;
    const look=item.href.split('?')[0]+'|'+item.image+'|'+item.palette.join(',');
    if(seenLooks.has(look) && !pinnedIds.has(item.id)) return false;
    unique.add(item.id);seenLooks.add(look);
    return true;
  });
}
