import { aiTextConfigured, openaiChat } from '@/lib/ai';
import { generateCoverFromPrompt } from '@/lib/journal/auto-curate';

export type EditorialBlockAiInput = {
  title?: string | null;
  blockType?: string | null;
  body?: string | null;
  subhead?: string | null;
  kicker?: string | null;
  audienceTag?: string | null;
  placement?: string | null;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  tags?: string[] | null;
  coverImagePrompt?: string | null;
};

export type EditorialBlockAiResult = {
  title: string;
  kicker: string | null;
  subhead: string | null;
  body: string;
  audienceTag: string | null;
  placement: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  tags: string[];
  coverImagePrompt: string | null;
};

function asText(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

function asTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .map((item) => asText(item))
          .filter(Boolean)
      )
    ).slice(0, 12);
  }

  if (typeof value === 'string') {
    return Array.from(
      new Set(
        value
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      )
    ).slice(0, 12);
  }

  return [];
}

function normalizeBlockType(value: unknown): string {
  const raw = asText(value).toUpperCase();
  switch (raw) {
    case 'HERO_COPY':
    case 'PRODUCT_STORY':
    case 'CAMPAIGN_MESSAGE':
    case 'CTA_STRIP':
      return raw;
    case 'RICH_TEXT':
    default:
      return 'RICH_TEXT';
  }
}

function nullableText(value: unknown): string | null {
  const text = asText(value);
  return text || null;
}

export function editorialBlocksAiConfigured(): boolean {
  return aiTextConfigured();
}

export async function generateEditorialBlockCopy(
  input: EditorialBlockAiInput
): Promise<EditorialBlockAiResult> {
  if (!aiTextConfigured()) {
    throw new Error('OPENAI_API_KEY is missing in the server runtime');
  }

  const context = {
    title: asText(input.title),
    blockType: normalizeBlockType(input.blockType),
    body: asText(input.body),
    subhead: asText(input.subhead),
    kicker: asText(input.kicker),
    audienceTag: asText(input.audienceTag),
    placement: asText(input.placement),
    ctaLabel: asText(input.ctaLabel),
    ctaHref: asText(input.ctaHref),
    tags: asTags(input.tags),
    coverImagePrompt: asText(input.coverImagePrompt),
  };

  if (
    !context.title &&
    !context.body &&
    !context.audienceTag &&
    !context.placement &&
    context.tags.length === 0
  ) {
    throw new Error(
      'Need at least title, body, audience tag, placement, or tags to generate editorial copy'
    );
  }

  const system = `You are NEEJEE's Editorial Blocks Assistant.
You create reusable editorial copy blocks for luxury Indian craft commerce.
Return JSON only. Never return markdown.

Brand rules:
- quiet, premium, editorial Indian-English
- elegant, clear, emotionally warm, never loud
- avoid clichés and hard-sell language
- do not invent factual claims
- keep copy reusable across merchandising surfaces

Block type guidance:
- RICH_TEXT: balanced reusable editorial paragraph
- HERO_COPY: stronger headline + premium lead
- PRODUCT_STORY: craft-forward story angle
- CAMPAIGN_MESSAGE: concise campaign framing
- CTA_STRIP: short persuasive strip with CTA

Return exactly this JSON shape:
{
  "title": "string",
  "kicker": "string or empty",
  "subhead": "string or empty",
  "body": "string",
  "audienceTag": "string or empty",
  "placement": "string or empty",
  "ctaLabel": "string or empty",
  "ctaHref": "string or empty",
  "tags": ["string"],
  "coverImagePrompt": "string or empty"
}

Quality rules:
- title: 3-8 words
- kicker: optional, compact
- subhead: optional, one sentence max
- body length:
  - CTA_STRIP: 12-30 words
  - HERO_COPY: 30-80 words
  - CAMPAIGN_MESSAGE: 20-60 words
  - PRODUCT_STORY: 50-140 words
  - RICH_TEXT: 50-140 words
- tags: 3-8 concise tags
- coverImagePrompt: describe a premium campaign/editorial visual matching the copy
- if an existing field is already strong, refine rather than overwrite blindly`;

  const userMessage = `Generate a reusable editorial block from this context:
${JSON.stringify(context, null, 2)}

Return every key in the required JSON shape.`;

  const ai = await openaiChat({
    system,
    messages: [{ role: 'user', content: userMessage }],
    model: 'gpt-4o-mini',
    temperature: 0.7,
    jsonMode: true,
  });

  if (!ai.ok) {
    throw new Error(ai.error || 'AI request failed');
  }

  if (!ai.json || typeof ai.json !== 'object') {
    throw new Error('AI returned no JSON');
  }

  const json = ai.json as Record<string, unknown>;

  return {
    title: asText(json.title) || context.title || 'Editorial Block',
    kicker: nullableText(json.kicker),
    subhead: nullableText(json.subhead),
    body: asText(json.body) || context.body || '',
    audienceTag: nullableText(json.audienceTag) || nullableText(context.audienceTag),
    placement: nullableText(json.placement) || nullableText(context.placement),
    ctaLabel: nullableText(json.ctaLabel) || nullableText(context.ctaLabel),
    ctaHref: nullableText(json.ctaHref) || nullableText(context.ctaHref),
    tags: asTags(json.tags).length > 0 ? asTags(json.tags) : context.tags,
    coverImagePrompt:
      nullableText(json.coverImagePrompt) || nullableText(context.coverImagePrompt),
  };
}

export async function generateEditorialBlockCover(
  prompt: string
): Promise<string> {
  const cleanPrompt = asText(prompt);
  if (!cleanPrompt) {
    throw new Error('Cover image prompt is required');
  }

  const imageUrl = await generateCoverFromPrompt(cleanPrompt);
  if (!imageUrl) {
    throw new Error('Cover generation failed');
  }

  return imageUrl;
}
