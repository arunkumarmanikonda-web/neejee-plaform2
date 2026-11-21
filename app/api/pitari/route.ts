import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { buildPricing } from '@/lib/catalog/pricing-read';
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
  const p = parsePitari(body.message);
  if (p.service) return reply(serviceReplies[p.service]);
  const prior = typeof body.piece === 'string' && /^[\w-]{1,160}$/.test(body.piece) ? body.piece : undefined;
  const filters: Prisma.ProductWhereInput[] = [{status:'ACTIVE',takedownAt:null,catalogueExclude:false,catalogueStockVisibility:{in:['SHOW_ALL','HIDE_STOCK','IN_STOCK_ONLY']},sellingPrice:{gt:0},variants:{some:{inventory:{gt:0}}}}];
  const keywords = [...p.terms,...p.words].slice(0,5);
  if (!keywords.length && !p.detail && !p.browse && !p.gift && p.maxPaise === undefined) return reply({text:'Tell me the piece, material or gift budget you have in mind. I can also help with shipping or returns.', links:[shop]});
  for (const word of keywords) {
    const value = {contains:word, mode:'insensitive' as const};
    filters.push({OR:[{name:value},{shortName:value},{craft:value},{region:value},{material:value},{category:{name:value}}]});
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
