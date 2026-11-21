import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { resolveMedia } from '@/lib/catalog/media-read';
import { buildPricing } from '@/lib/catalog/pricing-read';
import { type Edit } from '@/lib/shop-edits';

export function editProductWhere(edit:Edit):Prisma.ProductWhereInput {
  return {
    status:'ACTIVE', takedownAt:null, catalogueExclude:false, catalogueImageApproved:true,
    catalogueStockVisibility:{in:['IN_STOCK_ONLY','HIDE_STOCK','SHOW_ALL']},
    sellingPrice:{gt:0}, variants:{some:{inventory:{gt:0}}},
    OR:[{cataloguePreferredImage:{not:''}},{images:{isEmpty:false}},{variants:{some:{inventory:{gt:0},images:{isEmpty:false}}}}],
    category:{active:true,hidden:false,OR:[
      ...edit.paths.flatMap(path=>[{path},{path:{startsWith:path+'/'}}]),
      {path:null,slug:{in:[...edit.legacy]}},
    ]},
  };
}

const pick = {
  id:true,name:true,slug:true,material:true,region:true,craft:true,poeticLine:true,images:true,badges:true,
  cataloguePreferredImage:true,catalogueImageApproved:true,mrp:true,sellingPrice:true,salePrice:true,saleStartsAt:true,saleEndsAt:true,aiTryOnEligible:true,
  variants:{where:{inventory:{gt:0}},select:{id:true,images:true,inventory:true}}
} satisfies Prisma.ProductSelect;
const order:Prisma.ProductOrderByWithRelationInput[]=[{cataloguePinHero:'desc'},{catalogueFeatured:'desc'},{createdAt:'desc'},{id:'asc'}];
type Product=Prisma.ProductGetPayload<{select:typeof pick}>;
function card(p:Product) {
  const m=resolveMedia(p);
  return {id:p.id,name:p.name,slug:p.slug,material:p.material,region:p.region,craft:p.craft,poeticLine:p.poeticLine,badges:p.badges,
    sellingPrice:p.sellingPrice,mrp:p.mrp,salePrice:p.salePrice,saleStartsAt:p.saleStartsAt,saleEndsAt:p.saleEndsAt,
    aiTryOnEligible:p.aiTryOnEligible,price:buildPricing(p).effectivePrice,images:m.approvedGallery,cover:m.approvedPrimaryImage};
}
export async function editLead(edit:Edit) {
  const row=await prisma.product.findFirst({where:editProductWhere(edit),select:pick,orderBy:order});
  if(!row) return null;
  const p=card(row);
  return {slug:p.slug,name:p.name,cover:p.cover,price:p.price,mirror:p.aiTryOnEligible};
}
export async function readEdit(edit:Edit,requestedPage:number) {
  const where=editProductWhere(edit);
  const perPage=12;
  const total=await prisma.product.count({where});
  const pages=Math.max(1,Math.ceil(total/perPage));
  const page=Math.min(pages,Math.max(1,Number.isFinite(requestedPage)?requestedPage:1));
  const rows=total?await prisma.product.findMany({where,select:pick,orderBy:order,skip:(page-1)*perPage,take:perPage}):[];
  return {pieces:rows.map(card),page,pages,total};
}
