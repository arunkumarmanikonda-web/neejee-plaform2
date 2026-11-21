import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { resolveMedia } from '@/lib/catalog/media-read';
import { buildPricing } from '@/lib/catalog/pricing-read';
import type { StudioMode } from '@/lib/studio';

const selection = {
  id:true, slug:true, name:true, material:true, craft:true, category:{select:{name:true}},
  mrp:true, sellingPrice:true, salePrice:true, saleStartsAt:true, saleEndsAt:true,
  images:true, catalogueImageApproved:true, cataloguePreferredImage:true,
  variants:{select:{id:true,images:true,inventory:true,color:true,size:true},orderBy:{id:'asc'}},
} satisfies Prisma.ProductSelect;

function available(mode:StudioMode):Prisma.ProductWhereInput {
  return {
    status:'ACTIVE', takedownAt:null, catalogueExclude:false, catalogueImageApproved:true,
    catalogueStockVisibility:{in:['IN_STOCK_ONLY','SHOW_ALL','HIDE_STOCK']}, sellingPrice:{gt:0}, variants:{some:{inventory:{gt:0}}},
    OR:[{cataloguePreferredImage:{not:''}},{images:{isEmpty:false}},{variants:{some:{images:{isEmpty:false},inventory:{gt:0}}}}],
    ...(mode==='mirror'?{aiTryOnEligible:true}:{aiRoomEligible:true}),
  };
}
type Row = Prisma.ProductGetPayload<{select:typeof selection}>;
function present(p: Row) {
  const media=resolveMedia(p);
  return {id:p.id, slug:p.slug, name:p.name, material:p.material, craft:p.craft, category:p.category.name,
    image:media.approvedPrimaryImage || '', images:media.approvedPrimaryImage?[media.approvedPrimaryImage]:[],
    sellingPrice:buildPricing(p).effectivePrice, mrp:p.mrp,
    variants:p.variants.filter(v=>v.inventory>0).map(v=>({id:v.id, size:v.size,color:v.color,image:v.images[0]||null,inStock:true})),
  };
}
export type StudioPiece = ReturnType<typeof present>;
export async function findStudioPiece(mode:StudioMode,key:string) {
  const product=await prisma.product.findFirst({where:{AND:[available(mode),{OR:[{id:key},{slug:key}]}]},select:selection});
  return product ? present(product) : null;
}
export async function studioShelf(mode:StudioMode,page:number) {
  const size=12;
  const where=available(mode);
  const count=await prisma.product.count({where});
  const pages=Math.max(1,Math.ceil(count/size));
  const current=Math.min(Math.max(1,page),pages);
  const products=await prisma.product.findMany({where,select:selection,orderBy:[{catalogueFeatured:'desc'},{createdAt:'desc'},{id:'asc'}],skip:(current-1)*size,take:size});
  return {pieces:products.map(present),pages,current};
}
