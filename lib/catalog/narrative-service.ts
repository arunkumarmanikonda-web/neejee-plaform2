import { aiTextConfigured, openaiChat } from '@/lib/ai';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { notesPageType, notesSlug, notesTemplate, readPieceFacts, type PieceFacts } from './piece-notes';
import { productNarrativePrompt, readNarrativeEvidence, resolveProductNarrative, type ProductNarrative } from './product-narrative';
import { narrativeTitleIsFinal } from './narrative-fields';

type Input = Record<string, unknown>;
type Options = { useAI?:boolean; rewrite?:boolean; feedback?:string };
const value = (text:unknown) => typeof text === 'string' ? text.trim() : '';

export async function draftMerchandise(input:Input, options:Options = {}) {
  const evidence = readNarrativeEvidence(input);
  let proposed:unknown;
  let source:'facts'|'ai'='facts';
  if (options.useAI!==false && aiTextConfigured()) {
    const prompt = productNarrativePrompt(evidence);
    const guidance = value(options.feedback).slice(0,500);
    try {
      const result = await openaiChat({
        system:prompt.system,
        messages:[{role:'user',content:prompt.user + (guidance ? '\nEditorial preference (style only): ' + guidance : '')}],
        temperature:.25, jsonMode:true, timeoutMs:6500,
      });
      if (result.ok && result.json) { proposed=result.json; source='ai'; }
    } catch { /* The recorded facts also produce a complete draft when the provider is unavailable. */ }
  }
  const draft = resolveProductNarrative(evidence,proposed);
  if (input.keepTitle===true || (!options.rewrite && narrativeTitleIsFinal(input.name))) draft.name=value(input.name) || draft.name;
  if (!options.rewrite) {
    for(const field of ['shortName','poeticLine','description'] as const) {
      if(value(input[field])) draft[field]=value(input[field]);
    }
  }
  if (draft.shortName.toLowerCase()===draft.name.toLowerCase()) draft.shortName='';
  return {draft,source};
}

export async function authorNewProduct(input:Input, options:Options = {}) {
  const category = typeof input.categoryId==='string' ? await prisma.category.findUnique({
    where:{id:input.categoryId},select:{name:true,path:true},
  }) : null;
  const brief={...input,categoryName:category?.name || input.categoryName,categoryPath:category?.path || input.categoryPath};
  const result=await draftMerchandise(brief,options);
  const generated=editorialExtras(brief,result.draft);
  return {...result,draft:{...result.draft,...Object.fromEntries(Object.entries(generated).map(([key,text])=>[key,value(input[key]) || text]))}};
}

export function editorialExtras(input:Input,draft:ProductNarrative) {
  const facts=readNarrativeEvidence(input);
  return {
    seoTitle:draft.name.slice(0,100), seoDesc:(draft.poeticLine || draft.description).slice(0,160),
    craftNote:facts.designReference ? 'Design reference: '+facts.designReference : '',
    story:[facts.artisanName ? 'Made by '+facts.artisanName+'.' : '', facts.region || facts.state ? 'Place of making: '+[...new Set([facts.region,facts.state].filter(Boolean))].join(', ')+'.' : ''].filter(Boolean).join(' '),
  };
}

/** Persist source details atomically with the new product using the existing piece-notes store. */
export async function saveCreationFacts(tx:Prisma.TransactionClient, productId:string, input:unknown) {
  const facts=readPieceFacts(input);
  if (!Object.keys(facts).length) return;
  await tx.cmsPage.create({data:{slug:notesSlug(productId),title:'Piece notes · '+productId,pageType:notesPageType,
    template:notesTemplate,sections:facts,status:'PUBLISHED',publishedAt:new Date()}});
}

export async function savedProductFacts(productId:unknown):Promise<PieceFacts> {
  if (typeof productId!=='string' || !productId || productId.length>150) return {};
  const note=await prisma.cmsPage.findFirst({where:{slug:notesSlug(productId),pageType:notesPageType,template:notesTemplate},select:{sections:true}});
  return readPieceFacts(note?.sections);
}
