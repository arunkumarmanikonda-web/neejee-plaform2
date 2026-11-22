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
      {slug:{in:[...edit.legacy, ...edit.paths.map(path => path.replaceAll('/', '-'))]}, OR:[{path:null},{path:''},{path:{startsWith:edit.slug==='home'||edit.slug==='furniture'?'home/':'women/'}}]},
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
export async function readEdit(edit:Edit,requestedPage:number,colour = '',sort = 'featured') {
  const base = editProductWhere(edit);
  const total = await prisma.product.count({where:base});
  const where: Prisma.ProductWhereInput = colour ? {AND:[base,{variants:{some:{inventory:{gt:0},color:colour}}}]} : base;
  const matches = colour && total ? await prisma.product.count({where}) : total;
  const pages = Math.max(1, Math.ceil(matches/12));
  const page = Math.min(pages, Math.max(1, Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1));
  const ordered: Prisma.ProductOrderByWithRelationInput[] = sort === 'name' ? [{name:'asc'},{id:'asc'}] : sort === 'newest' ? [{createdAt:'desc'},{id:'asc'}] : order;
  const rows = matches ? await prisma.product.findMany({where,select:pick,orderBy:ordered,skip:(page-1)*12,take:12}) : [];
  const variants = total ? await prisma.variant.findMany({where:{product:base,inventory:{gt:0},color:{not:null}},select:{color:true},distinct:['color'],orderBy:{color:'asc'}}) : [];
  return {pieces:rows.map(card),page,pages,total,matches,colours:variants.flatMap(v=>v.color?[v.color]:[])};
}
