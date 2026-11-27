import { reviewMatches, reviewSizes, studyCartProduct } from './collection-review';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { buildPricing } from '@/lib/catalog/pricing-read';
import { studies } from '@/lib/shop-studies';
import { pairingSlots,slotFor,slotsFor,wordsFor,type PairPiece,type PairSlot,type PairBoard } from '@/lib/pairing';

const publicStock:Prisma.ProductWhereInput={
  status:'ACTIVE',takedownAt:null,catalogueExclude:false,catalogueImageApproved:true,
  sellingPrice:{gt:0},category:{active:true,hidden:false},variants:{some:{inventory:{gt:0}}},
  catalogueStockVisibility:{in:['IN_STOCK_ONLY','LOW_STOCK_BADGE','HIDE_STOCK','SHOW_ALL','SHOW_EXACT']},
  AND:[{OR:[{catalogueCtaMode:null},{catalogueCtaMode:'SHOP_NOW'}]}],
};
const fields={id:true,slug:true,name:true,category:{select:{slug:true,path:true}},material:true,craft:true,region:true,
  images:true,cataloguePreferredImage:true,mrp:true,sellingPrice:true,salePrice:true,saleStartsAt:true,saleEndsAt:true,
  _count:{select:{variants:true}},variants:{where:{inventory:{gt:0}},orderBy:{id:'asc'},select:{id:true,images:true,color:true,size:true,material:true,sellingPrice:true}},
} satisfies Prisma.ProductSelect;
type Row=Prisma.ProductGetPayload<{select:typeof fields}>;
type Variant=Row['variants'][number];
function piece(p:Row,v:Variant):PairPiece {
  return {id:p.id,slug:p.slug,variant:v.id,name:p.name,image:v.images.find(Boolean)||((p._count.variants===1 || p.variants.every(other=>v.color===other.color))?(p.cataloguePreferredImage||p.images.find(Boolean)):'')||'',
    price:v.sellingPrice??buildPricing(p).effectivePrice,option:[v.color,v.size,v.material].filter(Boolean).join(' · ')};
}
const toneFamilies=[['red','vermilio','wine','maroon','madder'],['blue','indigo','navy'],['green','sage','pistach','olive'],['yellow','turmeric','gold','brass','mustard'],['ivory','cream','pearl','white'],['brown','tan','wood','copper']];
function rank(base:{colour:string;craft:string|null;material:string|null;region:string|null},p:Row,v:Variant){
  const same=(a:string|null,b:string|null)=>!!a && !!b && a.trim().toLowerCase()===b.trim().toLowerCase();
  const colour=wordsFor(v.color||''), baseTone=toneFamilies.findIndex(group=>group.some(word=>wordsFor(base.colour).includes(word)));
  const tone=toneFamilies.findIndex(group=>group.some(word=>colour.includes(word)));
  const matches=[{ok:tone>=0 && tone===baseTone,weight:5,note:'Echoes the colour of your piece.'},
    {ok:same(base.craft,p.craft),weight:4,note:'Shares the '+(p.craft||'')+' craft.'},
    {ok:baseTone>=0 && [[3,4],[4,5],[3,4],[0,4],[1,5],[1,4]][baseTone].includes(tone),weight:3,note:'Adds a complementary colour.'},
    {ok:same(base.material,v.material||p.material),weight:2,note:'Picks up the material of your piece.'},
    {ok:same(base.region,p.region),weight:1,note:'From the same region.'}].filter(m=>m.ok);
  return {score:matches.reduce((n,m)=>n+m.weight,0),reason:matches[0]?.note};
}
export async function getPairBoard(key:{product?:string;variant?:string;study?:string}, review=false):Promise<PairBoard|null>{
  const study=key.study?studies.find(s=>s.id===key.study):undefined;
  if(key.study&&!study || !key.study&&!key.product) return null;
  const row=study?null:await prisma.product.findFirst({where:{AND:[publicStock,{OR:[{id:key.product},{slug:key.product}]}]},select:fields});
  const variant=key.variant?row?.variants.find(v=>v.id===key.variant):row?.variants[0];
  if(!study && (!row||!variant))return null;
  const size=study?.group==='suits' ? reviewSizes.find(size=>studyCartProduct(study,size).variantId===key.variant) : undefined;
  const option=study && review ? studyCartProduct(study,size) : undefined;
  const anchor=study?{id:study.id,slug:study.id,name:study.name,image:study.image,variant:option?.variantId||'',price:option?.sellingPrice||0,option:option?.variantLabel||study.shade}:piece(row!,variant!);
  if(!anchor.image && row) anchor.image=row.cataloguePreferredImage||row.images.find(Boolean)||'';
  const description=study?study.group:wordsFor([row?.category.path,row?.category.slug,row?.name].join(' '));
  const mode=/(home|room|furniture|decor|lamp|table|rug|carpet|frame|vase|wall|artefact|artifact|lighting)/i.test(description)?'room':'fashion';
  const slots=slotsFor(mode,study?study.group:row!.name+' '+row!.category.slug);
  const base={colour:study?.shade||variant?.color||'',craft:row?.craft||null,material:variant?.material||row?.material||null,region:row?.region||null};
  const options:PairBoard['options']={};
  await Promise.all(slots.map(async slot=>{
    const text=pairingSlots[slot].words;
    const terms:Prisma.ProductWhereInput[]=text.flatMap(term=>[
      {name:{contains:term,mode:'insensitive' as const}},{category:{slug:{contains:term,mode:'insensitive' as const}}},
      {category:{path:{contains:term.replaceAll(' ','-'),mode:'insensitive' as const}}}]);
    const found=await prisma.product.findMany({where:{AND:[publicStock,{id:{not:anchor.id},OR:terms}]},select:fields,orderBy:[{catalogueFeatured:'desc'},{createdAt:'desc'},{id:'asc'}],take:36});
    options[slot]=found.filter(p=>(slotFor(p.name)||slotFor(p.category.slug)||slotFor(p.category.path||''))===slot)
      .flatMap(p=>p.variants.map(v=>({...piece(p,v),...rank(base,p,v)}))).filter(p=>p.image&&p.price>0)
      .sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name)||a.option.localeCompare(b.option)).slice(0,64);
  }));
  if (study && review) {
    for (const slot of slots) options[slot]=[...(options[slot]||[]),...reviewMatches(study,slot)];
  }
  return {anchor,mode,slots,options,study:!!study};
}
