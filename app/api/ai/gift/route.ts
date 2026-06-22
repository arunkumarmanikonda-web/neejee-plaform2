// AI Gift Concierge — conversational helper that recommends pieces based on recipient profile.
// Returns 3-6 product recommendations from the live catalog.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { aiTextConfigured, openaiChat } from '@/lib/ai';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

interface GiftBrief {
  recipient: string;
  occasion?: string;
  relationship?: string;
  recipientStyle?: string;
  productType?: string;       // 'Any' | 'Saree' | 'Jewellery' | 'Kurta / Menswear' | 'Home' | 'Fragrance' | 'Accessories' | 'Gift Hampers'
  budgetMin?: number;
  budgetMax?: number;
  notes?: string;
}

// Map UI product-type to catalogue keywords (used to pre-filter)
const TYPE_KEYWORDS: Record<string, string[]> = {
  'Saree': ['saree', 'sari', 'dupatta', 'blouse'],
  'Jewellery': ['jhumka', 'bangle', 'necklace', 'earring', 'pendant', 'choker', 'kada', 'maang', 'anklet'],
  'Kurta / Menswear': ['kurta', 'kurti', 'sherwani', 'shawl', 'pocket square', 'mojari', 'jutti'],
  'Home': ['cushion', 'throw', 'rug', 'dhurrie', 'lamp', 'vase', 'planter', 'tray', 'tapestry'],
  'Fragrance': ['attar', 'perfume', 'incense', 'agarbatti', 'dhoop', 'oil'],
  'Accessories': ['bag', 'clutch', 'purse', 'wallet', 'scarf', 'stole', 'belt', 'pouch', 'tote', 'sling'],
  'Gift Hampers': ['gift', 'box', 'hamper', 'set'],
};

export async function POST(request: Request) {
  try {
    const brief: GiftBrief = await request.json();
    if (!brief.recipient) {
      return NextResponse.json({ error: 'Tell us who the gift is for' }, { status: 400 });
    }

    // Fetch a candidate set of products (active, within budget)
    const where: any = { status: 'ACTIVE' };
    if (brief.budgetMin || brief.budgetMax) {
      where.sellingPrice = {};
      if (brief.budgetMin) where.sellingPrice.gte = brief.budgetMin * 100;
      if (brief.budgetMax) where.sellingPrice.lte = brief.budgetMax * 100;
    }
    // Filter by product-type if specified
    if (brief.productType && brief.productType !== 'Any' && TYPE_KEYWORDS[brief.productType]) {
      const kws = TYPE_KEYWORDS[brief.productType];
      where.OR = kws.flatMap(kw => [
        { name: { contains: kw, mode: 'insensitive' as const } },
        { craft: { contains: kw, mode: 'insensitive' as const } },
        { material: { contains: kw, mode: 'insensitive' as const } },
        { category: { name: { contains: kw, mode: 'insensitive' as const } } },
      ]);
    }

    const candidates = await prisma.product.findMany({
      where,
      take: 40,
      select: {
        id: true, slug: true, name: true, craft: true, region: true,
        material: true, occasion: true, story: true,
        sellingPrice: true, salePrice: true, images: true, category: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (candidates.length === 0) {
      return NextResponse.json({
        ok: true,
        configured: aiTextConfigured(),
        message: brief.budgetMax
          ? `Nothing in our trunk under ₹${brief.budgetMax.toLocaleString('en-IN')} just yet.`
          : 'No active pieces match. Try a different brief.',
        recommendations: [],
      });
    }

    // No AI key → return top 6 candidates with a generic note (graceful stub)
    if (!aiTextConfigured()) {
      const picks = candidates.slice(0, 6);
      return NextResponse.json({
        ok: true,
        configured: false,
        message: 'A few personal picks from our trunk that match your budget.',
        recommendations: picks.map(p => ({
          productId: p.id,
          slug: p.slug,
          name: p.name,
          why: `${p.craft || 'Hand-made'} · ${p.region || 'India'} · ₹${(p.sellingPrice / 100).toLocaleString('en-IN')}`,
          image: p.images?.[0],
          pricePaise: p.sellingPrice,
        })),
      });
    }

    // Real recommendation via OpenAI — give it the catalogue, get back ranked IDs + reasoning
    const catalogue = candidates.map(p => ({
      id: p.id,
      name: p.name,
      craft: p.craft,
      region: p.region,
      material: p.material,
      occasion: p.occasion,
      category: p.category?.name,
      pricePaise: p.salePrice || p.sellingPrice,
      story: (p.story || '').slice(0, 200),
    }));

    const system = `You are NEEJEE's Gift Concierge. NEEJEE is a personal Indian craft brand — every piece is signed, hand-made, found not stocked.
Your voice is soft, sincere, never sales-y. You speak from the brand pillar: "Found. Personal." Never use marketplace words.
Pick 3-6 pieces from the supplied catalogue for the brief. Return JSON in this exact shape:
{
  "intro": "<a single warm 2-sentence opener addressed to the giver>",
  "picks": [
    { "id": "<product id from catalogue>", "why": "<1-2 sentences on why this piece for this person>" }
  ]
}
Match by: occasion fit, recipient style, price band, craft significance. Avoid duplicates.`;

    const userMsg = `Brief:
- Recipient: ${brief.recipient}
- Occasion: ${brief.occasion || 'no specific occasion'}
- Their style: ${brief.recipientStyle || 'unspecified'}
- Relationship: ${brief.relationship || 'close'}
- Budget: ${brief.budgetMin ? `₹${brief.budgetMin}` : '—'} to ${brief.budgetMax ? `₹${brief.budgetMax}` : '—'}
- Notes: ${brief.notes || 'none'}

Catalogue (${catalogue.length} items):
${JSON.stringify(catalogue)}`;

    const ai = await openaiChat({
      system,
      messages: [{ role: 'user', content: userMsg }],
      temperature: 0.7,
      jsonMode: true,
    });

    if (!ai.ok || !ai.json) {
      return NextResponse.json({ error: ai.error || 'AI recommendation failed' }, { status: 500 });
    }

    const json = ai.json;
    const lookup = new Map(candidates.map(p => [p.id, p]));
    const picks = (json.picks || []).slice(0, 6).map((p: any) => {
      const prod = lookup.get(p.id);
      if (!prod) return null;
      return {
        productId: prod.id,
        slug: prod.slug,
        name: prod.name,
        why: p.why,
        image: prod.images?.[0],
        pricePaise: prod.salePrice || prod.sellingPrice,
      };
    }).filter(Boolean);

    return NextResponse.json({
      ok: true,
      configured: true,
      intro: json.intro || '',
      message: json.intro || '',
      recommendations: picks,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
