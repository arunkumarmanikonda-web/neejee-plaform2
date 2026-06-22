// AI Content Assistant — admin tool to draft product story, care notes, SEO copy
// from artisan-supplied metadata.
import { NextResponse } from 'next/server';
import { getSession, requireRole } from '@/lib/auth';
import { aiTextConfigured, openaiChat } from '@/lib/ai';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

interface BriefInput {
  // Product fields
  name?: string;
  craft?: string;
  region?: string;
  artisanName?: string;
  material?: string;
  technique?: string;
  occasion?: string;
  // Marketing / generic
  campaign?: string;
  segment?: string;
  notes?: string;
  // v23.31 — marketing/commerce surfaces context
  code?: string;
  discount?: string;
  category?: string;
  releaseDate?: string;
  audience?: string;
  // v23.28 — product extensions
  shortName?: string;
  productName?: string;
  nameSuggestions?: any;
  fieldHint?: string;
  feedback?: string;
  returnEligible?: boolean;
  // v23.31 — widened field union for new directives
  field: string;
  // Banner / generic creative context
  intent?: string;    // 'seasonal_sale' | 'new_arrival' | 'product_spotlight' | 'founder_note' | 'restock' | 'free_text'
  freeText?: string;  // user's own brief when intent is free_text
  position?: string;  // banner position: hero / announcement / footer
  productContext?: { name?: string; craft?: string; region?: string; sellingPrice?: number; story?: string };
  // Generic brief object pass-through (used by some callers)
  brief?: any;
  // Open-ended additional context for any future field
  [key: string]: any;
}

const FIELD_DIRECTIVES: Record<string, string> = {
  productName: 'A 2-5 word product name. Evocative, rooted in the craft & region. Often a heritage word, a place, or a sensory descriptor (e.g. "Nizami Begum", "Falaknuma Stack", "Banarasi Aabi"). Return ONLY the name, no quotes, no description.',
  craftLabel: 'A clean 1-3 word craft NAME suitable as a facet/filter label (e.g. "Banarasi", "Kalamkari", "Phulkari", "Block Print", "Turkish Mosaic"). Title Case. Return ONLY the label — NO sentences, NO punctuation other than spaces, NO description.',
  shortName: 'A 1-2 word short name used on product cards and small surfaces. Often a single evocative word from the full product name. Return ONLY the short name.',
  poeticLine: 'A single 6-10 word poetic tagline that lingers. Sensory. No sales words.',
  description: 'A 30-50 word product description. Tactile, specific, factual. No hyperbole.',
  story: 'A 90-130 word origin story. Where it was made, by whom, what tradition it lives in. Quiet, reverent.',
  craftNote: 'A 60-90 word note on the craft technique. Specific terminology. Educational, not technical.',
  careInstructions: '4-6 short imperative care lines. Practical, gentle. Format as bullet-style lines, one per line, no leading dash.',
  sustainabilityNote: 'A 40-70 word note on sustainability — hand-loom, natural dyes, slow production, fair wages, low water use, or whichever applies. Specific, never greenwashing.',
  material: 'A 3-10 word factual material descriptor (e.g. "Pure Banarasi katan silk with antique zari"). Return ONLY the material text.',
  technique: 'A 3-10 word factual technique descriptor (e.g. "Hand-loom kadhwa weaving, brocade pallu"). Return ONLY the technique text.',
  occasion: 'A 3-10 word occasion descriptor (e.g. "Wedding, festive evenings, mehendi"). Return ONLY the occasion text.',
  nameSuggestions: 'Return JSON: { "names": [{ "name": "<2-5 word product name>", "rationale": "<one-line reasoning, 10-20 words>", "seoScore": <0-100>, "angle": "<one of: HERITAGE | ROYAL | SENSORY | CRAFT_TECH | POETIC | SEO_SEARCH | TREND>" }, ...] } with EXACTLY 7 distinct, world-class product name proposals optimised across THREE dimensions:\n  (a) SEO-friendliness — includes a high-intent keyword a buyer might type (e.g. "Banarasi katan saree", "hand-painted Kashmiri papier-mâché bowl"). seoScore should reflect this.\n  (b) Consumer attractiveness — evocative, sensory, easy to say and remember. Avoids generic words ("set", "piece", "item", "product").\n  (c) Current trends — align with what discerning Indian craft-buyers search for in 2025-26 (heritage-modern, slow-luxury, regional pride).\nMix exactly these 7 angles (one per item, in this order): HERITAGE (place-name rooted), ROYAL (historical/royal reference), SENSORY (touch/light/colour descriptor), CRAFT_TECH (craft-technique foregrounded), POETIC (quiet poetic word/phrase), SEO_SEARCH (most searchable, high-intent keyword phrasing), TREND (taps current craft-revival trend e.g. heirloom, slow-made, founder-curated).\nFormatting rules: Title Case. 2-5 words. No quotes, no emoji, no punctuation except optional middle-dot. No generic e-commerce names. Every name must feel like NEEJEE could put it on a price tag.',
  seo: 'Return JSON: { "seoTitle": "<50-60 char title>", "seoDesc": "<150-160 char meta description>" }. SEO-optimised but human, never spammy.',
  returnPolicy: 'A 40-80 word return-policy note for this piece. If the brief indicates returnEligible=true, mention a 7-day window from delivery, unworn/unwashed/un-used condition with original tags, and end with a sentence about us being personally reachable. If returnEligible is false or missing, return ONLY the sentence: "This piece is hand-finished and final-sale. We do not accept returns or refunds on this item. For any concerns please write to us within 48 hours of delivery and we will respond personally." Do not invent a return window for non-returnable pieces.',
  emailSubject: 'A single email subject line, 30-55 characters. Quiet, intriguing, sensory. No exclamation marks, no all-caps, no salesy words like SALE/HURRY/LIMITED. Return only the subject line, no quotes.',
  emailBody: 'A short HTML email body (3-5 short paragraphs, ~120-180 words total). Open with "Dear {{firstName}},". Use <p> tags. Include one soft call-to-action link (placeholder href). Voice: a personal letter from Nidhi, not a brand broadcast. No emoji.',
  cartRecovery: 'A 60-90 word HTML email body to gently remind a customer about items left in their cart. Open with "Dear {{firstName}},". Reverent, not pushy. Use <p> tags. One soft CTA. No urgency tactics, no discount mention unless explicitly told to.',
  cmsHero: 'Return JSON: { "eyebrow": "<3-4 word kicker, e.g. NEW DROP>", "title": "<5-9 word headline, evocative not sales-y>", "subtitle": "<12-20 word supporting line>", "ctaText": "<2-3 word button label in CAPS>" }. Voice: quiet, sensory.',
  cmsText: 'Return JSON: { "title": "<short evocative heading 4-7 words>", "body": "<2-3 short paragraphs, 80-140 words total, separated by blank lines>" }. Tactile, specific, no marketing voice.',
  cmsQuote: 'A single pull-quote, 8-18 words, that sits well in a craft-brand landing page. Return only the quote text, no quotes, no attribution.',
  cmsFounderNote: 'A 60-90 word personal note from Nidhi (founder). Warm, specific, in first person. Mention an actual moment (a phone call with an artisan, packing a piece, choosing a thread). End naturally; no signature line.',
  cmsJournal: 'Return JSON: { "title": "<5-9 word title>", "excerpt": "<1-2 sentence opening that invites the reader in, 30-50 words>", "body": "<3-5 paragraphs of full editorial copy, 250-400 words. Tactile, specific, named places and techniques. Quiet, slow.>" }. Use plain text with blank lines between paragraphs.',
  cmsTestimonial: 'Return JSON: { "text": "<a believable customer quote about a NEEJEE piece, 18-35 words, first person, specific moment>", "author": "<first name + last initial>", "location": "<Indian city>" }. Quiet, real, no superlatives.',
  cmsFaq: 'Return JSON: { "items": [{ "question": "...", "answer": "..." }, ...] } with 4-6 FAQ items relevant to a personal Indian craft brand (shipping, returns, care, authenticity, customisation, gift options). Answers: 1-3 sentences, warm and specific.',
  cmsFeatures: 'Return JSON: { "title": "<4-7 word section heading, e.g. \"Why NEEJEE\">", "items": [{ "icon": "<single unicode symbol>", "title": "<2-4 word title>", "body": "<15-25 word supporting line>" }, ...] } with exactly 3 items. Speak to craft, fair trade, founder verification, slow production, authenticity.',
  cmsCta: 'Return JSON: { "eyebrow": "<1-2 word kicker>", "title": "<5-8 word invitation>", "body": "<10-15 word supporting line>", "ctaText": "<2-3 word button label in CAPS>" }. Voice: warm invitation, not a hard sell.',
  cmsPageScaffold: `Return JSON: { "title": "<page title>", "slug": "<url-slug>", "sections": [ { "type": "hero" | "text" | "quote" | "founderNote" | "journalEntry" | "productCarousel" | "featureGrid" | "testimonial" | "accordion" | "splitSection" | "image" | "imageGrid" | "lookbook" | "cta" | "divider" | "videoHero" | "marquee", "data": {<typed fields for that section>} }, ... ] }. Based on the user's brief, scaffold a complete page with 4-7 sections that flow naturally. Fill in plausible NEEJEE-brand content for every field. Section data fields must match: hero={eyebrow,title,subtitle,ctaText,ctaUrl,dark:true}, text={title,body,align:'left'}, quote={text,attribution}, founderNote={name:'Nidhi',title:'Founder, NEEJEE',body}, journalEntry={title,author:'Nidhi',date:'2026-01-01',excerpt,body}, productCarousel={title,source:'founder'|'new'|'sale',limit:6}, featureGrid={title,columns:3,items:[{icon,title,body}]}, testimonial={text,author,location,rating:5}, accordion={title,items:[{question,answer}]}, splitSection={title,body,ctaText,ctaUrl,imagePosition:'left'|'right'}, cta={eyebrow,title,body,ctaText,ctaUrl}, divider={style:'madder'}, marquee={text,speed:30}.`,
  banner: `Return JSON: { "title": "<3-7 word headline, evocative not sales-y>", "subtitle": "<8-16 word supporting line, sensory>", "ctaText": "<2-3 word CTA in CAPS>", "ctaUrl": "<suggested relative URL like /products or /drops/slug>", "imagePrompt": "<a vivid 30-50 word prompt for an AI image generator describing the visual: scene, mood, lighting, props, colour palette in NEEJEE brand (ivory, mitti, banarasi gold, madder, kohl). NO text in the image.>" }. Match the position context (announcement = single line tagline, hero = full splash with strong CTA, footer = quiet send-off). Voice: quiet, sensory, never "BUY NOW".`,
  badge: `Return JSON: { "label": "<2-4 word badge label, e.g. \"HANDLOOM CERTIFIED\">", "description": "<12-25 word tooltip explaining what this trust signal means>", "group": "<'editorial' | 'craft' | 'trust'>" }. Quiet, factual, never marketing fluff.`,
  imagePrompt: `Return a SINGLE LINE prompt (40-80 words) for an AI image generator. Describe a NEEJEE-brand visual scene: setting, lighting, mood, props, composition, colour palette (ivory, mitti, banarasi gold, madder, kohl earthtones). NO embedded text. NO faces unless requested. Editorial, slow, quiet. Return ONLY the prompt text, no surrounding quotes or labels.`,

  // ─── v23.31 additions: marketing / commerce surfaces ─────────────────────
  couponName: 'A short coupon name (2-4 words) shown internally in the admin panel. Evocative but functional. Examples: "Diwali Festive", "First-Time Gift", "Founder Friends". Return ONLY the name.',
  couponDescription: 'A 12-25 word description of what this coupon is for, shown internally and to staff. Plain language. No marketing fluff. Return ONLY the description text.',
  couponBanner: 'Return JSON: { "headline": "<4-7 word banner headline, evocative not pushy>", "subtitle": "<10-18 word supporting line>", "ctaText": "<2-3 word CTA in CAPS>" }. This banner promotes a discount coupon on the site. Voice: quiet invitation, never "HURRY" or "LIMITED TIME". Use brief.discount and brief.code if given.',

  campaignName: 'A 2-4 word internal campaign name, descriptive and operational. Examples: "Monsoon Saree Edit", "Diwali Founder Picks". Return ONLY the name.',
  campaignBlurb: 'A 25-45 word internal description of the campaign — its angle, audience, and the moment it celebrates. Used by staff and finance for accounting. Plain language. No emoji.',

  dropAnnouncement: 'Return JSON: { "title": "<5-8 word title for the drop>", "subtitle": "<12-20 word evocative supporting line>", "body": "<60-100 word announcement paragraph. Mention the craft, the artisan or cluster, and what makes this drop personal. Quiet, reverent. End with a soft invitation.>" }. This announces a new limited drop to the community.',
  dropReleaseDate: 'Return a single short sentence (8-14 words) announcing when a drop becomes available. Quiet, factual. Example: "This collection opens on the 24th of October, at sunset." Return only the sentence.',

  loyaltyPerkName: 'A 2-5 word name for a loyalty perk or tier benefit. Sensory, never gamified. Examples: "Founder Access", "First Look Saturday", "Atelier Whisper". Return ONLY the name.',
  loyaltyPerkDescription: 'A 20-40 word description of what this loyalty perk unlocks. Warm, specific, never "exclusive" or "VIP". Return ONLY the description text.',
  loyaltyTierName: 'A 1-2 word tier name in the NEEJEE voice. Avoid Bronze/Silver/Gold. Prefer heritage names: "Khadi", "Mitti", "Madder", "Banarasi". Return ONLY the name.',

  categoryIntro: 'A 60-100 word introduction shown at the top of a category landing page (e.g. /categories/sarees). Tactile, anchored in named places and techniques. Open with sensory detail, never "Welcome to our X collection". Return ONLY the intro text, plain paragraphs separated by blank lines.',
  categoryShortDescription: 'A 10-20 word descriptor used in category cards and navigation tooltips. Plain, factual, evocative. Return ONLY the descriptor.',

  // Generic free-text helper for any plain field where the editor wants a quick AI assist.
  freeText: 'Generate copy in NEEJEE voice based on the brief fields provided. If the brief includes "fieldHint" describing the target field, follow it. Keep it concise (under 80 words by default). Return ONLY the requested text, no preamble.',
};

export async function POST(request: Request) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const incoming = await request.json();
    // Accept both flat shape and { field, brief } shape
    const brief: BriefInput = incoming.field && incoming.brief
      ? { field: incoming.field, ...incoming.brief }
      : incoming;
    if (!brief.field || !FIELD_DIRECTIVES[brief.field]) {
      return NextResponse.json({ error: 'Invalid field' }, { status: 400 });
    }
    // For product-centric fields, require a name; otherwise relax
    const productFields = ['poeticLine', 'description', 'story', 'craftNote', 'careInstructions', 'seo', 'returnPolicy'];
    if (productFields.includes(brief.field) && !brief.name) {
      brief.name = 'this piece';
    }
    // For banner / badge / imagePrompt: build a brief from intent + freeText + product context
    if (['banner', 'badge', 'imagePrompt'].includes(brief.field)) {
      const intentLabel = brief.intent === 'seasonal_sale' ? 'a seasonal sale'
        : brief.intent === 'new_arrival' ? 'new arrivals'
        : brief.intent === 'product_spotlight' ? 'spotlighting a single product'
        : brief.intent === 'restock' ? 'a restock announcement'
        : brief.intent === 'founder_note' ? 'a founder-voice note from Nidhi'
        : 'a generic brand moment';
      const positionLabel = brief.position === 'announcement' ? '(for the slim announcement bar — single short line, no big CTA)'
        : brief.position === 'footer' ? '(for the footer area — quiet send-off)'
        : '(for the homepage hero — full splash)';
      let productLine = '';
      if (brief.productContext?.name) {
        productLine = `Product context: "${brief.productContext.name}"`;
        if (brief.productContext.craft) productLine += `, craft: ${brief.productContext.craft}`;
        if (brief.productContext.region) productLine += `, region: ${brief.productContext.region}`;
        if (brief.productContext.story) productLine += `. Story snippet: "${brief.productContext.story.slice(0, 180)}…"`;
      }
      const freeBit = brief.freeText ? `\nAdditional brief from the editor: "${brief.freeText}"` : '';
      // Repurpose the `notes` channel for the prompt assembly
      brief.notes = `Intent: ${intentLabel} ${positionLabel}. ${productLine}${freeBit}`;
      brief.name = brief.name || brief.productContext?.name || 'NEEJEE';
    }

    if (!aiTextConfigured()) {
      return NextResponse.json({
        ok: true,
        configured: false,
        text: '',
        message: 'AI Content Assistant is being prepared. Add OPENAI_API_KEY to activate.',
      });
    }

    // v23.40.25 — SEO + SEM brief baked into every content directive so all
    // AI-generated copy (product names, hero blocks, FAQ, shipping, returns,
    // banner CTAs, etc.) is at par with current trending SEO standards.
    const SEO_BRIEF = `SEO + SEM rules (apply to every output):
• Lead with the most-searched keyword first when the field is title-like
  (product name, hero title, SEO title, FAQ question). For Indian craft buyers in 2025-26,
  high-intent keywords include: heritage · hand-loom · hand-painted · GI tag · artisan ·
  craft name (Banarasi, Kalamkari, Phulkari, Patola, Pochampally, Chanderi, Kanjeevaram,
  Pashmina, Bidri, Pattachitra, Meenakari, Kundan, Polki, Channapatna, Madhubani,
  Block Print, Ajrakh, Bandhani, Chikankari, Pattu, Khadi, Khurja, Moradabad brass) ·
  occasion (wedding, festive, gifting, mehendi, sangeet, diwali, eid, raksha bandhan) ·
  region/place name · 'slow-made', 'heirloom', 'founder-curated', 'fair-trade'.
• Use long-tail phrasing where it reads natural (e.g. 'hand-painted Kashmiri papier-mâché bowl'
  beats 'painted bowl'). Title Case nouns. No keyword stuffing — if a word doesn't belong, drop it.
• Be concrete: name the technique, the region, the material. Vague copy loses to specific copy in SERP.
• Avoid generic e-commerce words ('item', 'product', 'piece', 'set') unless the product is literally a set.
• Voice still rules over keyword — if a keyword breaks NEEJEE's quiet voice, rewrite.
• Internal linking opportunity: where the directive returns a CTA or link, prefer
  /collections/<slug> or /categories/<slug> over generic /products.
`;

    const system = `You are NEEJEE's Content Assistant.
NEEJEE is a personal Indian craft brand. Voice: quiet, reverent, sincere, never sales-y.
Brand pillar: "Found. Personal." We honour the artisan and the craft.
Avoid: "luxurious", "exquisite", "premium", "elegant" — these are marketplace words.
Prefer: specific sensory detail, named techniques, named places, named people.
Use Indian English. No exclamation marks. No emoji.

${SEO_BRIEF}

${FIELD_DIRECTIVES[brief.field]}`;

    // v23.31 — marketing/commerce fields use a brief tailored for their context
    const MARKETING_FIELDS = new Set([
      'couponName', 'couponDescription', 'couponBanner',
      'campaignName', 'campaignBlurb',
      'dropAnnouncement', 'dropReleaseDate',
      'loyaltyPerkName', 'loyaltyPerkDescription', 'loyaltyTierName',
      'categoryIntro', 'categoryShortDescription',
    ]);

    const userMsg = brief.field === 'emailSubject' || brief.field === 'emailBody' || brief.field === 'cartRecovery'
      ? `Brief:
- Campaign / context: ${brief.campaign || 'general NEEJEE update'}
- Audience: ${brief.segment || 'opted-in subscribers'}
- Internal notes: ${brief.notes || 'none'}

Write only the requested copy. No preamble, no explanation, no quotes around the output.`
      : MARKETING_FIELDS.has(brief.field)
      ? `Brief:
- Surface: ${brief.field}
- Context name: ${brief.name || brief.campaign || 'unspecified'}
${brief.code ? `- Discount code: ${brief.code}\n` : ''}${brief.discount ? `- Discount: ${brief.discount}\n` : ''}${brief.category ? `- Category: ${brief.category}\n` : ''}${brief.craft ? `- Craft: ${brief.craft}\n` : ''}${brief.region ? `- Region: ${brief.region}\n` : ''}${brief.releaseDate ? `- Release date: ${brief.releaseDate}\n` : ''}${brief.audience ? `- Audience: ${brief.audience}\n` : ''}- Editor notes: ${brief.notes || 'none'}
${(brief as any).feedback ? `\nEditor feedback on previous draft (apply this guidance):\n"${String((brief as any).feedback).slice(0, 500)}"\n` : ''}
Write only the requested copy. No preamble, no explanation, no quotes around the output.`
      : brief.field?.startsWith('cms')
      ? `Brief:
- Page / context: ${brief.campaign || brief.name || 'a NEEJEE landing page'}
- Additional notes from editor: ${brief.notes || 'none'}

Write only the requested copy. No preamble, no explanation, no quotes around the output.`
      : brief.field === 'nameSuggestions'
      ? `Brief for name generation:
${(brief as any).workingName ? `- Working name from the admin (USE THIS AS THE ANCHOR — every suggestion MUST refer to the same piece): "${(brief as any).workingName}"` : `- Working name: (not yet decided)`}
${(brief as any).description ? `- Description: "${String((brief as any).description).slice(0, 280)}"` : ''}
- Craft: ${brief.craft || 'unspecified'}
- Region: ${brief.region || 'unspecified'}
- Material: ${brief.material || 'unspecified'}
- Technique: ${brief.technique || 'unspecified'}
- Occasion: ${brief.occasion || 'unspecified'}
- Category: ${brief.categoryName || 'unspecified'}

IMPORTANT — if a working name is provided, every one of the 7 suggestions MUST describe the SAME piece (e.g. if the working name is "Banarsi silk saree", every suggestion must be a Banarasi silk saree, NOT a Kanchipuram saree, NOT a Madhubani painting, NOT a Khadi shawl). You may improve spelling (Banarsi → Banarasi), specificity (add zari/katan), and angle (heritage / royal / sensory …) but never switch the underlying craft or category.

Write only the requested JSON, no preamble.`
      : `Brief:
- Piece: ${brief.name || '(name not yet decided — propose one based on craft + region + material)'}
- Craft: ${brief.craft || 'unspecified'}
- Region: ${brief.region || 'unspecified'}
- Artisan: ${brief.artisanName || 'unspecified'}
- Material: ${brief.material || 'unspecified'}
- Technique: ${brief.technique || 'unspecified'}
- Occasion: ${brief.occasion || 'unspecified'}
${typeof (brief as any).returnEligible === 'boolean' ? `- returnEligible: ${(brief as any).returnEligible}` : ''}
${(brief as any).feedback ? `\nEditor feedback on previous draft (apply this guidance):\n"${String((brief as any).feedback).slice(0, 500)}"\n` : ''}
Write only the requested copy. No preamble, no explanation, no quotes around the output.`;

    // Fields that should return structured JSON
    const JSON_FIELDS = new Set([
      'seo', 'cmsHero', 'cmsText', 'cmsJournal', 'cmsTestimonial',
      'cmsFaq', 'cmsFeatures', 'cmsCta', 'cmsPageScaffold',
      'banner', 'badge',                  // v23.23.5
      'nameSuggestions',                  // v23.28
      'couponBanner', 'dropAnnouncement', // v23.31
    ]);
    const isJsonField = JSON_FIELDS.has(brief.field);

    const ai = await openaiChat({
      system,
      messages: [{ role: 'user', content: userMsg }],
      temperature: brief.field === 'cmsPageScaffold' ? 0.7 : 0.6,
      jsonMode: isJsonField,
    });

    if (!ai.ok) return NextResponse.json({ error: ai.error }, { status: 500 });

    if (brief.field === 'seo') {
      return NextResponse.json({
        ok: true,
        configured: true,
        json: ai.json,
        seoTitle: ai.json?.seoTitle || '',
        seoDesc: ai.json?.seoDesc || '',
      });
    }

    if (isJsonField) {
      return NextResponse.json({
        ok: true,
        configured: true,
        json: ai.json,
        data: ai.json,
      });
    }

    return NextResponse.json({
      ok: true,
      configured: true,
      text: (ai.text || '').trim(),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
