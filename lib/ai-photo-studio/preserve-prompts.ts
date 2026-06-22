// Strict design-preservation prompts.
//
// Non-negotiable rule from the brief:
//   AI-generated images must NOT alter the original product design.
//   They place the product in a scene; they do not change its colour,
//   weave, motif, hardware, stones, embroidery, dimensions, or proportions.
//
// We enforce this via TWO mechanisms:
//   1. Multi-reference Kontext editing — fal-ai/nano-banana-pro/edit accepts
//      the source image(s) as a reference, so the model literally has the
//      original pixels to copy from.
//   2. Anchor phrases in the prompt — explicit "preserve exact" language
//      that nano-banana-pro is trained to respect.

/**
 * The mandatory preservation header that goes at the start of EVERY prompt.
 * Sent verbatim, no paraphrasing.
 */
export const PRESERVE_HEADER = `STRICT DESIGN PRESERVATION (non-negotiable, this is the most important instruction):
The product visible in the reference image(s) must be reproduced PIXEL-FAITHFUL in the output.
The AI's job is to compose a SCENE around an UNCHANGED product, not to interpret or redraw it.

ABSOLUTE RULES — violating any of these constitutes job failure:
• EXACT COLOUR — every hue, saturation, and tone must match the reference. No colour-shifting, no recolouring, no "enhancement" of saturation.
• EXACT PATTERN — every motif, every repeat, every border element preserved at the same scale, density, and orientation as the reference. Do not regenerate the pattern — copy it.
• EXACT MATERIAL — the fabric weave, metal finish, wood grain, ceramic glaze, stone setting must match the reference's texture and reflectivity. Silk stays silk, brass stays brass, terracotta stays terracotta.
• EXACT DECORATIVE WORK — every thread of embroidery, every bead, every zardozi knot, every kundan stone, every chip-carved detail visible in the reference must appear in the same position with the same density in the output.
• EXACT HARDWARE — clasps, hooks, hinges, buttons, drawer pulls, lamp switches are part of the design and must be reproduced as shown.
• EXACT PROPORTIONS — do not stretch, squash, or re-proportion the product. The aspect ratio of the product itself (not the canvas) must match.
• EXACT MARKINGS — any printed text, hallmarks, brand tags, or signatures on the product must be preserved (do not invent new ones either).
• EXACT MISSING ELEMENTS — if the reference shows asymmetry, wear, hand-made irregularities, those are FEATURES and must be preserved. Do not "clean up" the product.

The reference image is the ABSOLUTE source of truth. When in any doubt, copy the reference more literally rather than less.`;

/**
 * Negative-prompt sentence appended to every prompt. nano-banana-pro respects
 * natural-language negatives. Worded explicitly because the model treats
 * negation more reliably when it's framed as concrete don'ts.
 */
export const NEGATIVE_TAIL = `STRICTLY FORBIDDEN ALTERATIONS:
Do NOT redesign, restyle, or reimagine the product in any way.
Do NOT shift colour balance — reds stay red, golds stay gold, indigos stay indigo, ivories stay ivory.
Do NOT add new motifs, paisleys, butis, florals, or geometric elements that are not in the reference.
Do NOT remove or simplify existing motifs, threadwork, embroidery, or surface decoration.
Do NOT change the weave structure (e.g. do not turn a Banarasi into a Chanderi, a tussar into a silk).
Do NOT add, remove, replace, or move jewellery stones, beads, kundans, polkis, or pearls.
Do NOT add or remove zari, gota, dabka, mukaish, mirror work, or sequins.
Do NOT "clean up" hand-made irregularities, weave variations, or natural hand-block printing imperfections — those are features.
Do NOT change the saree's pallu length, border width, or skirt drape geometry.
Do NOT alter metalwork finish from antique to bright (or vice versa).
Do NOT change wood grain, stain, polish, or upholstery fabric on furniture.
Do NOT crop, cover, hide, or obscure the product such that critical design elements are not visible in at least one variant.
Do NOT add product variants that don't exist in the reference (no "matching earrings" if reference shows only a necklace).
Do NOT "improve" or "modernise" the product — craft heritage means imperfection and patina are intentional.
The model/scene/lighting/styling serves the product — never the other way around.`;

/**
 * Model archetype descriptors. These describe ONLY the human (or absence of one),
 * never the product. Used inside scene-composition prompts.
 */
export const MODEL_ARCHETYPES: Record<string, string> = {
  warm: 'Indian woman in her late twenties with warm wheat-toned skin, dark hair tied back, minimal make-up, soft natural expression, modern minimal styling',
  cool: 'Indian woman in her late twenties with cool fair complexion, hair loosely down, clean natural make-up, contemplative expression, modern editorial styling',
  festive: 'Indian woman in her late twenties in bridal or festive look, warm honey skin, hair styled in a low bun with jasmine, traditional bindi and kajal, gentle festive expression',
  mannequin: 'invisible mannequin or ghost-mannequin display (no human, no face, no skin) — only the garment/jewellery suspended in space as if worn by an unseen figure',
};

/**
 * Style preset descriptors — overall aesthetic dial.
 */
export const STYLE_PRESETS: Record<string, string> = {
  editorial: 'editorial fashion photography, magazine quality, considered composition',
  minimal: 'minimalist composition, lots of negative space, single subject focus',
  festive: 'warm festive lighting with gentle golden hour glow, jasmine, brass, soft fabric drape',
  heritage: 'heritage Indian setting — sandstone walls, jaali shadows, terracotta floor, sun-lit',
};

/**
 * Category-specific "critical elements" reminders. These are added on top of
 * the universal header so the model is reminded which design elements matter
 * most for THIS particular craft type. Keyed by AiPhotoStrategy enum value.
 */
export const CRITICAL_ELEMENTS: Record<string, string> = {
  SAREE_ON_MODEL: `For this saree specifically: preserve the EXACT pallu (the decorative end-piece) design, the EXACT border width and motif on both selvedges, the EXACT body buti/repeat pattern density, the EXACT weave technique (zari work, brocade, jamdani, ikat, hand-block etc.), and the EXACT colour gradient if any. The pallu is the saree's signature — it must be reproducible from the reference.`,
  LEHENGA_ON_MODEL: `For this lehenga specifically: preserve the EXACT skirt embroidery placement and density, the EXACT border and hem work, the EXACT choli/blouse design as separate from the skirt, and the EXACT colour combinations. Do not blend or gradient colours that are distinct in the reference.`,
  KURTA_ON_MODEL: `For this kurta specifically: preserve the EXACT neckline cut and embroidery, the EXACT sleeve length and cuff design, the EXACT hem treatment, the EXACT placket/button arrangement, and the EXACT fabric print or weave. Do not lengthen or shorten the kurta.`,
  JEWELLERY_NECKLACE_ON_MODEL: `For this necklace specifically: preserve the EXACT number of stones/beads/elements (count them — if reference has 7 pendants, output has exactly 7), the EXACT stone shapes and settings (round/oval/uncut), the EXACT chain length and link pattern, the EXACT metal finish (yellow gold / rose / antique / silver), and the EXACT clasp design. Do not add or remove a single element.`,
  JEWELLERY_EARRING_ON_MODEL: `For these earrings specifically: preserve the EXACT shape (jhumka bell, chandbali crescent, stud, drop), the EXACT stone arrangement and count, the EXACT metal finish, and BOTH earrings of the pair must be identical to each other and to the reference. Do not show only one earring if reference shows a pair.`,
  JEWELLERY_BANGLE_ON_MODEL: `For this bangle specifically: preserve the EXACT diameter, the EXACT band width, the EXACT engraving/kundan/meenakari pattern wrapping around it, the EXACT closure mechanism (kada open, bangle closed, hinge), and the EXACT metal finish.`,
  JEWELLERY_RING_ON_HAND: `For this ring specifically: preserve the EXACT central stone (or absence of stone), the EXACT shank width and shape, the EXACT side-stone arrangement, the EXACT metal finish, and the EXACT engraving pattern if any.`,
  FURNITURE_IN_ROOM: `For this furniture piece specifically: preserve the EXACT proportions (width / height / depth ratio), the EXACT wood grain pattern and colour, the EXACT joinery and hardware (legs, handles, hinges visible in reference), the EXACT upholstery fabric and seam placement if upholstered, and any carved or inlay work in full detail.`,
  LAMP_ON_CONSOLE: `For this lamp specifically: preserve the EXACT shade shape and material (paper / silk / metal / glass), the EXACT base form and ornamentation, the EXACT proportions between shade and base, the EXACT switch/cord visible in reference, and the EXACT finial design.`,
  DECOR_ON_SHELF: `For this decor item specifically: preserve the EXACT silhouette, the EXACT surface treatment (patina, polish, antique finish), the EXACT carved/cast/painted detail, and the EXACT proportions. If it's a brass figurine, keep it brass — do not turn it into ceramic or wood.`,
  POTTERY_TABLE_SETTING: `For this pottery piece specifically: preserve the EXACT rim, foot, and silhouette curve, the EXACT glaze colour and crackle/speckle pattern, the EXACT decorative painting or carving, and the EXACT proportions. Hand-thrown irregularities are features.`,
  RUG_FLOOR_TOP_DOWN: `For this rug specifically: preserve the EXACT pattern repeat scale, the EXACT colour palette (count the colours — do not add new ones, do not merge similar ones), the EXACT border design, the EXACT fringe/edge treatment, and the EXACT pile texture (flatweave / pile / shag).`,
  PAINTING_ON_WALL: `For this painting specifically: preserve the EXACT subject and composition, the EXACT colour palette, the EXACT brushwork style or print finish, the EXACT frame design and finish, and the EXACT proportions of the artwork. Do not retouch or "improve" the painting.`,
  GENERIC_LIFESTYLE: `For this product specifically: preserve every visible design element, every colour, every texture, every dimension, every marking. Use the reference image(s) as the absolute source of truth.`,
};

/**
 * Optional regeneration feedback — if the admin clicked "reject + regenerate"
 * on a previous variant and added a note about what went wrong, this text is
 * appended so the model knows what to avoid this time.
 */
export function feedbackTail(note: string): string {
  const trimmed = note.trim().slice(0, 500);
  if (!trimmed) return '';
  return `\n\nIMPORTANT — PREVIOUS ATTEMPT FAILED with this issue:\n"${trimmed}"\nThis attempt MUST NOT repeat that problem. Take extra care with that specific aspect of the design.`;
}

/**
 * Combine the preserve header + scene composition + model + style + negatives
 * into the final prompt sent to fal-ai/nano-banana-pro/edit.
 */
export function buildFullPrompt(args: {
  composition: string;
  modelArchetype?: string | null;
  stylePreset?: string | null;
  productName?: string | null;
  craft?: string | null;
  strategyKey?: string | null;            // when set, prepends category-specific critical elements
  regenerationFeedback?: string | null;   // when set, appends "don't repeat this mistake" tail
}): string {
  const archetypeDesc =
    args.modelArchetype && MODEL_ARCHETYPES[args.modelArchetype]
      ? MODEL_ARCHETYPES[args.modelArchetype]
      : '';
  const styleDesc =
    args.stylePreset && STYLE_PRESETS[args.stylePreset]
      ? STYLE_PRESETS[args.stylePreset]
      : STYLE_PRESETS.editorial;

  // Build a one-line product label (for the model to know what it's looking at)
  const productLabel = [args.craft, args.productName].filter(Boolean).join(' — ');

  const criticalElements =
    args.strategyKey && CRITICAL_ELEMENTS[args.strategyKey]
      ? CRITICAL_ELEMENTS[args.strategyKey]
      : '';

  const feedback = args.regenerationFeedback ? feedbackTail(args.regenerationFeedback) : '';

  return [
    PRESERVE_HEADER,
    '',
    criticalElements ? `CATEGORY-SPECIFIC CRITICAL ELEMENTS:\n${criticalElements}` : '',
    criticalElements ? '' : null,
    `Product reference: ${productLabel || 'craft product (see reference image)'}.`,
    '',
    `Scene to compose:`,
    args.composition,
    '',
    archetypeDesc ? `Model: ${archetypeDesc}.` : '',
    `Overall style: ${styleDesc}.`,
    '',
    NEGATIVE_TAIL,
    feedback,
  ]
    .filter(s => s !== null && s !== undefined && s !== '')
    .join('\n');
}
