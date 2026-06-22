// Marketing Studio — generates 4 image variants + caption + hashtags
// for product / range / offer / generic brand posts.
//
// Pipeline per request:
//   1. Build a structured image prompt (LLM-assisted from product context)
//   2. Call nano-banana-pro 4 times in parallel for 4 variants
//   3. In parallel, call OpenAI for caption / hashtags / CTA copy
//   4. Return { variants: [{url}x4], copy: { caption, igCaption, emailSubject, hashtags } }

import { openaiChat, falRun } from '@/lib/ai';
import { prisma } from '@/lib/prisma';

export type StudioFlow = 'single_product' | 'range' | 'offer' | 'generic';

export type StudioFormat =
  | 'ig_square'    // 1:1   — Instagram feed
  | 'ig_story'     // 9:16  — Instagram story / reel cover
  | 'email_banner' // 2:1   — email header
  | 'fb_banner';   // 16:9  — Facebook / web banner

export type StudioStyle = 'minimal' | 'editorial' | 'festive' | 'moody';

export type StudioRequest = {
  flow: StudioFlow;
  // v23.34.1 — multi-select. Single-value props kept for back-compat.
  format?: StudioFormat;
  formats?: StudioFormat[];     // when set, generates one variant per (format, style) pair
  style?: StudioStyle;
  styles?: StudioStyle[];
  // Single product
  productId?: string;
  // Range
  productIds?: string[];
  categoryId?: string;
  // Offer
  couponId?: string;
  discountText?: string;        // e.g. "20% off" — if no coupon
  // Generic
  brief?: string;               // free-text editor brief
  // Optional overrides
  tone?: string;                // 'warm' | 'urgent' | 'calm' — defaults to brand voice
  variants?: number;            // 1-4 per (format, style) pair, default 1
  // v23.34.1 — branded overlay options
  ctaText?: string;             // 2-3 word CTA stamped on the creative
  productBadges?: string[];     // badge labels to embed (e.g. "FOUNDER'S EDIT", "HANDLOOM CERTIFIED")
  brandLogo?: boolean;          // burn NEEJEE wordmark into the corner (default true)
};

// v23.34.1 — per-pair variant carries its own format & style metadata so the
// UI can lay out a mixed grid of IG-Square, IG-Story, FB, etc.
export type StudioVariant = {
  url: string;
  index: number;
  format: StudioFormat;
  style: StudioStyle;
  aspectRatio: string;
};

export type StudioResult = {
  variants: StudioVariant[];
  copy: {
    instagramCaption: string;       // ~120 chars + hashtags inline
    instagramHashtags: string[];    // 8-12 tags
    emailSubject: string;
    emailPreheader: string;
    whatsappBroadcast: string;      // short, with link placeholder
    cta: string;                    // 2-3 word call-to-action
  };
  imagePrompt: string;              // first prompt (representative)
  diagnostics: {
    productNames: string[];
    flow: StudioFlow;
    formats: StudioFormat[];
    styles: StudioStyle[];
    imageError?: string;
    requestedVariants: number;
    pairCount: number;
    // v23.34.3 — expose which mode was used + how many refs were sent.
    mode: 'image-edit' | 'text-to-image';
    referenceImageCount: number;
  };
};

const ASPECT_BY_FORMAT: Record<StudioFormat, string> = {
  ig_square:    '1:1',
  ig_story:     '9:16',
  email_banner: '2:1',
  fb_banner:    '16:9',
};

// fal nano-banana-pro accepts only these enum values:
//   auto, 21:9, 16:9, 3:2, 4:3, 5:4, 1:1, 4:5, 3:4, 2:3, 9:16
// So '2:1' (email banner) maps to the closest supported — 16:9.
function falAspectRatio(format: StudioFormat): string {
  switch (format) {
    case 'ig_square':    return '1:1';
    case 'ig_story':     return '9:16';
    case 'email_banner': return '16:9'; // closest to 2:1 in fal's enum
    case 'fb_banner':    return '16:9';
  }
}

const STYLE_NOTES: Record<StudioStyle, string> = {
  minimal:   'minimalist composition, lots of negative space, single hero subject, soft natural light, muted ivory and beige tones',
  editorial: 'editorial fashion-magazine framing, dramatic lighting, considered composition, NEEJEE brand palette (ivory, mitti brown, banarasi gold, madder red, kohl black)',
  festive:   'celebratory mood, warm golden hour light, traditional Indian motifs as subtle accents (rangoli, marigold petals, diyas), banarasi gold and madder red dominant',
  moody:     'cinematic moody lighting, deep shadows, kohl-dark background, single dramatic light source, contemplative atmosphere',
};

const BRAND_GUARD = `NEEJEE brand: a slow, considered Indian craft house. ` +
  `Palette: ivory, mitti (warm brown), banarasi (deep gold), madder (russet red), kohl (near-black). ` +
  `Composition is considered, not cluttered. ` +
  `No faces unless explicitly requested. Editorial photography quality.`;

// v23.34.1 — branding overlay directive. Appended to the prompt when the caller
// wants logo / badges / CTA burned in. nano-banana-pro renders these as part
// of the image (a quiet wordmark in the corner, a thin band at the bottom
// holding the badges and CTA).
function brandingDirective(req: StudioRequest): string {
  const parts: string[] = [];
  const wantsLogo = req.brandLogo !== false; // default ON
  if (wantsLogo) {
    parts.push(
      'Include a small, restrained "NEEJEE" wordmark in the top-left corner ' +
      'in classic serif lettering, deep kohl black on ivory, exactly as a quiet ' +
      'editorial masthead. The dot in NEE•JEE is rendered as a single small madder-red dot.'
    );
  }
  if (req.productBadges && req.productBadges.length > 0) {
    const badges = req.productBadges.slice(0, 3).map(b => b.trim().toUpperCase()).join(' · ');
    parts.push(
      `Across the bottom of the image, render a single thin ivory band (about 8% of the height) ` +
      `with the badge text "${badges}" set in narrow uppercase tracking, kohl black on ivory. ` +
      `Tiny madder-red bullet dots separate the labels. Restrained, archival, never busy.`
    );
  }
  if (req.ctaText && req.ctaText.trim()) {
    const cta = req.ctaText.trim().toUpperCase().slice(0, 24);
    parts.push(
      `On the right edge of the bottom band, render a small rectangular madder-red ` +
      `button containing the words "${cta}" in ivory tracking-wide uppercase serif. ` +
      `The button is calm, not loud.`
    );
  }
  return parts.length > 0 ? ' Branding overlay: ' + parts.join(' ') : '';
}

/** Build the image prompt for a given request. Uses LLM only if context is rich; otherwise deterministic.
 *  When hasProductRefs is true the prompt is framed as an edit directive over
 *  the supplied reference images (the product MUST be preserved exactly).
 */
export async function buildImagePrompt(req: StudioRequest, productNames: string[], hasProductRefs = false): Promise<string> {
  // Pick representative style (caller may supply multiple via req.styles)
  const repStyle: StudioStyle = (req.styles && req.styles[0]) || req.style || 'editorial';
  const styleNote = STYLE_NOTES[repStyle];
  const subjectLine =
    req.flow === 'single_product' && productNames[0]
      ? `Subject: a hero product shot of "${productNames[0]}". `
      : req.flow === 'range' && productNames.length > 0
      ? `Subject: a flat-lay or styled grouping featuring ${productNames.length} pieces (${productNames.slice(0, 4).join(', ')}). `
      : req.flow === 'offer' && req.discountText
      ? `Subject: an editorial sale moment evoking ${req.discountText} off. Show abundance and considered choice. `
      : `Subject: a quiet NEEJEE brand mood image. `;

  const briefHint = req.brief ? `Editor's brief: "${req.brief}". ` : '';
  // pick a representative format for the LLM hint (caller may have many)
  const repFormat: StudioFormat = (req.formats && req.formats[0]) || req.format || 'ig_square';
  const branding = brandingDirective(req);

  // v23.34.3 — NON-NEGOTIABLE preservation block when refs are present.
  // This sits BEFORE the styling so the model treats the references as the
  // anchor, not as inspiration to remix.
  const preserveBlock = hasProductRefs
    ? `STRICT PRODUCT PRESERVATION: The reference images are the actual NEEJEE product. ` +
      `Render this EXACT product in the new scene. Preserve its precise shape, colour, ` +
      `pattern, texture, material, dimensions, and every fine detail (mosaic pattern, ` +
      `wood grain, embroidery, weave, stones, metalwork). Do NOT redesign, recolour, ` +
      `restyle, simplify, or substitute the product. The product is the hero subject ` +
      `placed in a new editorial setting. Re-light and re-stage the scene; do not re-imagine the product. `
    : '';

  // Try LLM enhancement for richness
  try {
    const r = await openaiChat({
      system: `You are an editorial-photography art director for NEEJEE, an Indian craft brand. ` +
              `${hasProductRefs ? 'You are writing a prompt for an IMAGE EDIT model that already has the product on reference. ' +
                  'Describe ONLY the new background, lighting, props, and mood — NEVER describe the product itself, ' +
                  'its colour, shape, or pattern, as those must come unchanged from the references. ' : ''}` +
              `Produce ONE image-generation prompt (40-70 words, single line). ${BRAND_GUARD}`,
      messages: [{
        role: 'user',
        content: `Build an image prompt for: ${subjectLine}${briefHint}Style direction: ${styleNote}. Aspect ratio: ${falAspectRatio(repFormat)}. Return ONLY the prompt text, single line, no quotes.`,
      }],
      temperature: hasProductRefs ? 0.5 : 0.7,
    });
    if (r.ok && r.text && r.text.length > 20) {
      const base = r.text.replace(/\n/g, ' ').replace(/^["']|["']$/g, '').trim();
      return preserveBlock + base + branding;
    }
  } catch { /* fall back */ }

  // Deterministic fallback
  return preserveBlock + `${subjectLine}${briefHint}${styleNote}. Editorial photography, high detail, ${falAspectRatio(repFormat)} aspect ratio. ${BRAND_GUARD}${branding}`;
}

// Per-pair prompt builder (when caller supplied multiple formats/styles, we
// override the representative style note with the pair's own style).
async function buildPromptForPair(
  baseReq: StudioRequest, productNames: string[], format: StudioFormat, style: StudioStyle,
  hasProductRefs: boolean,
): Promise<string> {
  const pairReq: StudioRequest = { ...baseReq, format, style, formats: undefined, styles: undefined };
  return buildImagePrompt(pairReq, productNames, hasProductRefs);
}

/** Call nano-banana-pro and return up to N variant URLs.
 *
 *  v23.34.3 — NON-NEGOTIABLE RULE: when productImageUrls are supplied we MUST
 *  use the edit endpoint that conditions on those exact images, so the actual
 *  product appears in every creative (no "inspired-by" hallucinations).
 *
 *  Routing:
 *    productImageUrls.length > 0  →  fal-ai/nano-banana-pro/edit (image-to-image)
 *    otherwise                    →  fal-ai/nano-banana-pro      (text-to-image)
 */
async function generateImageVariants(
  prompt: string,
  format: StudioFormat,
  count: number,
  productImageUrls: string[] = [],
): Promise<{ variants: Array<{ url: string; index: number }>; error?: string }> {
  const ar = falAspectRatio(format);
  const useEdit = productImageUrls.length > 0;
  const endpoint = useEdit ? 'fal-ai/nano-banana-pro/edit' : 'fal-ai/nano-banana-pro';

  // The edit endpoint expects `image_urls` (plural) and treats them as the
  // visual anchor. Cap at 4 references — nano-banana-pro fusing more than that
  // tends to dilute the subject.
  const refUrls = productImageUrls.slice(0, 4);

  const baseInput: any = {
    prompt,
    aspect_ratio: ar,
    num_images: count,
    output_format: 'jpeg',
    resolution: '1K',
  };
  if (useEdit) baseInput.image_urls = refUrls;

  // First try: one call with num_images
  const single = await falRun({
    endpoint,
    input: baseInput,
    timeoutMs: 180_000,
  });
  if (!single.ok) {
    console.error(`[studio] ${endpoint} single call failed:`, single.error);
  }
  const images: any[] = single.data?.images || [];
  if (images.length >= count) {
    return {
      variants: images.slice(0, count).map((img, i) => ({ url: img.url, index: i })),
    };
  }

  // Fallback: top up with parallel single-image calls (same endpoint, same refs)
  const need = count - images.length;
  const promises = Array.from({ length: need }, (_, i) =>
    falRun({
      endpoint,
      input: { ...baseInput, num_images: 1 },
      timeoutMs: 120_000,
    }).then(r => ({ ok: r.ok, url: r.data?.images?.[0]?.url, index: images.length + i, err: r.error }))
  );
  const extra = await Promise.all(promises);
  const merged: Array<{ url: string; index: number }> = [
    ...images.map((img, i) => ({ url: img.url, index: i })),
    ...extra.filter(r => r.ok && r.url).map(r => ({ url: r.url as string, index: r.index })),
  ];

  const errorMsg = !single.ok
    ? single.error
    : extra.find(r => !r.ok)?.err || (merged.length === 0 ? `${endpoint} returned no images` : undefined);

  return { variants: merged, error: errorMsg };
}

/** Generate copy via OpenAI. Returns the full copy bundle. */
async function generateCopy(req: StudioRequest, productNames: string[]): Promise<StudioResult['copy']> {
  const subjectContext =
    req.flow === 'single_product' && productNames[0]
      ? `Spotlighting: "${productNames[0]}"`
      : req.flow === 'range' && productNames.length > 0
      ? `Spotlighting a collection: ${productNames.slice(0, 5).join(', ')}`
      : req.flow === 'offer'
      ? `Promoting an offer: ${req.discountText || 'a special moment'}`
      : `Generic NEEJEE brand moment`;

  const briefHint = req.brief ? `Editor brief: "${req.brief}"` : '';
  const toneHint = req.tone ? `Tone: ${req.tone}.` : '';

  const sys = `You are NEEJEE's copywriter. NEEJEE is a slow Indian craft house. Voice is warm, sensory, never sales-y. Never use exclamation marks, SHOUTY CAPS, or words like SALE/HURRY/LIMITED.
Return JSON exactly matching this shape:
{
  "instagramCaption": "<70-130 char caption, sensory, ends with line break and CTA. No hashtags here.>",
  "instagramHashtags": ["<10 hashtags, no # symbol, lowercase, mix of brand + craft + audience tags>"],
  "emailSubject": "<30-55 char email subject, intriguing, no punctuation pyrotechnics>",
  "emailPreheader": "<60-90 char preheader expanding on the subject>",
  "whatsappBroadcast": "<60-110 char WhatsApp message, conversational, includes {LINK} placeholder>",
  "cta": "<2-3 word CTA in CAPS>"
}`;
  const repStyleForCopy = (req.styles && req.styles[0]) || req.style || 'editorial';
  const userMsg = `${subjectContext}.\n${briefHint}\n${toneHint}\nStyle preset: ${repStyleForCopy}.`;

  const r = await openaiChat({
    system: sys,
    messages: [{ role: 'user', content: userMsg }],
    temperature: 0.7,
    jsonMode: true,
  });

  if (r.ok && r.json && r.json.instagramCaption) {
    return {
      instagramCaption: String(r.json.instagramCaption || ''),
      instagramHashtags: Array.isArray(r.json.instagramHashtags) ? r.json.instagramHashtags.slice(0, 12) : [],
      emailSubject: String(r.json.emailSubject || ''),
      emailPreheader: String(r.json.emailPreheader || ''),
      whatsappBroadcast: String(r.json.whatsappBroadcast || ''),
      cta: String(r.json.cta || 'SHOP NOW').toUpperCase(),
    };
  }

  // Deterministic fallback
  return {
    instagramCaption: productNames[0]
      ? `${productNames[0]} — a piece that lingers in the room long after you've stopped looking.`
      : 'A moment from the NEEJEE atelier.',
    instagramHashtags: ['neejee', 'slowfashion', 'handloomindia', 'craftedinindia', 'banarasi', 'editorialfashion', 'artisanmade'],
    emailSubject: 'A new piece in the atelier',
    emailPreheader: 'Something we have been holding back to share with you first.',
    whatsappBroadcast: `A piece we have been quietly readying. {LINK}`,
    cta: 'SEE IT',
  };
}

/** Top-level entry. */
export async function runMarketingStudio(req: StudioRequest): Promise<StudioResult> {
  // 1) Hydrate product context — names AND actual photo URLs (v23.34.3).
  // Marketing creatives MUST feature the real product, not a similar object.
  let productNames: string[] = [];
  let productImageUrls: string[] = [];

  // Helper: pick the first non-empty gallery (Product.images or first variant.images).
  const pickHeroes = (p: any): string[] => {
    const base = Array.isArray(p.images) ? p.images.filter(Boolean) : [];
    if (base.length > 0) return base.slice(0, 3); // up to 3 reference angles
    for (const v of (p.variants || [])) {
      const vi = Array.isArray(v.images) ? v.images.filter(Boolean) : [];
      if (vi.length > 0) return vi.slice(0, 3);
    }
    return [];
  };

  if (req.productId) {
    const p: any = await prisma.product.findUnique({
      where: { id: req.productId },
      select: {
        name: true, images: true,
        variants: { select: { images: true }, take: 6 },
      },
    });
    if (p) {
      productNames.push(p.name);
      productImageUrls = pickHeroes(p);
    }
  } else if (req.productIds && req.productIds.length > 0) {
    const ps: any[] = await prisma.product.findMany({
      where: { id: { in: req.productIds } },
      select: {
        name: true, images: true,
        variants: { select: { images: true }, take: 4 },
      },
    });
    productNames = ps.map(p => p.name);
    // For ranges, take 1 hero per product (up to 4 references total)
    for (const p of ps) {
      const heroes = pickHeroes(p);
      if (heroes[0]) productImageUrls.push(heroes[0]);
      if (productImageUrls.length >= 4) break;
    }
  } else if (req.categoryId) {
    const ps: any[] = await prisma.product.findMany({
      where: { categoryId: req.categoryId, status: 'ACTIVE' },
      select: {
        name: true, images: true,
        variants: { select: { images: true }, take: 4 },
      },
      take: 8,
    });
    productNames = ps.map(p => p.name);
    for (const p of ps) {
      const heroes = pickHeroes(p);
      if (heroes[0]) productImageUrls.push(heroes[0]);
      if (productImageUrls.length >= 4) break;
    }
  }

  // 2) Build the (format × style) pair list. Caller may supply singles or arrays.
  const formats: StudioFormat[] = (req.formats && req.formats.length > 0)
    ? Array.from(new Set(req.formats))
    : [req.format || 'ig_square'];
  const styles: StudioStyle[] = (req.styles && req.styles.length > 0)
    ? Array.from(new Set(req.styles))
    : [req.style || 'editorial'];
  const perPair = Math.min(Math.max(req.variants || 1, 1), 4);

  // Cap total fal calls to keep wall-clock under 5 min.
  const pairs: Array<{ format: StudioFormat; style: StudioStyle }> = [];
  for (const f of formats) for (const s of styles) pairs.push({ format: f, style: s });
  const MAX_PAIRS = 12; // 12 pairs × 1 variant = ~12 fal calls
  const limitedPairs = pairs.slice(0, MAX_PAIRS);

  // 3) Fan-out: prompt + image per pair (all in parallel), copy in parallel.
  // The actual product photos (productImageUrls) are passed as references to
  // the edit endpoint so the same physical product appears in every creative.
  const pairResultsP = Promise.all(limitedPairs.map(async (p, idx) => {
    const prompt = await buildPromptForPair(req, productNames, p.format, p.style, productImageUrls.length > 0);
    const r = await generateImageVariants(prompt, p.format, perPair, productImageUrls);
    return r.variants.map((v, vIdx) => ({
      url: v.url,
      index: idx * perPair + vIdx,
      format: p.format,
      style: p.style,
      aspectRatio: falAspectRatio(p.format),
    }));
  }));
  const copyP = generateCopy(req, productNames);
  const [pairResults, copy] = await Promise.all([pairResultsP, copyP]);
  const allVariants: StudioVariant[] = pairResults.flat();

  // Representative prompt for diagnostics (first pair)
  const repPrompt = await buildPromptForPair(req, productNames, limitedPairs[0].format, limitedPairs[0].style, productImageUrls.length > 0);

  return {
    variants: allVariants,
    copy,
    imagePrompt: repPrompt,
    diagnostics: {
      productNames,
      flow: req.flow,
      formats,
      styles,
      requestedVariants: perPair * limitedPairs.length,
      pairCount: limitedPairs.length,
      mode: productImageUrls.length > 0 ? 'image-edit' : 'text-to-image',
      referenceImageCount: productImageUrls.length,
    },
  };
}
