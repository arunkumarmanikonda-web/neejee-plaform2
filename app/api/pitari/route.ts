import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { buildPricing } from '@/lib/catalog/pricing-read';
import { notesPageType, notesSlug, notesTemplate, pieceFields, readPieceFacts, requestedPieceField } from '@/lib/catalog/piece-notes';
import { formatINR } from '@/lib/money';
import { parsePitari, serviceReplies, type PitariReply } from '@/lib/pitari';

export const dynamic = 'force-dynamic';
const shop = {label:'Browse the collection',href:'/products'};
const detailKeys = { origin:'region', material:'material', care:'careInstructions' } as const;
function reply(body: PitariReply, status = 200) {
  return NextResponse.json(body, {status,headers:{'Cache-Control':'no-store'}});
}
export async function POST(req: Request) {
  let body;
  if (Number(req.headers.get('content-length')) > 4096) return reply({text:'Please ask a shorter question.', links:[]},413);
  try { body = await req.json(); } catch { return reply({text:'Please enter a question.',links:[]},400); }
  if (typeof body?.message !== 'string' || !body.message.trim() || body.message.length > 320) return reply({text:'Ask a question of up to 320 characters.',links:[]},400);
  const question=body.message.trim().toLowerCase();
  if (/help me choose a (saree|sari)|saree guide/.test(question)) return reply({text:'Start with a fabric you already enjoy wearing. In the saree edit, open The blouse to see what to check before ordering.',links:[{label:'Choosing your saree',href:'/edits/sarees'},{label:'Visit the fitting room',href:'/ai/mirror'}]});
  const field = requestedPieceField(question);
  if (field && typeof body.piece==='string' && /^[\w-]{1,160}$/.test(body.piece)) {
    try {
      const piece = await prisma.product.findFirst({where:{slug:body.piece,status:'ACTIVE',takedownAt:null,catalogueExclude:false},select:{id:true,name:true,slug:true}});
      if (!piece) return reply({text:'That piece is unavailable. The team can help you find it.',links:serviceReplies.contact.links});
      const notes=await prisma.cmsPage.findFirst({where:{slug:notesSlug(piece.id),status:'PUBLISHED',pageType:notesPageType,template:notesTemplate},select:{sections:true}});
      const answer=readPieceFacts(notes?.sections)[field];
      const link={label:piece.name,href:'/products/'+piece.slug};
      return reply({text:answer ? pieceFields[field]+' · '+answer : 'I don’t have that detail confirmed for '+piece.name+'. The team can check it for you.',links:answer?[link]:[link,...serviceReplies.contact.links],piece:piece.slug});
    } catch {return reply({text:'I couldn’t check the piece notes just now. The team can help.',links:serviceReplies.contact.links},503);}
  }
  if (/what comes in a suit|included in (this |the |a )?(suit|set)|blouse piece|measurements/.test(question)) {
    const links=typeof body.piece==='string' && /^[\w-]{1,160}$/.test(body.piece)?[{label:'View the selected piece',href:'/products/'+body.piece}]:[];
    return reply({text:'A suit may include a kurta, bottoms and a dupatta. A saree may include separate blouse fabric. The contents and measurements depend on the piece. Our team can confirm exactly what comes with your selection.',links:[...links,{label:'Choosing your suit',href:'/edits/suits'},...serviceReplies.contact.links]});
  }
  if (/how does mirror|how to (try on|use mirror)|fitting room/.test(question)) return reply({text:'Open Mirror and choose an eligible garment and colour or size. Sign in, add your photo and create a styling preview. The garment measurements are the guide for fit.',links:[{label:'Open AI Mirror',href:'/ai/mirror'}]});
  const p = parsePitari(body.message);
  if (p.service) return reply(serviceReplies[p.service]);
  const prior = typeof body.piece === 'string' && /^[\w-]{1,160}$/.test(body.piece) ? body.piece : undefined;
  const filters: Prisma.ProductWhereInput[] = [{status:'ACTIVE',takedownAt:null,catalogueExclude:false,catalogueStockVisibility:{in:['SHOW_ALL','HIDE_STOCK','IN_STOCK_ONLY']},sellingPrice:{gt:0},variants:{some:{inventory:{gt:0}}}}];
  const keywords = [...p.terms,...p.words].slice(0,5);
  if (!keywords.length && !p.detail && !p.browse && !p.gift && p.maxPaise === undefined) return reply({text:'Tell me the piece, material or gift budget you have in mind. I can also help with shipping or returns.', links:[shop]});
  for (const word of keywords) {
    const variants = word==='sari' ? ['sari','saree'] : [word];
    filters.push({OR:variants.flatMap(term=>{
      const value={contains:term,mode:'insensitive' as const};
      return [{name:value},{shortName:value},{craft:value},{region:value},{material:value},{category:{name:value}}];
    })});
  }
  if (p.detail && prior && !keywords.length) filters.push({slug:prior});
  const now = new Date();
  if (p.maxPaise !== undefined) filters.push({OR:[
    {sellingPrice:{lte:p.maxPaise}},
    {salePrice:{gt:0,lte:p.maxPaise},AND:[
      {OR:[{saleStartsAt:null},{saleStartsAt:{lte:now}}]}, {OR:[{saleEndsAt:null},{saleEndsAt:{gte:now}}]},
    ]},
  ]});
  try {
    const rows = await prisma.product.findMany({where:{AND:filters},take:4,orderBy:[{cataloguePinHero:'desc'},{catalogueFeatured:'desc'},{id:'asc'}],select:{
      slug:true,name:true,region:true,material:true,careInstructions:true,craft:true,mrp:true,sellingPrice:true,salePrice:true,saleStartsAt:true,saleEndsAt:true,
    }});
    const matches = rows.filter(r=>p.maxPaise===undefined || buildPricing(r,now).effectivePrice<=p.maxPaise!);
    const first = matches[0];
    const link = (r:typeof rows[number])=>({label:r.name+' · '+formatINR(buildPricing(r,now).effectivePrice),href:'/products/'+encodeURIComponent(r.slug)});
    if (!first) return reply({text:'I couldn’t find an available piece matching that request. Try another material or budget, or see what is in the shop today.',links:[shop]});
    if (p.detail && (matches.length === 1 || prior && !keywords.length)) {
      const field = first[detailKeys[p.detail]];
      const fact = p.detail === 'origin' ? 'Listed origin' : p.detail === 'material' ? 'Listed material' : 'Care instructions';
      return reply({text:field ? first.name+'\n'+fact+': '+field : 'The catalogue does not list that detail for '+first.name+'. The team can check it for you.',links:field?[link(first)]:[link(first),...serviceReplies.contact.links],piece:first.slug});
    }
    if (p.detail) return reply({text:'Which piece did you have in mind? Ask with its name, or open its product page.',links:matches.map(link)});
    return reply({text:p.gift?'Here are the pieces I found for your gift search. Open a piece for its story and details.':'Here is what I found in the current collection.',links:matches.map(link),piece:matches.length===1?first.slug:undefined});
  } catch {
    return reply({text:'I couldn’t check the catalogue just now. You can still browse or reach the team.',links:[shop,...serviceReplies.contact.links]},503);
  }
}
