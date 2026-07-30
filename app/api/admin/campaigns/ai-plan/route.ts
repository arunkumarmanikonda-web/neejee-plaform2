import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { aiTextConfigured, openaiChat } from '@/lib/ai';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 45;

const ALLOWED = ['ADMIN', 'SUPER_ADMIN'];

type ExistingCoupon = {
  code?: string;
  type?: 'PERCENT' | 'FLAT' | 'FREE_SHIPPING';
  value?: number;
  minCart?: number;
  maxDiscount?: number | null;
  maxUses?: number | null;
  active?: boolean;
  redemptionCount?: number;
  revenue?: number;
};

type CampaignPlan = {
  campaignName: string;
  strategy: string;
  recommendedMode: 'single' | 'bulk';
  code: string;
  prefix: string;
  type: 'PERCENT' | 'FLAT' | 'FREE_SHIPPING';
  value: number;
  minCart: number;
  maxDiscount: number | null;
  maxUses: number | null;
  perUserOnce: boolean;
  validDays: number;
  headline: string;
  description: string;
  emailSubject: string;
  instagramCaption: string;
  whatsappLine: string;
  rationale: string[];
};

function safeCodeWord(text: string) {
  const letters = (text || 'NEEJEE').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return (letters.slice(0, 10) || 'NEEJEE');
}

function deterministicPlan(objective: string, coupons: ExistingCoupon[]): CampaignPlan {
  const lower = objective.toLowerCase();
  const isGift = /gift|rakhi|wedding|festive|diwali|occasion/.test(lower);
  const isDormant = /dormant|winback|inactive|lapsed/.test(lower);
  const isMarginProtect = /margin|protect|profit|premium/.test(lower);
  const mode: 'single' | 'bulk' = /influencer|creator|affiliate|bulk|many/.test(lower) ? 'bulk' : 'single';
  const type: 'PERCENT' | 'FLAT' | 'FREE_SHIPPING' =
    /shipping/.test(lower) ? 'FREE_SHIPPING' : /flat|rupee|₹/.test(lower) ? 'FLAT' : 'PERCENT';

  const prefix = safeCodeWord(
    isGift ? 'GIFT' :
    isDormant ? 'RETURN' :
    'FOUND'
  );

  const value =
    type === 'FREE_SHIPPING' ? 0 :
    type === 'FLAT' ? (isMarginProtect ? 1000 : 1500) :
    (isMarginProtect ? 10 : 12);

  const minCart = isGift ? 6000 : 4500;
  const maxDiscount = type === 'PERCENT' ? (isMarginProtect ? 1800 : 2200) : null;
  const activeCodes = coupons.filter(c => c.active).length;
  const validDays = isGift ? 7 : 14;
  const code = `${prefix}${new Date().toISOString().slice(5, 7)}${new Date().toISOString().slice(8, 10)}`;

  return {
    campaignName: isGift ? 'Gift-intent founder offer' : isDormant ? 'Win-back founder edit' : 'Founder selection push',
    strategy: isGift
      ? 'Use a tight-time-window offer that nudges gifting intent without flattening perceived craft value.'
      : isDormant
        ? 'Re-engage quiet customers with a clean founder-signed reason to return, without turning the brand voice into a sale shout.'
        : 'Use a measured, founder-led offer that gives permission to act now while keeping the code usable across email, Instagram, and direct sharing.',
    recommendedMode: mode,
    code,
    prefix,
    type,
    value,
    minCart,
    maxDiscount,
    maxUses: mode === 'bulk' ? 250 : 150,
    perUserOnce: true,
    validDays,
    headline: isGift ? 'A founder-picked offer for meaningful gifting' : 'A quiet nudge toward something worth choosing',
    description: 'Keep the copy rooted in founder curation, Indian craft specificity, and a short, believable validity window.',
    emailSubject: isGift ? 'A founder-picked gift window, for a few days only' : 'A short founder offer on pieces worth returning to',
    instagramCaption: 'Found with care, now easier to choose for a short window. Use the code at checkout and keep the selection personal.',
    whatsappLine: 'A short founder-led offer is live now. Use the code at checkout if anything has been waiting in your mind.',
    rationale: [
      `Built for ${mode === 'bulk' ? 'multi-partner distribution' : 'controlled single-code distribution'}.`,
      `There are currently ${activeCodes} active generic campaign code(s) in the system.`,
      'Kept the offer commercially restrained so it supports conversion without cheapening the craft signal.',
    ],
  };
}

function normalizePlan(candidate: any, fallback: CampaignPlan): CampaignPlan {
  const type = ['PERCENT', 'FLAT', 'FREE_SHIPPING'].includes(candidate?.type) ? candidate.type : fallback.type;
  const mode = candidate?.recommendedMode === 'bulk' ? 'bulk' : 'single';

  const value =
    type === 'FREE_SHIPPING'
      ? 0
      : Math.max(1, Math.min(type === 'PERCENT' ? 80 : 50000, Number(candidate?.value || fallback.value)));

  const minCart = Math.max(0, Math.min(500000, Number(candidate?.minCart || fallback.minCart)));
  const maxDiscountRaw = candidate?.maxDiscount === null || candidate?.maxDiscount === '' ? null : Number(candidate?.maxDiscount || fallback.maxDiscount || 0);
  const maxDiscount = maxDiscountRaw === null ? null : Math.max(0, Math.min(500000, maxDiscountRaw));
  const maxUsesRaw = candidate?.maxUses === null || candidate?.maxUses === '' ? null : Number(candidate?.maxUses || fallback.maxUses || 0);
  const maxUses = maxUsesRaw === null ? null : Math.max(1, Math.min(100000, maxUsesRaw));

  return {
    campaignName: String(candidate?.campaignName || fallback.campaignName).trim().slice(0, 80),
    strategy: String(candidate?.strategy || fallback.strategy).trim().slice(0, 320),
    recommendedMode: mode,
    code: safeCodeWord(String(candidate?.code || fallback.code)).slice(0, 16),
    prefix: safeCodeWord(String(candidate?.prefix || fallback.prefix)).slice(0, 12),
    type,
    value,
    minCart,
    maxDiscount,
    maxUses,
    perUserOnce: candidate?.perUserOnce === false ? false : true,
    validDays: Math.max(1, Math.min(90, Number(candidate?.validDays || fallback.validDays))),
    headline: String(candidate?.headline || fallback.headline).trim().slice(0, 120),
    description: String(candidate?.description || fallback.description).trim().slice(0, 240),
    emailSubject: String(candidate?.emailSubject || fallback.emailSubject).trim().slice(0, 120),
    instagramCaption: String(candidate?.instagramCaption || fallback.instagramCaption).trim().slice(0, 500),
    whatsappLine: String(candidate?.whatsappLine || fallback.whatsappLine).trim().slice(0, 240),
    rationale: Array.isArray(candidate?.rationale)
      ? candidate.rationale.slice(0, 6).map((item: any) => String(item))
      : fallback.rationale,
  };
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !ALLOWED.includes(session.role as any)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const objective = String(body?.objective || '').trim();
    const coupons = Array.isArray(body?.coupons) ? body.coupons : [];

    if (!objective) {
      return NextResponse.json({ error: 'Objective required' }, { status: 400 });
    }

    const fallback = deterministicPlan(objective, coupons);

    if (!aiTextConfigured()) {
      return NextResponse.json({
        ok: true,
        configured: false,
        plan: fallback,
      });
    }

    const system = `You are NEEJEE's campaign strategist.
Return strict JSON only.
Brand voice: founder-led, quiet confidence, Indian craft specific, never shouty.
Avoid: luxurious, premium, exquisite, emojis, cheap-sale language, all-caps urgency.
You are planning a generic coupon campaign, not a product/catalog rewrite.

Return exactly:
{
  "campaignName": "...",
  "strategy": "...",
  "recommendedMode": "single" or "bulk",
  "code": "...",
  "prefix": "...",
  "type": "PERCENT" or "FLAT" or "FREE_SHIPPING",
  "value": 0,
  "minCart": 0,
  "maxDiscount": 0 or null,
  "maxUses": 0 or null,
  "perUserOnce": true,
  "validDays": 14,
  "headline": "...",
  "description": "...",
  "emailSubject": "...",
  "instagramCaption": "...",
  "whatsappLine": "...",
  "rationale": ["...", "...", "..."]
}

Rules:
- code and prefix must be uppercase alphanumeric only.
- If type=PERCENT, value is an integer percent.
- If type=FLAT, value/minCart/maxDiscount are integer rupees.
- If type=FREE_SHIPPING, set value=0 and maxDiscount=null.
- Keep validDays between 1 and 90.
- Keep the offer commercially sensible.`;

    const userMessage = `Objective:
${objective}

Existing campaign snapshot:
${JSON.stringify(coupons, null, 2)}

Return the final plan now.`;

    const ai = await openaiChat({
      system,
      messages: [{ role: 'user', content: userMessage }],
      temperature: 0.35,
      jsonMode: true,
    });

    if (!ai.ok) {
      return NextResponse.json({ error: ai.error || 'AI planning failed' }, { status: 500 });
    }

    const normalized = normalizePlan(ai.json || {}, fallback);

    return NextResponse.json({
      ok: true,
      configured: true,
      plan: normalized,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'AI planning failed' }, { status: 500 });
  }
}