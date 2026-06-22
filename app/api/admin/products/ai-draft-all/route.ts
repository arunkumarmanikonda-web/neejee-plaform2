// /api/admin/products/ai-draft-all
// One-shot endpoint that fills ALL drafting-eligible text fields for a product
// in a single OpenAI call. Used by the "DRAFT WITH AI" master button on the
// new + edit product pages.
//
// Input:
//   {
//     name?: string,          // existing values \u2014 used as context, only overwritten if overwrite=true
//     shortName?: string,
//     poeticLine?: string,
//     description?: string,
//     story?: string,
//     craftNote?: string,
//     careInstructions?: string,
//     sustainabilityNote?: string,
//     material?: string,
//     technique?: string,
//     occasion?: string,
//     seoTitle?: string,
//     seoDesc?: string,
//     // Seed inputs (locked, never overwritten):
//     craft?: string,
//     region?: string,
//     artisanName?: string,
//     overwrite?: boolean,    // if true, redraft already-filled fields too
//     feedback?: string,      // free-text editor guidance ("make it more sensory" etc.)
//   }
//
// Output:
//   { ok, configured, draft: { name, shortName, poeticLine, description, story,
//                              craftNote, careInstructions, sustainabilityNote,
//                              material, technique, occasion, seoTitle, seoDesc },
//     filled: string[],       // fieldnames that were actually filled in this call
//     skipped: string[]       // fieldnames that already had a value and overwrite=false
//   }

import { NextResponse } from 'next/server';
import { getSession, requireRole } from '@/lib/auth';
import { openaiChat, aiTextConfigured } from '@/lib/ai';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// All fields the master draft can fill. Per locked spec, locked fields like
// price/HSN/badges/artisan/region/craft are NOT in this list \u2014 they're admin input.
// v26.1.2 — widened to include craft/region/state/cluster (auto-inferred from
// the working name + category). Artisan stays manual per founder direction.
const DRAFTABLE_FIELDS = [
  'name',
  'shortName',
  'poeticLine',
  'description',
  'story',
  'craftNote',
  'careInstructions',
  'sustainabilityNote',
  'craft',
  'region',
  'state',
  'cluster',
  'material',
  'technique',
  'occasion',
  'seoTitle',
  'seoDesc',
] as const;

type DraftableField = typeof DRAFTABLE_FIELDS[number];

export async function POST(request: Request) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!aiTextConfigured()) {
    return NextResponse.json({
      ok: true,
      configured: false,
      message: 'AI Content Assistant is being prepared. Add OPENAI_API_KEY to activate.',
    });
  }

  try {
    const body = await request.json();
    const overwrite = !!body.overwrite;
    const feedback = body.feedback ? String(body.feedback).slice(0, 500) : '';

    // Compute which fields need filling
    const targets: DraftableField[] = [];
    const skipped: string[] = [];
    for (const f of DRAFTABLE_FIELDS) {
      const existing = (body[f] || '').toString().trim();
      if (existing && !overwrite) {
        skipped.push(f);
      } else {
        targets.push(f);
      }
    }

    if (targets.length === 0) {
      return NextResponse.json({
        ok: true,
        configured: true,
        draft: {},
        filled: [],
        skipped,
        message: 'All draftable fields are already filled. Toggle "Overwrite filled fields" to redraft.',
      });
    }

    // Build a single JSON-mode prompt asking for all target fields at once
    const fieldDirectives: Record<string, string> = {
      name: '2-5 word product name. Evocative, rooted in craft & region. Often a heritage word, place, or sensory descriptor. NO generic e-commerce names. If a working name was given in the brief, refine it (fix spelling, add specificity) but DO NOT switch to a different craft or category.',
      shortName: '1-2 word short name from the full name. Used on product cards.',
      poeticLine: 'Single 6-10 word poetic tagline that lingers. Sensory. No sales words.',
      description: '30-50 word product description. Tactile, specific, factual. No hyperbole.',
      story: '90-130 word origin story. Where it was made, by whom, what tradition it lives in. Quiet, reverent.',
      craftNote: '60-90 word note on the craft technique. Specific terminology. Educational, not technical.',
      careInstructions: '4-6 short imperative care lines, separated by newlines, no leading dash. Practical, gentle.',
      sustainabilityNote: '40-70 word note on sustainability. Specific, never greenwashing.',
      craft: 'The craft name only — 1-3 words, Title Case (e.g. "Banarasi", "Kalamkari", "Phulkari", "Turkish Mosaic"). Infer from the working name / description / category. NO sentence, NO punctuation.',
      region: 'The city or place where this craft is traditionally made — 1-3 words, Title Case (e.g. "Varanasi", "Bhuj", "Srinagar", "Iznik"). Infer from craft.',
      state: 'The Indian state (or country for non-Indian crafts) the craft belongs to — 1-3 words, Title Case (e.g. "Uttar Pradesh", "Gujarat", "Kashmir", "Turkey"). Infer from craft / region.',
      cluster: 'The named artisan cluster or weaving cluster, if there is a well-known one (e.g. "Madanpura weavers", "Bhadohi cluster", "Kutch Rabari cluster"). 2-5 words. If none, return an empty string "".',
      material: '3-10 word factual material descriptor (e.g. "Pure Banarasi katan silk with antique zari").',
      technique: '3-10 word factual technique descriptor (e.g. "Hand-loom kadhwa weaving, brocade pallu").',
      occasion: '3-10 word occasion descriptor (e.g. "Wedding, festive evenings, mehendi").',
      seoTitle: '50-60 char SEO title. Human, never spammy. Include key craft + region words.',
      seoDesc: '150-160 char SEO meta description. Sensory, with one key benefit + craft reference.',
    };

    const targetSchema = targets.map(f => `  "${f}": "<${fieldDirectives[f]}>"`).join(',\n');

    const system = `You are NEEJEE's Content Assistant.
NEEJEE is a personal Indian craft brand. Voice: quiet, reverent, sincere, never sales-y.
Brand pillar: "Found. Personal." We honour the artisan and the craft.
Avoid: "luxurious", "exquisite", "premium", "elegant" \u2014 these are marketplace words.
Prefer: specific sensory detail, named techniques, named places, named people.
Use Indian English. No exclamation marks. No emoji.

You will fill MULTIPLE product fields in a single response. The output MUST be JSON exactly matching this shape:
{
${targetSchema}
}

Rules:
\u2022 Output ONLY the JSON object, no markdown, no surrounding text.
\u2022 Every field listed above MUST be present in your output.
\u2022 Be internally consistent \u2014 the description, story, craftNote, and care instructions must all describe the SAME piece.
\u2022 Use the seed facts (craft, region, artisan) as the ANCHOR truth. Do not invent contradicting facts.
\u2022 If a fact is missing, write generically (e.g. "the weaver" instead of inventing a name).`;

    const userMsg = `Product context:
- Working / existing name: ${body.name || '(none yet — propose one)'}
- Existing description: ${body.description || '(none)'}
- Craft: ${body.craft || '(infer)'}
- Region: ${body.region || '(infer)'}
- State: ${body.state || '(infer)'}
- Cluster: ${body.cluster || '(infer if a famous one exists)'}
- Artisan: ${body.artisanName || 'unspecified'}   (NEVER invent an artisan name. Leave empty if unspecified.)
- Material (seed): ${body.material || '(propose one if missing)'}
- Technique (seed): ${body.technique || '(propose one if missing)'}
- Occasion (seed): ${body.occasion || '(propose one if missing)'}
- Category: ${body.categoryName || 'unspecified'}
${feedback ? `\nEditor guidance for THIS draft (apply throughout):\n"${feedback}"\n` : ''}
IMPORTANT — if a working name is provided (e.g. "Banarsi silk saree"), the ENTIRE
draft must describe that same piece. Do not switch the craft / category. You
MAY improve spelling (Banarsi → Banarasi) and add specificity (zari / katan).

Fill ALL the fields listed in the schema.`;

    const ai = await openaiChat({
      system,
      messages: [{ role: 'user', content: userMsg }],
      temperature: 0.7,
      jsonMode: true,
    });

    if (!ai.json || typeof ai.json !== 'object') {
      return NextResponse.json({
        error: 'AI returned no JSON',
        rawText: ai.text?.slice(0, 500),
      }, { status: 500 });
    }

    const draft: Record<string, string> = {};
    const filled: string[] = [];
    for (const f of targets) {
      const value = (ai.json as any)[f];
      if (typeof value === 'string' && value.trim()) {
        draft[f] = value.trim();
        filled.push(f);
      }
    }

    return NextResponse.json({
      ok: true,
      configured: true,
      draft,
      filled,
      skipped,
    });
  } catch (e: any) {
    console.error('[ai-draft-all] error:', e);
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
