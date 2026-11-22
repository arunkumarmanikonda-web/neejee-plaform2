import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { resolveMedia } from '@/lib/catalog/media-read';
import { buildPricing } from '@/lib/catalog/pricing-read';
import { findSareeTerms } from './saree-vocabulary';
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
  id:true,name:true,slug:true,material:true,technique:true,state:true,region:true,craft:true,poeticLine:true,images:true,badges:true,
  cataloguePreferredImage:true,catalogueImageApproved:true,mrp:true,sellingPrice:true,salePrice:true,saleStartsAt:true,saleEndsAt:true,aiTryOnEligible:true,
  variants:{where:{inventory:{gt:0}},select:{id:true,images:true,inventory:true,color:true}}
} satisfies Prisma.ProductSelect;
const order:Prisma.ProductOrderByWithRelationInput[]=[{cataloguePinHero:'desc'},{catalogueFeatured:'desc'},{createdAt:'desc'},{id:'asc'}];
type Product=Prisma.ProductGetPayload<{select:typeof pick}>;
function card(p:Product) {
  const m=resolveMedia(p);
  return {id:p.id,name:p.name,slug:p.slug,material:p.material,technique:p.technique,state:p.state,colours:[...new Set(p.variants.flatMap(v=>v.color?[v.color]:[]))],region:p.region,craft:p.craft,poeticLine:p.poeticLine,badges:p.badges,
    sellingPrice:p.sellingPrice,mrp:p.mrp,salePrice:p.salePrice,saleStartsAt:p.saleStartsAt,saleEndsAt:p.saleEndsAt,
    aiTryOnEligible:p.aiTryOnEligible,price:buildPricing(p).effectivePrice,images:m.approvedGallery,cover:m.approvedPrimaryImage};
}
export async function editLead(edit:Edit) {
  const row=await prisma.product.findFirst({where:editProductWhere(edit),select:pick,orderBy:order});
  if(!row) return null;
  const p=card(row);
  return {slug:p.slug,name:p.name,cover:p.cover,price:p.price,mirror:p.aiTryOnEligible,
    images:p.images,colour:p.colours[0],craft:p.craft || p.technique,material:p.material,region:p.region || p.state};
}
export async function readEdit(edit:Edit,requestedPage:number,colour = '',sort = 'featured',textile = '') {
  const base = editProductWhere(edit);
  const total = await prisma.product.count({where:base});
  const filters:Prisma.ProductWhereInput[]=[base];
  if(colour) filters.push({variants:{some:{inventory:{gt:0},color:colour}}});
  if(textile.trim()) {
    const terms=findSareeTerms(textile).filter(t=>!['silk','cotton'].includes(t.id));
    const words=[...new Set([textile.trim(), ...terms.flatMap(t=>[t.name,...t.aliases])])];
    const fields=['name','craft','material','technique','region','state','cluster'] as const;
    filters.push({OR:words.flatMap(word=>fields.map(field=>({[field]:{contains:word,mode:'insensitive'}})))});
  }
  const where:Prisma.ProductWhereInput={AND:filters};
  const matches = filters.length>1 && total ? await prisma.product.count({where}) : total;
  const pages = Math.max(1, Math.ceil(matches/12));
  const page = Math.min(pages, Math.max(1, Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1));
  const ordered: Prisma.ProductOrderByWithRelationInput[] = sort === 'name' ? [{name:'asc'},{id:'asc'}] : sort === 'newest' ? [{createdAt:'desc'},{id:'asc'}] : order;
  const rows = matches ? await prisma.product.findMany({where,select:pick,orderBy:ordered,skip:(page-1)*12,take:12}) : [];
  const variants = total ? await prisma.variant.findMany({where:{product:base,inventory:{gt:0},color:{not:null}},select:{color:true},distinct:['color'],orderBy:{color:'asc'}}) : [];
  return {pieces:rows.map(card),page,pages,total,matches,colours:variants.flatMap(v=>v.color?[v.color]:[])};
}
