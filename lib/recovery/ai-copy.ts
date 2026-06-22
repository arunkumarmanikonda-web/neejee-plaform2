// lib/recovery/ai-copy.ts
// v26.3a — Generates poetic, Neejee-voice recovery email copy.
// Calls OpenAI; falls back to a templated voice if AI is unavailable.
//
// Inputs: cart snapshot (items with craft/region), customer name, stage (1/2/3).
// Outputs: { subject, lede, body, signoff, itemHook } — all strings.
//
// Brand voice rules (locked in the system prompt below):
//   - Heritage Indian crafts, slow-luxury, poetic, intimate
//   - Light Hindi/Urdu loanwords where natural (atelier, karigar, dupatta, mehfil)
//   - Forbidden: "Hey!", "Don't miss out!", countdown timers, OMG, ALL CAPS
//   - Permitted: "trunk", "loom remembers", "the karigar's hand"
//
// Cache: each call writes back to AbandonedCart.aiCopyJson (caller's job).
// Fallback: defer 15 min once via cron (caller's job); if 2nd attempt also
// fails, this module returns the deterministic fallback copy.

export interface AICopyInput {
  customerName: string | null | undefined;
  items: Array<{ name: string; craft?: string | null; region?: string | null; quantity: number }>;
  stage: 1 | 2 | 3;            // 1=T+1h, 2=T+24h, 3=T+72h
  discountPercent?: number;    // for stages 2 and 3
  discountCode?: string;       // for stages 2 and 3
  totalRupees: number;
}

export interface AICopyOutput {
  subject: string;
  lede: string;        // 1-2 sentences, opens the email
  body: string;        // 2-3 short paragraphs
  signoff: string;     // short closing line
  itemHook: string;    // a poetic 1-line reference to one specific cart item
  generatedBy: 'ai' | 'fallback';
  generatedAt: string;
}

const BRAND_SYSTEM_PROMPT = `You write email copy for NEEJEE, a heritage Indian crafts atelier.
Voice: poetic, intimate, slow-luxury, never pushy, never desperate.
Permitted vocabulary: trunk, loom, karigar, atelier, dupatta, mehfil, weave, thread.
Forbidden: "Hey!", "Don't miss out", countdown urgency, OMG, ALL CAPS, exclamation overuse.
Length: subjects ≤ 8 words, ledes ≤ 30 words, body paragraphs ≤ 60 words each.
Tone reference: a handwritten note from an artisan, not a marketing email.
Always reference ONE specific item from the cart by craft+region (e.g., "your Banarasi from Varanasi").
Output strictly valid JSON. No prose around the JSON.`;

function stagePrompt(input: AICopyInput): string {
  const itemList = input.items.slice(0, 3).map(i =>
    `${i.quantity}× ${i.name}${i.craft ? ` (${i.craft})` : ''}${i.region ? ` from ${i.region}` : ''}`
  ).join(', ');

  const name = input.customerName || 'friend';

  if (input.stage === 1) {
    return `Write a T+1h gentle nudge email for ${name}.
Cart items: ${itemList}.
Cart total: ₹${input.totalRupees.toLocaleString('en-IN')}.
NO discount. Just a warm reminder that their trunk is waiting.
Reference one specific item poetically.
Return JSON with keys: subject, lede, body, signoff, itemHook.`;
  }

  if (input.stage === 2) {
    return `Write a T+24h gift-offer email for ${name}.
Cart items: ${itemList}.
Cart total: ₹${input.totalRupees.toLocaleString('en-IN')}.
Offer a ${input.discountPercent}% gift from our karigars using code ${input.discountCode}.
Frame the discount as a small gesture, NOT a sales tactic.
Reference one specific item with a sensory detail (texture, weave, place of origin).
Return JSON with keys: subject, lede, body, signoff, itemHook.`;
  }

  // stage 3
  return `Write a T+72h final gentle reminder for ${name}.
Cart items: ${itemList}.
Cart total: ₹${input.totalRupees.toLocaleString('en-IN')}.
Offer a ${input.discountPercent}% farewell gift using code ${input.discountCode}.
Tone: gentle finality, "before the loom rests". No urgency, no pressure.
Reference one specific item with a story-led line about its making.
Return JSON with keys: subject, lede, body, signoff, itemHook.`;
}

function fallbackCopy(input: AICopyInput): AICopyOutput {
  const name = input.customerName?.split(' ')[0] || 'friend';
  const firstItem = input.items[0];
  const itemDesc = firstItem
    ? `your ${firstItem.craft || firstItem.name}${firstItem.region ? ` from ${firstItem.region}` : ''}`
    : 'your trunk';

  if (input.stage === 1) {
    return {
      subject: `Your trunk waits in our atelier`,
      lede: `Dear ${name}, ${itemDesc} is still resting on the table where you left it.`,
      body: `No rush, no urgency — only the quiet hum of the loom in the next room. We thought you might like to come back when the moment feels right.\n\nYour selections are kept safe, exactly as you arranged them.`,
      signoff: `With warmth from the karigars,\nThe NEEJEE atelier`,
      itemHook: `${itemDesc} remembers your hand.`,
      generatedBy: 'fallback',
      generatedAt: new Date().toISOString(),
    };
  }

  if (input.stage === 2) {
    return {
      subject: `A small gift from our karigars`,
      lede: `Dear ${name}, the artisans behind ${itemDesc} would like to send you a small gesture — ${input.discountPercent}% off, with code ${input.discountCode}.`,
      body: `Each piece in your trunk took days of slow work — threads counted by hand, motifs drawn from memory.\n\nIf the price was holding you back, please accept this with our thanks. The code rests in your trunk until tomorrow evening.`,
      signoff: `With warmth from the loom,\nThe NEEJEE atelier`,
      itemHook: `${itemDesc} was waiting to travel home with you.`,
      generatedBy: 'fallback',
      generatedAt: new Date().toISOString(),
    };
  }

  return {
    subject: `Before the loom rests`,
    lede: `Dear ${name}, a last gentle note about ${itemDesc} — a ${input.discountPercent}% farewell gift, with code ${input.discountCode}.`,
    body: `We don't believe in pressing — only in remembering. Your trunk has stayed warm these last few days, but soon the karigars will return your pieces to the shelves.\n\nIf the moment is right, the door is open. If not, we'll be here when it is.`,
    signoff: `With quiet gratitude,\nThe NEEJEE atelier`,
    itemHook: `${itemDesc} carries five generations of hands.`,
    generatedBy: 'fallback',
    generatedAt: new Date().toISOString(),
  };
}

export async function generateRecoveryCopy(input: AICopyInput): Promise<AICopyOutput> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    console.warn('[recovery.ai] No OPENAI_API_KEY — using fallback copy');
    return fallbackCopy(input);
  }

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.8,
        max_tokens: 600,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: BRAND_SYSTEM_PROMPT },
          { role: 'user', content: stagePrompt(input) },
        ],
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn('[recovery.ai] OpenAI error:', res.status, errText.slice(0, 200));
      return fallbackCopy(input);
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      console.warn('[recovery.ai] OpenAI empty response');
      return fallbackCopy(input);
    }

    const parsed = JSON.parse(content);
    return {
      subject: String(parsed.subject || '').slice(0, 120),
      lede: String(parsed.lede || '').slice(0, 300),
      body: String(parsed.body || '').slice(0, 1200),
      signoff: String(parsed.signoff || 'With warmth,\nThe NEEJEE atelier').slice(0, 200),
      itemHook: String(parsed.itemHook || '').slice(0, 200),
      generatedBy: 'ai',
      generatedAt: new Date().toISOString(),
    };
  } catch (e: any) {
    console.warn('[recovery.ai] exception:', e?.message);
    return fallbackCopy(input);
  }
}
