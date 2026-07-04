import { NextResponse } from 'next/server';
import { getSession, requireRole } from '@/lib/auth';
import { openaiChat, aiTextConfigured } from '@/lib/ai';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const STOCK_VISIBILITY_OPTIONS = [
  'IN_STOCK_ONLY',
  'SHOW_ALL',
  'HIDE_STOCK',
] as const;

const CTA_MODE_OPTIONS = [
  'SHOP_NOW',
  'EXPLORE',
  'DISCOVER',
  'VIEW_DETAILS',
  'PREORDER',
  'ENQUIRE',
  'ADD_TO_CART',
  'BUY_NOW',
  'GIFT_NOW',
  'LIMITED_DROP',
] as const;

const AUDIENCE_TAG_OPTIONS = [
  'EVERYDAY',
  'FESTIVE',
  'BRIDE',
  'GROOM',
  'GIFTING',
  'HOUSEWARMING',
  'COLLECTOR',
  'LUXURY_HOME',
  'HOSTING',
  'SEASONAL',
] as const;

type StockVisibility = (typeof STOCK_VISIBILITY_OPTIONS)[number];

type CatalogueDraftResponse = {
  catalogueStoryBlock: string;
  catalogueAudienceTag: string;
  catalogueCtaMode: string;
  catalogueImageQualityScore: number | null;
  catalogueFeatured: boolean;
  catalogueBestseller: boolean;
  catalogueEditorial: boolean;
  cataloguePinHero: boolean;
  catalogueStockVisibility: StockVisibility;
  cataloguePreferredImage: string | null;
};

function asText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(v => asText(v))
    .filter(Boolean);
}

function asNullableInt(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number.parseInt(String(value), 10);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, n));
}

function asBoolean(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function normalizeStockVisibility(value: unknown): StockVisibility {
  const raw = asText(value).toUpperCase();
  if (raw === 'SHOW_ALL') return 'SHOW_ALL';
  if (raw === 'HIDE_STOCK') return 'HIDE_STOCK';
  return 'IN_STOCK_ONLY';
}

function normalizeAudienceTag(value: unknown): string {
  const raw = asText(value).toUpperCase().replace(/\s+/g, '_');
  if (AUDIENCE_TAG_OPTIONS.includes(raw as any)) return raw;
  return raw || 'EVERYDAY';
}

function normalizeCtaMode(value: unknown): string {
  const raw = asText(value).toUpperCase().replace(/\s+/g, '_');
  if (CTA_MODE_OPTIONS.includes(raw as any)) return raw;
  return raw || 'EXPLORE';
}

function normalizePreferredImage(value: unknown, images: string[]): string | null {
  const url = asText(value);
  if (!url) return null;
  if (images.includes(url)) return url;
  return images[0] || null;
}

function buildPromptContext(body: any) {
  const images = asStringArray(body.images).slice(0, 12);

  return {
    name: asText(body.name),
    shortName: asText(body.shortName),
    description: asText(body.description),
    poeticLine: asText(body.poeticLine),
    story: asText(body.story),
    craft: asText(body.craft),
    region: asText(body.region),
    material: asText(body.material),
    technique: asText(body.technique),
    occasion: asText(body.occasion),
    categoryName: asText(body.categoryName),
    images,
    overwrite: asBoolean(body.overwrite),
    feedback: asText(body.feedback).slice(0, 500),
    existingCatalogue: {
      catalogueStoryBlock: asText(body.catalogueStoryBlock),
      catalogueAudienceTag: asText(body.catalogueAudienceTag),
      catalogueCtaMode: asText(body.catalogueCtaMode),
      catalogueImageQualityScore: asNullableInt(body.catalogueImageQualityScore),
      catalogueFeatured: asBoolean(body.catalogueFeatured),
      catalogueBestseller: asBoolean(body.catalogueBestseller),
      catalogueEditorial: asBoolean(body.catalogueEditorial),
      cataloguePinHero: asBoolean(body.cataloguePinHero),
      catalogueStockVisibility: normalizeStockVisibility(body.catalogueStockVisibility),
      cataloguePreferredImage: asText(body.cataloguePreferredImage),
    },
  };
}

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
    const context = buildPromptContext(body);

    if (!context.name && !context.description && !context.story && !context.categoryName) {
      return NextResponse.json(
        { error: 'Need at least name, description, story, or category to draft catalogue fields' },
        { status: 400 }
      );
    }

    const system = `You are NEEJEE's Catalogue Merchandising Assistant.
You draft catalogue-surface suggestions for a single product.
The output MUST be a single JSON object only.
Never output markdown.
Never auto-approve images.
Only choose cataloguePreferredImage from the provided image list.
Keep catalogueStoryBlock concise: 18 to 40 words.
Use quiet, premium, editorial Indian-English brand language.
Do not invent facts that contradict the supplied product data.

Return exactly this shape:
{
  "catalogueStoryBlock": "string",
  "catalogueAudienceTag": "EVERYDAY|FESTIVE|BRIDE|GROOM|GIFTING|HOUSEWARMING|COLLECTOR|LUXURY_HOME|HOSTING|SEASONAL",
  "catalogueCtaMode": "SHOP_NOW|EXPLORE|DISCOVER|VIEW_DETAILS|PREORDER|ENQUIRE|ADD_TO_CART|BUY_NOW|GIFT_NOW|LIMITED_DROP",
  "catalogueImageQualityScore": 0,
  "catalogueFeatured": false,
  "catalogueBestseller": false,
  "catalogueEditorial": false,
  "cataloguePinHero": false,
  "catalogueStockVisibility": "IN_STOCK_ONLY|SHOW_ALL|HIDE_STOCK",
  "cataloguePreferredImage": "string or empty"
}

Guidance for flags:
- cataloguePinHero = true only for an especially visual, hero-worthy piece.
- catalogueEditorial = true for distinctive storytelling or design-led products.
- catalogueFeatured = true for broadly merchandisable products.
- catalogueBestseller = true only if the product copy strongly suggests broad popular appeal; be conservative.
- catalogueImageQualityScore should be an integer 0-100. Use 80+ only if the image set sounds strong and catalogue-ready.
- catalogueStockVisibility should usually be IN_STOCK_ONLY unless the product context suggests transparent stock display is valuable.
- If no image clearly deserves override, return an empty string for cataloguePreferredImage.
`;

    const userMsg = `Product context:
${JSON.stringify(context, null, 2)}

Draft all catalogue fields now. If overwrite is false and an existing catalogue field already looks usable, you may keep it or lightly refine it, but still return every key.
If editor feedback is present, follow it carefully.
The preferred image must be chosen only from the provided images array, or left empty.`;

    const ai = await openaiChat({
      system,
      messages: [{ role: 'user', content: userMsg }],
      temperature: 0.5,
      jsonMode: true,
    });

    if (!ai.ok) {
      return NextResponse.json({ error: ai.error || 'AI request failed' }, { status: 500 });
    }

    if (!ai.json || typeof ai.json !== 'object') {
      return NextResponse.json({ error: 'AI returned no JSON' }, { status: 500 });
    }

    const json = ai.json as Record<string, unknown>;
    const images = context.images;

    const draft: CatalogueDraftResponse = {
      catalogueStoryBlock: asText(json.catalogueStoryBlock) || context.existingCatalogue.catalogueStoryBlock || '',
      catalogueAudienceTag: normalizeAudienceTag(json.catalogueAudienceTag || context.existingCatalogue.catalogueAudienceTag),
      catalogueCtaMode: normalizeCtaMode(json.catalogueCtaMode || context.existingCatalogue.catalogueCtaMode),
      catalogueImageQualityScore: asNullableInt(
        json.catalogueImageQualityScore ?? context.existingCatalogue.catalogueImageQualityScore
      ),
      catalogueFeatured: typeof json.catalogueFeatured === 'boolean'
        ? json.catalogueFeatured
        : context.existingCatalogue.catalogueFeatured,
      catalogueBestseller: typeof json.catalogueBestseller === 'boolean'
        ? json.catalogueBestseller
        : context.existingCatalogue.catalogueBestseller,
      catalogueEditorial: typeof json.catalogueEditorial === 'boolean'
        ? json.catalogueEditorial
        : context.existingCatalogue.catalogueEditorial,
      cataloguePinHero: typeof json.cataloguePinHero === 'boolean'
        ? json.cataloguePinHero
        : context.existingCatalogue.cataloguePinHero,
      catalogueStockVisibility: normalizeStockVisibility(
        json.catalogueStockVisibility ?? context.existingCatalogue.catalogueStockVisibility
      ),
      cataloguePreferredImage: normalizePreferredImage(
        json.cataloguePreferredImage ?? context.existingCatalogue.cataloguePreferredImage,
        images
      ),
    };

    return NextResponse.json({
      ok: true,
      configured: true,
      draft,
    });
  } catch (e: any) {
    console.error('[ai-draft-catalogue] error:', e);
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
