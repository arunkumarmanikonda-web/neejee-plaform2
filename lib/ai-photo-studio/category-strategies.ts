// Per-category scene strategies for AI photo generation.
//
// Each strategy produces:
//   - autoDetect: function that maps category slug or product attributes to this strategy
//   - scenes: list of N scene presets used to generate variants
//   - modelArchetypes: which model variants are valid (e.g. 'warm', 'cool', 'festive', 'mannequin')
//
// Hard rule (enforced by prompt + multi-reference Kontext):
//   AI never alters the product design. Only places it in a scene.

export type SceneType = 'hero' | 'lifestyle' | 'detail' | 'scale';

export type ScenePreset = {
  sceneType: SceneType;
  // Short human-readable note shown in the UI
  sceneNote: string;
  // The composition prompt (no design language — that's added separately by preserve-prompts.ts)
  composition: string;
  // Which model archetype to use (overrides the user's selection if set)
  modelOverride?: 'warm' | 'cool' | 'festive' | 'mannequin' | null;
  // Aspect ratio for this scene
  aspectRatio: '1:1' | '4:5' | '3:4' | '2:3' | '16:9' | '9:16';
};

export type StrategyKey =
  | 'SAREE_ON_MODEL'
  | 'LEHENGA_ON_MODEL'
  | 'KURTA_ON_MODEL'
  | 'JEWELLERY_NECKLACE_ON_MODEL'
  | 'JEWELLERY_EARRING_ON_MODEL'
  | 'JEWELLERY_BANGLE_ON_MODEL'
  | 'JEWELLERY_RING_ON_HAND'
  | 'FURNITURE_IN_ROOM'
  | 'LAMP_ON_CONSOLE'
  | 'DECOR_ON_SHELF'
  | 'POTTERY_TABLE_SETTING'
  | 'RUG_FLOOR_TOP_DOWN'
  | 'PAINTING_ON_WALL'
  | 'GENERIC_LIFESTYLE';

export type Strategy = {
  key: StrategyKey;
  scenes: ScenePreset[];
  scaleShot?: ScenePreset;       // optional scale shot (added when addScaleShot=true)
  allowedModels: Array<'warm' | 'cool' | 'festive' | 'mannequin'>;
};

// Background/lighting palette — used across all strategies to keep brand consistency.
const NEEJEE_AMBIENCE =
  'soft natural daylight, warm ivory and beige tones, gentle mitti and madder accents in props, no harsh shadows, editorial India craft-house aesthetic';

// ─────────────────────────────────────────────────────────────────────────
// SAREE / DUPATTA
// ─────────────────────────────────────────────────────────────────────────
const SAREE: Strategy = {
  key: 'SAREE_ON_MODEL',
  allowedModels: ['warm', 'cool', 'festive', 'mannequin'],
  scenes: [
    {
      sceneType: 'hero',
      sceneNote: 'Draped on Indian model, full body, looking away',
      composition: `Indian woman model wearing the saree, draped traditionally in Nivi style, full body, three-quarter angle, looking softly away from camera, plain off-white textured wall, ${NEEJEE_AMBIENCE}, fashion-editorial composition, model holds a neutral pose with arms relaxed`,
      aspectRatio: '3:4',
    },
    {
      sceneType: 'hero',
      sceneNote: 'Mannequin display — design-forward',
      composition: `Saree draped on an invisible mannequin, Nivi style, no human figure, only the garment visible suspended in space, plain off-white background, ${NEEJEE_AMBIENCE}, allows the weave and motif to be the absolute hero`,
      modelOverride: 'mannequin',
      aspectRatio: '3:4',
    },
    {
      sceneType: 'lifestyle',
      sceneNote: 'Festive — golden hour, indoor courtyard',
      composition: `Indian woman model wearing the saree in a sun-lit Indian courtyard, festive setting, jasmine garlands and brass diyas softly in the background, golden hour light, the saree drape is the focal point, ${NEEJEE_AMBIENCE}`,
      modelOverride: 'festive',
      aspectRatio: '4:5',
    },
    {
      sceneType: 'detail',
      sceneNote: 'Pallu close-up — pleats and motif',
      composition: `Extreme close-up of the saree pallu, showing the border weave and motif detail, fabric draped softly over a pale wooden surface, ${NEEJEE_AMBIENCE}, macro photography style`,
      aspectRatio: '1:1',
    },
    {
      sceneType: 'detail',
      sceneNote: 'Weave macro — texture and thread',
      composition: `Macro photography of the saree fabric weave, showing thread density and silk texture, soft side lighting, plain ivory background, ${NEEJEE_AMBIENCE}, photo-textile quality`,
      aspectRatio: '1:1',
    },
    {
      sceneType: 'lifestyle',
      sceneNote: 'Editorial — minimalist studio',
      composition: `Indian woman model in saree, walking gently through a sun-drenched minimal studio with sheer linen curtains, mid-stride, the saree pleats catching air, ${NEEJEE_AMBIENCE}, editorial fashion shoot`,
      modelOverride: 'cool',
      aspectRatio: '3:4',
    },
  ],
  scaleShot: {
    sceneType: 'scale',
    sceneNote: 'Folded with hands for scale',
    composition: `Neatly folded saree being held in two female hands, top-down view against plain ivory surface, hands give a sense of size, ${NEEJEE_AMBIENCE}`,
    aspectRatio: '1:1',
  },
};

// ─────────────────────────────────────────────────────────────────────────
// LEHENGA
// ─────────────────────────────────────────────────────────────────────────
const LEHENGA: Strategy = {
  key: 'LEHENGA_ON_MODEL',
  allowedModels: ['warm', 'festive', 'mannequin'],
  scenes: [
    {
      sceneType: 'hero',
      sceneNote: 'Twirling pose — full skirt visible',
      composition: `Indian woman model wearing the lehenga, full skirt twirling outward to show the flare and embroidery, plain neutral backdrop, ${NEEJEE_AMBIENCE}, bridal editorial`,
      modelOverride: 'festive',
      aspectRatio: '3:4',
    },
    {
      sceneType: 'hero',
      sceneNote: 'Mannequin — skirt detail',
      composition: `Lehenga skirt on a mannequin, no upper body, focus on the embroidery and flare, plain ivory background, ${NEEJEE_AMBIENCE}`,
      modelOverride: 'mannequin',
      aspectRatio: '3:4',
    },
    {
      sceneType: 'lifestyle',
      sceneNote: 'Seated regal — heritage setting',
      composition: `Indian woman model seated in heritage palace courtyard, lehenga arranged gracefully, brass lamps softly in background, ${NEEJEE_AMBIENCE}`,
      modelOverride: 'festive',
      aspectRatio: '4:5',
    },
    {
      sceneType: 'detail',
      sceneNote: 'Embroidery macro',
      composition: `Macro shot of lehenga embroidery and zardozi detail, thread and bead work visible, ${NEEJEE_AMBIENCE}`,
      aspectRatio: '1:1',
    },
    {
      sceneType: 'detail',
      sceneNote: 'Border close-up',
      composition: `Close-up of the lehenga hem and border embellishment, fabric draped over a wooden surface, ${NEEJEE_AMBIENCE}`,
      aspectRatio: '1:1',
    },
    {
      sceneType: 'lifestyle',
      sceneNote: 'Bridal — soft warm light',
      composition: `Indian bride wearing the lehenga, soft warm sunset light, jasmine garland in hair, the lehenga is the visual hero, ${NEEJEE_AMBIENCE}`,
      modelOverride: 'festive',
      aspectRatio: '3:4',
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────
// KURTA / SUIT
// ─────────────────────────────────────────────────────────────────────────
const KURTA: Strategy = {
  key: 'KURTA_ON_MODEL',
  allowedModels: ['warm', 'cool', 'mannequin'],
  scenes: [
    {
      sceneType: 'hero',
      sceneNote: 'On model, three-quarter angle',
      composition: `Indian woman model wearing the kurta, three-quarter body, neutral pose, plain off-white background, ${NEEJEE_AMBIENCE}`,
      aspectRatio: '3:4',
    },
    {
      sceneType: 'hero',
      sceneNote: 'Flat-lay top-down',
      composition: `Kurta laid flat on a pale wooden surface, top-down view, sleeves arranged symmetrically, ${NEEJEE_AMBIENCE}`,
      modelOverride: null,
      aspectRatio: '1:1',
    },
    {
      sceneType: 'hero',
      sceneNote: 'On wooden hanger',
      composition: `Kurta hanging on a simple wooden hanger against a plain off-white wall, ${NEEJEE_AMBIENCE}`,
      modelOverride: null,
      aspectRatio: '3:4',
    },
    {
      sceneType: 'detail',
      sceneNote: 'Neckline embroidery',
      composition: `Close-up of the kurta neckline and embroidery detail, fabric draped softly, ${NEEJEE_AMBIENCE}`,
      aspectRatio: '1:1',
    },
    {
      sceneType: 'lifestyle',
      sceneNote: 'Editorial — natural light',
      composition: `Indian woman model in the kurta, leaning against a textured ivory wall, soft window light, ${NEEJEE_AMBIENCE}`,
      modelOverride: 'cool',
      aspectRatio: '4:5',
    },
    {
      sceneType: 'detail',
      sceneNote: 'Fabric weave macro',
      composition: `Macro shot of kurta fabric weave, showing thread and texture, ${NEEJEE_AMBIENCE}`,
      aspectRatio: '1:1',
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────
// JEWELLERY — NECKLACE
// ─────────────────────────────────────────────────────────────────────────
const NECKLACE: Strategy = {
  key: 'JEWELLERY_NECKLACE_ON_MODEL',
  allowedModels: ['warm', 'cool', 'festive', 'mannequin'],
  scenes: [
    {
      sceneType: 'hero',
      sceneNote: 'On Indian model — neck close-up',
      composition: `Indian woman model wearing the necklace, close-up on the décolletage and neck, looking down softly, plain off-shoulder ivory blouse, ${NEEJEE_AMBIENCE}`,
      modelOverride: 'warm',
      aspectRatio: '1:1',
    },
    {
      sceneType: 'hero',
      sceneNote: 'On mannequin bust',
      composition: `Necklace displayed on a plain ivory velvet bust mannequin, no human, ${NEEJEE_AMBIENCE}, jewellery editorial`,
      modelOverride: 'mannequin',
      aspectRatio: '1:1',
    },
    {
      sceneType: 'lifestyle',
      sceneNote: 'Festive bride',
      composition: `Indian bride wearing the necklace with traditional attire, side profile, soft golden light, ${NEEJEE_AMBIENCE}`,
      modelOverride: 'festive',
      aspectRatio: '4:5',
    },
    {
      sceneType: 'detail',
      sceneNote: 'Macro — pendant detail',
      composition: `Macro photography of the necklace pendant, showing setting and stone detail, dark velvet background, ${NEEJEE_AMBIENCE}`,
      aspectRatio: '1:1',
    },
    {
      sceneType: 'detail',
      sceneNote: 'Flat-lay on linen',
      composition: `Necklace laid flat on a folded ivory linen cloth, top-down, soft daylight, ${NEEJEE_AMBIENCE}`,
      aspectRatio: '1:1',
    },
    {
      sceneType: 'lifestyle',
      sceneNote: 'Editorial — minimal',
      composition: `Indian woman model wearing the necklace against a plain backdrop, three-quarter angle, modern minimal styling, ${NEEJEE_AMBIENCE}`,
      modelOverride: 'cool',
      aspectRatio: '3:4',
    },
  ],
  scaleShot: {
    sceneType: 'scale',
    sceneNote: 'In open palm for size',
    composition: `Necklace coiled gently in an open female hand, top-down, plain ivory background, hand gives sense of scale, ${NEEJEE_AMBIENCE}`,
    aspectRatio: '1:1',
  },
};

// ─────────────────────────────────────────────────────────────────────────
// JEWELLERY — EARRING
// ─────────────────────────────────────────────────────────────────────────
const EARRING: Strategy = {
  key: 'JEWELLERY_EARRING_ON_MODEL',
  allowedModels: ['warm', 'cool', 'festive', 'mannequin'],
  scenes: [
    {
      sceneType: 'hero',
      sceneNote: 'Side profile — ear close-up',
      composition: `Side profile of Indian woman model wearing the earrings, ear close-up, soft natural light, hair tucked back, ${NEEJEE_AMBIENCE}`,
      modelOverride: 'warm',
      aspectRatio: '1:1',
    },
    {
      sceneType: 'hero',
      sceneNote: 'Pair on velvet',
      composition: `Pair of earrings laid on plain ivory velvet, top-down, soft directional light to catch the metalwork, ${NEEJEE_AMBIENCE}`,
      modelOverride: null,
      aspectRatio: '1:1',
    },
    {
      sceneType: 'lifestyle',
      sceneNote: 'Bride — full face',
      composition: `Indian bride wearing the earrings with traditional jewellery, slight three-quarter face, soft warm light, ${NEEJEE_AMBIENCE}`,
      modelOverride: 'festive',
      aspectRatio: '4:5',
    },
    {
      sceneType: 'detail',
      sceneNote: 'Macro — single earring',
      composition: `Macro of a single earring, showing setting and detail, dark velvet background, ${NEEJEE_AMBIENCE}`,
      aspectRatio: '1:1',
    },
    {
      sceneType: 'detail',
      sceneNote: 'Hanging — natural sway',
      composition: `Earrings displayed on a clear acrylic stand, slight motion blur suggesting natural sway, plain ivory backdrop, ${NEEJEE_AMBIENCE}`,
      modelOverride: 'mannequin',
      aspectRatio: '1:1',
    },
    {
      sceneType: 'lifestyle',
      sceneNote: 'Editorial — cool tone',
      composition: `Indian model wearing the earrings, three-quarter face, neutral expression, ${NEEJEE_AMBIENCE}`,
      modelOverride: 'cool',
      aspectRatio: '3:4',
    },
  ],
  scaleShot: {
    sceneType: 'scale',
    sceneNote: 'Pair on fingertips',
    composition: `Pair of earrings held between female fingertips, top-down, plain ivory background, ${NEEJEE_AMBIENCE}`,
    aspectRatio: '1:1',
  },
};

// ─────────────────────────────────────────────────────────────────────────
// JEWELLERY — BANGLE / KADA / BRACELET
// ─────────────────────────────────────────────────────────────────────────
const BANGLE: Strategy = {
  key: 'JEWELLERY_BANGLE_ON_MODEL',
  allowedModels: ['warm', 'cool', 'festive', 'mannequin'],
  scenes: [
    {
      sceneType: 'hero',
      sceneNote: 'On wrist — three-quarter',
      composition: `Indian woman's wrist wearing the bangle, hand resting gently on a pale linen surface, ${NEEJEE_AMBIENCE}`,
      modelOverride: 'warm',
      aspectRatio: '1:1',
    },
    {
      sceneType: 'hero',
      sceneNote: 'Stacked on acrylic stand',
      composition: `Bangle displayed on a clear acrylic display stand, plain ivory background, ${NEEJEE_AMBIENCE}`,
      modelOverride: 'mannequin',
      aspectRatio: '1:1',
    },
    {
      sceneType: 'lifestyle',
      sceneNote: 'Bridal — hand mehendi',
      composition: `Indian bridal hand with mehendi wearing the bangle, festive setting, ${NEEJEE_AMBIENCE}`,
      modelOverride: 'festive',
      aspectRatio: '1:1',
    },
    {
      sceneType: 'detail',
      sceneNote: 'Macro — design detail',
      composition: `Macro shot of the bangle showing pattern and finish, dark velvet background, ${NEEJEE_AMBIENCE}`,
      aspectRatio: '1:1',
    },
    {
      sceneType: 'detail',
      sceneNote: 'Flat top-down',
      composition: `Bangle laid flat on ivory linen, top-down view, ${NEEJEE_AMBIENCE}`,
      aspectRatio: '1:1',
    },
    {
      sceneType: 'lifestyle',
      sceneNote: 'Editorial — bracelet stack',
      composition: `Indian model's arm raised gently, bangle clearly visible, ${NEEJEE_AMBIENCE}`,
      modelOverride: 'cool',
      aspectRatio: '3:4',
    },
  ],
  scaleShot: {
    sceneType: 'scale',
    sceneNote: 'Held in palm',
    composition: `Bangle held in an open palm, top-down, plain ivory background, ${NEEJEE_AMBIENCE}`,
    aspectRatio: '1:1',
  },
};

// ─────────────────────────────────────────────────────────────────────────
// JEWELLERY — RING
// ─────────────────────────────────────────────────────────────────────────
const RING: Strategy = {
  key: 'JEWELLERY_RING_ON_HAND',
  allowedModels: ['warm', 'cool', 'festive', 'mannequin'],
  scenes: [
    {
      sceneType: 'hero',
      sceneNote: 'On finger — graceful hand',
      composition: `Indian woman's hand wearing the ring, fingers relaxed, plain ivory background, ${NEEJEE_AMBIENCE}`,
      modelOverride: 'warm',
      aspectRatio: '1:1',
    },
    {
      sceneType: 'hero',
      sceneNote: 'On velvet pedestal',
      composition: `Ring placed on a small ivory velvet pedestal, plain background, ${NEEJEE_AMBIENCE}`,
      modelOverride: 'mannequin',
      aspectRatio: '1:1',
    },
    {
      sceneType: 'detail',
      sceneNote: 'Macro — top-down',
      composition: `Macro top-down of the ring on dark velvet, showing setting detail, ${NEEJEE_AMBIENCE}`,
      aspectRatio: '1:1',
    },
    {
      sceneType: 'detail',
      sceneNote: 'Profile — band thickness',
      composition: `Side profile of the ring, showing band thickness and inner detail, ${NEEJEE_AMBIENCE}`,
      aspectRatio: '1:1',
    },
    {
      sceneType: 'lifestyle',
      sceneNote: 'Bridal hand',
      composition: `Indian bridal hand with mehendi wearing the ring, festive setting, ${NEEJEE_AMBIENCE}`,
      modelOverride: 'festive',
      aspectRatio: '1:1',
    },
    {
      sceneType: 'lifestyle',
      sceneNote: 'Editorial — hand portrait',
      composition: `Indian woman's hand resting on a stone surface, ring catching natural light, ${NEEJEE_AMBIENCE}`,
      modelOverride: 'cool',
      aspectRatio: '1:1',
    },
  ],
  scaleShot: {
    sceneType: 'scale',
    sceneNote: 'In fingertips for size',
    composition: `Ring held between thumb and forefinger, top-down, plain ivory background, ${NEEJEE_AMBIENCE}`,
    aspectRatio: '1:1',
  },
};

// ─────────────────────────────────────────────────────────────────────────
// FURNITURE
// ─────────────────────────────────────────────────────────────────────────
const FURNITURE: Strategy = {
  key: 'FURNITURE_IN_ROOM',
  allowedModels: ['mannequin'], // no human required
  scenes: [
    {
      sceneType: 'hero',
      sceneNote: 'In styled living room',
      composition: `The furniture piece placed in a styled Indian-modern living room, soft natural light from a window, neutral linen sofa nearby, ${NEEJEE_AMBIENCE}, the furniture is the focal point`,
      aspectRatio: '4:5',
    },
    {
      sceneType: 'hero',
      sceneNote: 'Clean studio — three-quarter',
      composition: `The furniture piece on a plain off-white cyclorama background, three-quarter angle, ${NEEJEE_AMBIENCE}, e-commerce hero shot`,
      aspectRatio: '1:1',
    },
    {
      sceneType: 'lifestyle',
      sceneNote: 'Bedroom setting',
      composition: `The furniture piece in a serene bedroom, hand-block printed quilt visible nearby, soft morning light, ${NEEJEE_AMBIENCE}`,
      aspectRatio: '4:5',
    },
    {
      sceneType: 'detail',
      sceneNote: 'Material macro',
      composition: `Close-up of the furniture's material — wood grain or upholstery weave — showing texture and finish, ${NEEJEE_AMBIENCE}`,
      aspectRatio: '1:1',
    },
    {
      sceneType: 'detail',
      sceneNote: 'Hardware/joinery detail',
      composition: `Close-up of the furniture's hardware or joinery, showing craftsmanship, ${NEEJEE_AMBIENCE}`,
      aspectRatio: '1:1',
    },
    {
      sceneType: 'lifestyle',
      sceneNote: 'Open courtyard — heritage',
      composition: `The furniture piece in a sun-lit Indian courtyard with terracotta floor, neem tree shadow softly, ${NEEJEE_AMBIENCE}`,
      aspectRatio: '4:5',
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────
// LAMP / LANTERN
// ─────────────────────────────────────────────────────────────────────────
const LAMP: Strategy = {
  key: 'LAMP_ON_CONSOLE',
  allowedModels: ['mannequin'],
  scenes: [
    {
      sceneType: 'hero',
      sceneNote: 'On wooden console table',
      composition: `The lamp placed on a wooden console table against a textured plaster wall, lamp switched on with warm glow, book and brass dish nearby, ${NEEJEE_AMBIENCE}, evening interior`,
      aspectRatio: '4:5',
    },
    {
      sceneType: 'hero',
      sceneNote: 'Clean studio shot',
      composition: `The lamp on a plain off-white background, three-quarter angle, switched off so the design reads clearly, ${NEEJEE_AMBIENCE}, e-commerce hero`,
      aspectRatio: '1:1',
    },
    {
      sceneType: 'lifestyle',
      sceneNote: 'Bedside — switched on',
      composition: `The lamp on a bedside table next to a serene Indian bedroom bed, lamp emits a warm glow, evening, ${NEEJEE_AMBIENCE}`,
      aspectRatio: '4:5',
    },
    {
      sceneType: 'lifestyle',
      sceneNote: 'Reading nook',
      composition: `The lamp on a side table beside a linen-upholstered reading chair, open book on the chair, soft evening light, ${NEEJEE_AMBIENCE}`,
      aspectRatio: '4:5',
    },
    {
      sceneType: 'detail',
      sceneNote: 'Base detail close-up',
      composition: `Close-up of the lamp's base, showing material and craftsmanship, ${NEEJEE_AMBIENCE}`,
      aspectRatio: '1:1',
    },
    {
      sceneType: 'detail',
      sceneNote: 'Shade glow',
      composition: `Close-up of the lamp shade lit from within, showing texture and warmth, ${NEEJEE_AMBIENCE}`,
      aspectRatio: '1:1',
    },
  ],
  scaleShot: {
    sceneType: 'scale',
    sceneNote: 'Beside everyday object',
    composition: `The lamp on a console table next to a hardcover book and a small ceramic cup for scale reference, ${NEEJEE_AMBIENCE}`,
    aspectRatio: '1:1',
  },
};

// ─────────────────────────────────────────────────────────────────────────
// DECOR / ARTEFACTS — small items
// ─────────────────────────────────────────────────────────────────────────
const DECOR: Strategy = {
  key: 'DECOR_ON_SHELF',
  allowedModels: ['mannequin'],
  scenes: [
    {
      sceneType: 'hero',
      sceneNote: 'On a styled shelf vignette',
      composition: `The decor item on a wooden shelf, styled vignette with a small plant and one ceramic piece nearby, plain ivory wall, ${NEEJEE_AMBIENCE}`,
      aspectRatio: '4:5',
    },
    {
      sceneType: 'hero',
      sceneNote: 'Clean studio shot',
      composition: `The decor item on plain off-white background, three-quarter angle, ${NEEJEE_AMBIENCE}, e-commerce hero`,
      aspectRatio: '1:1',
    },
    {
      sceneType: 'lifestyle',
      sceneNote: 'Coffee table styling',
      composition: `The decor item on a low wooden coffee table, alongside a stack of two art books and a small brass dish, ${NEEJEE_AMBIENCE}`,
      aspectRatio: '4:5',
    },
    {
      sceneType: 'lifestyle',
      sceneNote: 'Window sill — natural light',
      composition: `The decor item placed on a window sill with sheer curtain backdrop, soft afternoon light, ${NEEJEE_AMBIENCE}`,
      aspectRatio: '4:5',
    },
    {
      sceneType: 'detail',
      sceneNote: 'Material macro',
      composition: `Close-up of the decor item's material and craftsmanship detail, ${NEEJEE_AMBIENCE}`,
      aspectRatio: '1:1',
    },
    {
      sceneType: 'detail',
      sceneNote: 'Top-down on linen',
      composition: `Top-down of the decor item on folded ivory linen, ${NEEJEE_AMBIENCE}`,
      aspectRatio: '1:1',
    },
  ],
  scaleShot: {
    sceneType: 'scale',
    sceneNote: 'Held in hand',
    composition: `The decor item held in a female hand, plain ivory background, ${NEEJEE_AMBIENCE}`,
    aspectRatio: '1:1',
  },
};

// ─────────────────────────────────────────────────────────────────────────
// POTTERY / KITCHENWARE
// ─────────────────────────────────────────────────────────────────────────
const POTTERY: Strategy = {
  key: 'POTTERY_TABLE_SETTING',
  allowedModels: ['mannequin'],
  scenes: [
    {
      sceneType: 'hero',
      sceneNote: 'On dining table — top-down',
      composition: `The pottery piece on a styled dining table, top-down view, linen napkin and one neutral side plate visible, ${NEEJEE_AMBIENCE}`,
      aspectRatio: '1:1',
    },
    {
      sceneType: 'hero',
      sceneNote: 'Clean studio — three-quarter',
      composition: `The pottery piece on plain off-white background, three-quarter angle, ${NEEJEE_AMBIENCE}, e-commerce hero`,
      aspectRatio: '1:1',
    },
    {
      sceneType: 'lifestyle',
      sceneNote: 'Set with food propping',
      composition: `The pottery piece with light food propping that complements but does not obscure the design — for example a sprig of herbs or a few grains, ${NEEJEE_AMBIENCE}`,
      aspectRatio: '4:5',
    },
    {
      sceneType: 'lifestyle',
      sceneNote: 'Rustic kitchen counter',
      composition: `The pottery piece on a wooden kitchen counter beside a linen cloth, ${NEEJEE_AMBIENCE}`,
      aspectRatio: '4:5',
    },
    {
      sceneType: 'detail',
      sceneNote: 'Glaze macro',
      composition: `Macro shot of the pottery's glaze and surface detail, ${NEEJEE_AMBIENCE}`,
      aspectRatio: '1:1',
    },
    {
      sceneType: 'detail',
      sceneNote: 'Profile silhouette',
      composition: `Side profile of the pottery piece against a softly lit plain background, ${NEEJEE_AMBIENCE}`,
      aspectRatio: '1:1',
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────
// RUG / DHURRIE
// ─────────────────────────────────────────────────────────────────────────
const RUG: Strategy = {
  key: 'RUG_FLOOR_TOP_DOWN',
  allowedModels: ['mannequin'],
  scenes: [
    {
      sceneType: 'hero',
      sceneNote: 'Top-down — full rug visible',
      composition: `The rug laid on a polished wooden floor, top-down view, entire rug visible, ${NEEJEE_AMBIENCE}`,
      aspectRatio: '4:5',
    },
    {
      sceneType: 'lifestyle',
      sceneNote: 'In living room',
      composition: `The rug placed in a styled living room with linen sofa and wooden coffee table partly visible, ${NEEJEE_AMBIENCE}`,
      aspectRatio: '4:5',
    },
    {
      sceneType: 'detail',
      sceneNote: 'Weave macro',
      composition: `Macro shot of the rug's weave and pile, ${NEEJEE_AMBIENCE}`,
      aspectRatio: '1:1',
    },
    {
      sceneType: 'detail',
      sceneNote: 'Corner & fringe',
      composition: `Close-up of one corner of the rug, showing fringe and edge finishing, ${NEEJEE_AMBIENCE}`,
      aspectRatio: '1:1',
    },
    {
      sceneType: 'lifestyle',
      sceneNote: 'Bedroom — runner placement',
      composition: `The rug placed beside a bed as a runner, neutral bedroom styling, ${NEEJEE_AMBIENCE}`,
      aspectRatio: '4:5',
    },
    {
      sceneType: 'detail',
      sceneNote: 'Pattern repeat focus',
      composition: `Mid-distance shot focused on the rug's central pattern repeat, ${NEEJEE_AMBIENCE}`,
      aspectRatio: '1:1',
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────
// PAINTING / WALL ART
// ─────────────────────────────────────────────────────────────────────────
const PAINTING: Strategy = {
  key: 'PAINTING_ON_WALL',
  allowedModels: ['mannequin'],
  scenes: [
    {
      sceneType: 'hero',
      sceneNote: 'On textured plaster wall',
      composition: `The painting hung on a textured ivory plaster wall, soft natural light, no other distractions, ${NEEJEE_AMBIENCE}`,
      aspectRatio: '4:5',
    },
    {
      sceneType: 'lifestyle',
      sceneNote: 'Over a console',
      composition: `The painting hung above a wooden console table with a small lamp and ceramic piece, ${NEEJEE_AMBIENCE}`,
      aspectRatio: '4:5',
    },
    {
      sceneType: 'lifestyle',
      sceneNote: 'Living room gallery',
      composition: `The painting on a living room wall above a linen sofa, soft daylight, ${NEEJEE_AMBIENCE}`,
      aspectRatio: '4:5',
    },
    {
      sceneType: 'detail',
      sceneNote: 'Brushwork macro',
      composition: `Macro of the painting's brushwork or print detail, ${NEEJEE_AMBIENCE}`,
      aspectRatio: '1:1',
    },
    {
      sceneType: 'detail',
      sceneNote: 'Frame corner',
      composition: `Close-up of the painting's frame corner, showing finish and edge, ${NEEJEE_AMBIENCE}`,
      aspectRatio: '1:1',
    },
    {
      sceneType: 'hero',
      sceneNote: 'Straight-on, full work visible',
      composition: `Direct front view of the painting, full work visible, plain ivory background, ${NEEJEE_AMBIENCE}, e-commerce hero`,
      aspectRatio: '1:1',
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────
// GENERIC FALLBACK
// ─────────────────────────────────────────────────────────────────────────
const GENERIC: Strategy = {
  key: 'GENERIC_LIFESTYLE',
  allowedModels: ['warm', 'mannequin'],
  scenes: [
    {
      sceneType: 'hero',
      sceneNote: 'Clean studio — three-quarter',
      composition: `The product on a plain off-white background, three-quarter angle, soft daylight, ${NEEJEE_AMBIENCE}`,
      aspectRatio: '1:1',
    },
    {
      sceneType: 'hero',
      sceneNote: 'Top-down on linen',
      composition: `The product laid on folded ivory linen, top-down, ${NEEJEE_AMBIENCE}`,
      aspectRatio: '1:1',
    },
    {
      sceneType: 'lifestyle',
      sceneNote: 'Styled vignette',
      composition: `The product in a soft styled vignette with one complementary prop, ${NEEJEE_AMBIENCE}`,
      aspectRatio: '4:5',
    },
    {
      sceneType: 'lifestyle',
      sceneNote: 'Natural light setting',
      composition: `The product in a natural light setting with soft shadow, ${NEEJEE_AMBIENCE}`,
      aspectRatio: '4:5',
    },
    {
      sceneType: 'detail',
      sceneNote: 'Material macro',
      composition: `Macro shot of the product's material detail, ${NEEJEE_AMBIENCE}`,
      aspectRatio: '1:1',
    },
    {
      sceneType: 'detail',
      sceneNote: 'Profile shot',
      composition: `Side profile of the product on plain background, ${NEEJEE_AMBIENCE}`,
      aspectRatio: '1:1',
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────
// Strategy registry
// ─────────────────────────────────────────────────────────────────────────
export const STRATEGIES: Record<StrategyKey, Strategy> = {
  SAREE_ON_MODEL: SAREE,
  LEHENGA_ON_MODEL: LEHENGA,
  KURTA_ON_MODEL: KURTA,
  JEWELLERY_NECKLACE_ON_MODEL: NECKLACE,
  JEWELLERY_EARRING_ON_MODEL: EARRING,
  JEWELLERY_BANGLE_ON_MODEL: BANGLE,
  JEWELLERY_RING_ON_HAND: RING,
  FURNITURE_IN_ROOM: FURNITURE,
  LAMP_ON_CONSOLE: LAMP,
  DECOR_ON_SHELF: DECOR,
  POTTERY_TABLE_SETTING: POTTERY,
  RUG_FLOOR_TOP_DOWN: RUG,
  PAINTING_ON_WALL: PAINTING,
  GENERIC_LIFESTYLE: GENERIC,
};

/**
 * Auto-detect strategy from a category slug + optional product name/description/craft.
 * Returns the most specific matching strategy. Falls back to GENERIC.
 *
 * Scans ALL provided text fields case-insensitively. Order matters — jewellery
 * is checked before generic "decor" because a brass bangle should be shot on
 * a wrist, not on a shelf.
 */
export function detectStrategy(args: {
  categorySlug?: string | null;
  categoryName?: string | null;
  productName?: string | null;
  productDescription?: string | null;
  craft?: string | null;
}): StrategyKey {
  const corpus = [
    args.categorySlug,
    args.categoryName,
    args.productName,
    args.productDescription,
    args.craft,
  ]
    .filter(Boolean)
    .map(s => (s as string).toLowerCase())
    .join(' ');

  // Order matters — most specific first.
  // Apparel
  if (/\b(saree|sari|dupatta)\b/.test(corpus)) return 'SAREE_ON_MODEL';
  if (/\b(lehenga|lehnga|ghagra|sharara|gharara)\b/.test(corpus)) return 'LEHENGA_ON_MODEL';
  if (/\b(kurta|kurti|suit|blouse|kameez|shirt|tunic|anarkali)\b/.test(corpus)) return 'KURTA_ON_MODEL';

  // Jewellery — check BEFORE generic "decor/brass" so brass bangles route correctly
  if (/\b(bangle|bangles|kada|bracelet|kangan|cuff|wristlet)\b/.test(corpus)) return 'JEWELLERY_BANGLE_ON_MODEL';
  if (/\b(necklace|necklaces|haar|mala|chain|pendant|choker|rani-haar|raani)\b/.test(corpus)) return 'JEWELLERY_NECKLACE_ON_MODEL';
  if (/\b(earring|earrings|jhumka|jhumki|jhumkas|stud|studs|ear-cuff|ear cuff|chandbali|chandbalis|dangler|danglers)\b/.test(corpus)) return 'JEWELLERY_EARRING_ON_MODEL';
  if (/\b(ring|rings|anguthi|anguthis)\b/.test(corpus)) return 'JEWELLERY_RING_ON_HAND';

  // Home & decor
  if (/\b(lamp|lamps|lantern|lanterns|diya|diyas|candle|sconce)\b/.test(corpus)) return 'LAMP_ON_CONSOLE';
  if (/\b(rug|rugs|dhurrie|dhurries|carpet|durry|runner)\b/.test(corpus)) return 'RUG_FLOOR_TOP_DOWN';
  if (/\b(painting|paintings|art|print|frame|tanjore|madhubani|pichwai|kalighat)\b/.test(corpus)) return 'PAINTING_ON_WALL';
  if (/\b(pottery|bowl|bowls|vase|vases|urli|kulhad|tableware|kitchenware|dinnerware|plate|plates)\b/.test(corpus)) return 'POTTERY_TABLE_SETTING';
  if (/\b(furniture|chair|chairs|table|tables|bed|stool|sofa|console|shelf|shelves|cabinet|desk|jhula|swing|peetha)\b/.test(corpus)) return 'FURNITURE_IN_ROOM';

  // Catch-all decor LAST so it doesn't grab jewellery items containing the word "brass"
  if (/\b(decor|artefact|artifact|figurine|sculpture|ornament|idol|murti)\b/.test(corpus)) return 'DECOR_ON_SHELF';

  return 'GENERIC_LIFESTYLE';
}
