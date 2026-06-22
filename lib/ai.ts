// Centralised AI integrations with safe fallbacks.
//
// Try-on: uses fal.ai's FASHN v1.5 (commercial-licensed) by default.
//   Set FAL_KEY in env to activate.
//
// Room placement: uses fal.ai's image editing models (flux Kontext / nano-banana).
//   Same FAL_KEY.
//
// Text (Gift Concierge + Content Assistant): uses OpenAI.
//   Set OPENAI_API_KEY in env to activate.

export function aiImageConfigured(): boolean {
  return Boolean(process.env.FAL_KEY || process.env.REPLICATE_API_TOKEN);
}

export function aiMirrorConfigured(): boolean {
  return aiImageConfigured();
}

export function aiTextConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

// ───────────────────── fal.ai queue helper ─────────────────────
// Submits a job, polls until complete, returns the response data.

const FAL_BASE = 'https://queue.fal.run';

interface FalRunArgs {
  endpoint: string;        // e.g. "fal-ai/fashn/tryon/v1.5"
  input: Record<string, any>;
  timeoutMs?: number;      // total wait
}

export async function falRun({ endpoint, input, timeoutMs = 90_000 }: FalRunArgs): Promise<{ ok: boolean; data?: any; error?: string }> {
  const key = process.env.FAL_KEY;
  if (!key) return { ok: false, error: 'FAL_KEY not set' };

  try {
    // 1. Submit
    const submit = await fetch(`${FAL_BASE}/${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: `Key ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });
    const submitData = await submit.json();
    if (!submit.ok) {
      return { ok: false, error: submitData?.detail || submitData?.error || `fal submit failed (${submit.status})` };
    }

    const requestId: string | undefined = submitData.request_id;
    if (!requestId) {
      // Some endpoints return the result synchronously
      if (submitData.images || submitData.image || submitData.output) {
        return { ok: true, data: submitData };
      }
      return { ok: false, error: 'fal returned no request_id' };
    }

    // 2. Poll until complete
    const startedAt = Date.now();
    const statusUrl = submitData.status_url || `${FAL_BASE}/${endpoint}/requests/${requestId}/status`;

    while (Date.now() - startedAt < timeoutMs) {
      await new Promise(r => setTimeout(r, 2000));
      const sRes = await fetch(statusUrl, { headers: { Authorization: `Key ${key}` } });
      const sJson = await sRes.json().catch(() => ({}));
      const status = sJson.status as string | undefined;
      if (status === 'COMPLETED') {
        const resultUrl = sJson.response_url || submitData.response_url || `${FAL_BASE}/${endpoint}/requests/${requestId}`;
        const rRes = await fetch(resultUrl, { headers: { Authorization: `Key ${key}` } });
        const rJson = await rRes.json().catch(() => ({}));
        // fal sometimes marks a request COMPLETED but the body is actually an error envelope.
        // Detect this and surface the message instead of treating empty `detail` as success.
        if (!rJson.images && !rJson.image && !rJson.output && (rJson.detail || rJson.error || rJson.message)) {
          const detail = typeof rJson.detail === 'string'
            ? rJson.detail
            : (Array.isArray(rJson.detail) ? rJson.detail.map((d: any) => d?.msg || JSON.stringify(d)).join('; ') : JSON.stringify(rJson.detail));
          console.error('[falRun] COMPLETED but error envelope:', JSON.stringify(rJson).slice(0, 500));
          return { ok: false, error: detail || rJson.error || rJson.message || 'fal returned an error envelope' };
        }
        return { ok: true, data: rJson };
      }
      if (status === 'FAILED' || status === 'CANCELED') {
        return { ok: false, error: sJson.error || `fal request ${status}` };
      }
      // IN_QUEUE / IN_PROGRESS → keep polling
    }
    return { ok: false, error: 'fal generation timed out' };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

// ───────────────────── Virtual try-on ─────────────────────
// Returns the first generated image URL.

export async function virtualTryOn(personImageUrl: string, garmentImageUrl: string, _garmentType: string = 'auto'): Promise<{ ok: boolean; outputUrl?: string; error?: string }> {
  // Use 'performance' mode + 50s timeout to fit inside Vercel Hobby's 60s function limit
  const r = await falRun({
    endpoint: 'fal-ai/fashn/tryon/v1.5',
    input: {
      model_image: personImageUrl,
      garment_image: garmentImageUrl,
      category: 'auto',
      mode: 'performance',      // faster than 'balanced' to fit Vercel timeout
      garment_photo_type: 'auto',
      moderation_level: 'permissive',
      num_samples: 1,
      segmentation_free: true,
      output_format: 'jpeg',
    },
    timeoutMs: 50_000,
  });
  if (!r.ok) return { ok: false, error: r.error };
  const url: string | undefined = r.data?.images?.[0]?.url || r.data?.image?.url;
  if (!url) return { ok: false, error: 'fal returned no image URL' };
  return { ok: true, outputUrl: url };
}

// ───────────────────── Async submit + poll for try-on ─────────────────────
// These split virtualTryOn into submit (fast) + status-check (per-poll),
// so the client can poll past Vercel's 60s function limit without timing out.

const TRYON_ENDPOINT = 'fal-ai/fashn/tryon/v1.5';

export async function falSubmitTryOn(
  personImageUrl: string,
  garmentImageUrl: string,
  _garmentType: string = 'auto'
): Promise<{ ok: boolean; requestId?: string; endpoint?: string; statusUrl?: string; responseUrl?: string; error?: string }> {
  const key = process.env.FAL_KEY;
  if (!key) return { ok: false, error: 'FAL_KEY not set' };
  try {
    const submit = await fetch(`${FAL_BASE}/${TRYON_ENDPOINT}`, {
      method: 'POST',
      headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model_image: personImageUrl,
        garment_image: garmentImageUrl,
        category: 'auto',
        mode: 'performance',
        garment_photo_type: 'auto',
        moderation_level: 'permissive',
        num_samples: 1,
        segmentation_free: true,
        output_format: 'jpeg',
      }),
    });
    const data = await submit.json().catch(() => ({}));
    if (!submit.ok) {
      return { ok: false, error: data?.detail || data?.error || `fal submit failed (${submit.status})` };
    }
    const requestId: string | undefined = data.request_id;
    if (!requestId) {
      return { ok: false, error: 'fal returned no request_id' };
    }
    return {
      ok: true,
      requestId,
      endpoint: TRYON_ENDPOINT,
      statusUrl: data.status_url,
      responseUrl: data.response_url,
    };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export async function falStatusCheck(
  endpoint: string,
  requestId: string
): Promise<{ ok: boolean; status?: string; outputUrl?: string; error?: string }> {
  const key = process.env.FAL_KEY;
  if (!key) return { ok: false, error: 'FAL_KEY not set' };
  try {
    // Per fal.ai queue docs:
    //   status URL: https://queue.fal.run/{endpoint}/requests/{id}/status
    //   result URL: https://queue.fal.run/{endpoint}/requests/{id}        (NB: NO /response suffix in current docs sample)
    // We try the documented response shape and fall back gracefully.
    const statusUrl = `${FAL_BASE}/${endpoint}/requests/${requestId}/status`;
    const sRes = await fetch(statusUrl, { headers: { Authorization: `Key ${key}` } });
    const sJson = await sRes.json().catch(() => ({}));
    const status = sJson.status as string | undefined;

    if (status === 'COMPLETED') {
      // Prefer the response_url returned by fal (most reliable). Fall back to constructed URL.
      const resultUrl: string = sJson.response_url || `${FAL_BASE}/${endpoint}/requests/${requestId}`;
      const rRes = await fetch(resultUrl, { headers: { Authorization: `Key ${key}` } });
      const rJson = await rRes.json().catch(() => ({}));
      const url: string | undefined =
        rJson?.images?.[0]?.url ||
        rJson?.image?.url ||
        rJson?.output?.images?.[0]?.url ||
        rJson?.output_url;
      if (!url) {
        console.warn('[falStatusCheck] COMPLETED but no image URL. rJson keys:', Object.keys(rJson || {}));
        return { ok: false, error: 'fal completed but returned no image URL', status };
      }
      return { ok: true, status, outputUrl: url };
    }
    if (status === 'FAILED' || status === 'CANCELED') {
      return { ok: true, status, error: sJson.error || `fal request ${status}` };
    }
    return { ok: true, status: status || 'IN_PROGRESS' };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

// ───────────────────── Place artefact in a room ─────────────────────
// Uses fal-ai/flux-pro/kontext (image edit by reference + prompt).

export async function placeInRoom(roomImageUrl: string, productImageUrl: string, productDescription: string): Promise<{ ok: boolean; outputUrl?: string; error?: string }> {
  const prompt = `Place this ${productDescription} naturally in the scene with matching perspective, lighting, and shadows. Keep the room and decor untouched.`;
  const r = await falRun({
    endpoint: 'fal-ai/flux-pro/kontext/max/multi',
    input: {
      prompt,
      image_urls: [roomImageUrl, productImageUrl],
      // Rooms photos are usually landscape, 16:9 is the closest valid value.
      // Valid: '21:9'|'16:9'|'4:3'|'3:2'|'1:1'|'2:3'|'3:4'|'9:16'|'9:21'
      aspect_ratio: '16:9',
      guidance_scale: 3.5,
      num_images: 1,
      output_format: 'jpeg',
      safety_tolerance: '6',
    },
    timeoutMs: 90_000,
  });
  if (!r.ok) return { ok: false, error: r.error };
  const url: string | undefined = r.data?.images?.[0]?.url;
  if (!url) return { ok: false, error: 'fal returned no image URL' };
  return { ok: true, outputUrl: url };
}

// ───────────────────── OpenAI chat ─────────────────────

interface ChatArgs {
  system: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  model?: string;
  temperature?: number;
  jsonMode?: boolean;
}

export async function openaiChat({ system, messages, model = 'gpt-4o-mini', temperature = 0.7, jsonMode = false }: ChatArgs): Promise<{ ok: boolean; text?: string; json?: any; error?: string }> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { ok: false, error: 'OPENAI_API_KEY not set' };

  try {
    const body: any = {
      model,
      messages: [{ role: 'system', content: system }, ...messages],
      temperature,
    };
    if (jsonMode) body.response_format = { type: 'json_object' };

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error?.message || 'OpenAI request failed' };
    const text = data.choices?.[0]?.message?.content || '';
    if (jsonMode) {
      try {
        return { ok: true, json: JSON.parse(text), text };
      } catch {
        return { ok: false, error: 'Could not parse JSON from model' };
      }
    }
    return { ok: true, text };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

// ───────────────────── Vintage Thappa Seal Generation ─────────────────────
// Generates a circular hand-stamped wax seal PNG in the NEEJEE brand palette
// (Madder Red #8B2E2A on Ivory Cotton #F4EFE6 with Banarasi Antique Gold
// accents). Uses fal-ai flux/schnell — fast, square output, transparent-feel.
//
// The model receives the badge LABEL and a tightly-art-directed prompt so
// every generated seal carries the NEEJEE visual DNA (Thappa Seal aesthetic,
// 19th-century Indian letterpress serif, restrained ornament).

export async function generateThappaSeal(label: string): Promise<{
  ok: boolean;
  outputUrl?: string;
  error?: string;
}> {
  const key = process.env.FAL_KEY;
  if (!key) return { ok: false, error: 'FAL_KEY not configured' };

  const cleanLabel = label.trim().toUpperCase().slice(0, 28);

  // Prompt engineered for the NEEJEE Brand Book aesthetic:
  // Thappa seal, Madder Red on Ivory Cotton, ornate but restrained,
  // hand-pressed wax / letterpress feel, 19th-century Indian motifs.
  const prompt = [
    `A vintage Indian hand-pressed wax seal, perfectly circular, centered on a plain ivory cotton-textured background (#F4EFE6).`,
    `The seal is deep madder red ink (#8B2E2A) with subtle Banarasi antique gold (#B8923B) hairline accents at the edge.`,
    `Inside the circle, the text "${cleanLabel}" is set in an elegant 19th-century Indian letterpress serif, embossed, slightly distressed as if pressed by hand.`,
    `Around the inner edge, a fine ornamental Indian motif border — restrained, paisley-and-dot pattern, not busy.`,
    `A single tiny madder red bindi dot ornament beneath the text.`,
    `Hand-stamped texture, very slight ink bleed at edges, paper grain visible.`,
    `Style: artisanal, archival, museum-quality certification seal. No background scene. No people. No modern gradients. No drop shadows. Flat, printed, like a thappa pressed onto khadi paper.`,
    `Square composition, seal fills 80% of frame, generous ivory margin.`,
  ].join(' ');

  try {
    // Submit job
    const submitRes = await fetch(`${FAL_BASE}/fal-ai/flux/schnell`, {
      method: 'POST',
      headers: {
        Authorization: `Key ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        image_size: 'square_hd',
        num_inference_steps: 4,
        num_images: 1,
        enable_safety_checker: false,
      }),
    });
    if (!submitRes.ok) {
      const txt = await submitRes.text().catch(() => '');
      return { ok: false, error: `fal submit failed (${submitRes.status}): ${txt.slice(0, 200)}` };
    }
    const submitData = await submitRes.json();
    const requestId: string | undefined = submitData?.request_id;
    const responseUrlFromFal: string | undefined = submitData?.response_url;
    if (!requestId) return { ok: false, error: 'fal submit returned no request_id' };

    // Poll for up to 60s (flux/schnell typically completes in 3-8s)
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 2000));
      const statusUrl = `${FAL_BASE}/fal-ai/flux/schnell/requests/${requestId}/status`;
      const sRes = await fetch(statusUrl, {
        headers: { Authorization: `Key ${key}` },
      });
      if (!sRes.ok) continue;
      const sJson = await sRes.json();
      const status = sJson?.status;
      if (status === 'COMPLETED') {
        const resultUrl = sJson.response_url || responseUrlFromFal ||
          `${FAL_BASE}/fal-ai/flux/schnell/requests/${requestId}`;
        const rRes = await fetch(resultUrl, {
          headers: { Authorization: `Key ${key}` },
        });
        const rJson = await rRes.json();
        const imageUrl: string | undefined =
          rJson?.images?.[0]?.url || rJson?.image?.url;
        if (!imageUrl) return { ok: false, error: 'fal completed but no image URL' };
        return { ok: true, outputUrl: imageUrl };
      }
      if (status === 'FAILED' || status === 'CANCELED') {
        return { ok: false, error: `fal seal generation ${status}` };
      }
    }
    return { ok: false, error: 'fal seal generation timed out after 60s' };
  } catch (e: any) {
    return { ok: false, error: e.message || 'unknown error generating seal' };
  }
}

// ───────────────────── Jewellery AR Try-On (static AI) ─────────────────────
// Composites a jewellery piece (earrings / necklace / bangle / ring) onto a
// user portrait. Uses fal-ai/flux-pro/kontext/max/multi — the same multi-image
// edit-by-reference model as Place-in-Room. The art direction shifts per
// jewellery type so the model places the piece at the anatomically correct
// position (earlobe, neckline, wrist, finger).

export type JewelleryType = 'earrings' | 'necklace' | 'bangle' | 'ring' | 'auto';

export async function jewelleryTryOn(
  personImageUrl: string,
  jewelleryImageUrl: string,
  jewelleryType: JewelleryType,
  productName: string
): Promise<{ ok: boolean; outputUrl?: string; error?: string }> {

  const placementPrompts: Record<Exclude<JewelleryType, 'auto'>, string> = {
    earrings: `Place these ${productName} earrings on the person in image 1, hanging naturally from both earlobes. Keep the person's face, hair, skin tone, and clothing completely unchanged. The earrings should match the perspective and lighting of the portrait. Render the earrings with realistic shadow, sparkle, and shimmer on metal/stones. Both earlobes must show identical matching earrings. High-detail photographic quality.`,
    necklace: `Place this ${productName} necklace on the person in image 1, sitting naturally on the collarbone and neckline. Keep the person's face, hair, skin tone, and clothing completely unchanged. The necklace should drape with realistic gravity, curve around the neck, and match the lighting and perspective of the portrait. Show the chain or strands clearly. High-detail photographic quality.`,
    bangle: `Place this ${productName} bangle on the person's wrist in image 1. If a wrist is not visible in the portrait, place the bangle on their right wrist near the bottom edge of the frame, with the bangle clearly visible. Keep the person, face, hair, skin tone, and clothing unchanged. The bangle should match perspective and lighting. High-detail photographic quality.`,
    ring: `Place this ${productName} ring on the person's ring finger in image 1. If a hand is not visible, place a hand wearing the ring in the lower portion of the frame. Keep the person, face, hair, skin tone, and clothing completely unchanged. The ring should be photographed with realistic metal shine and stone detail. High-detail photographic quality.`,
  };

  const type = (jewelleryType === 'auto' ? 'necklace' : jewelleryType) as Exclude<JewelleryType, 'auto'>;
  const prompt = placementPrompts[type];

  const r = await falRun({
    endpoint: 'fal-ai/flux-pro/kontext/max/multi',
    input: {
      prompt,
      image_urls: [personImageUrl, jewelleryImageUrl],
      // Portrait selfies are typically 3:4 or 9:16. Use 3:4 — the closest valid value
      // to a typical portrait crop. (Valid values: '21:9'|'16:9'|'4:3'|'3:2'|'1:1'|'2:3'|'3:4'|'9:16'|'9:21')
      aspect_ratio: '3:4',
      guidance_scale: 3.5,
      num_images: 1,
      output_format: 'jpeg',
      safety_tolerance: '6',
    },
    timeoutMs: 120_000,
  });
  if (!r.ok) return { ok: false, error: r.error };

  // fal-ai/flux-pro/kontext/max/multi returns { images: [{ url, content_type }], seed, has_nsfw_concepts, prompt }
  // Exhaustive fallback parsing for shape drift across model versions.
  const d = r.data;
  console.log('[jewelleryTryOn] fal response keys:', Object.keys(d || {}), 'images count:', d?.images?.length);

  // Check NSFW flag explicitly — most common cause of empty images array
  if (Array.isArray(d?.has_nsfw_concepts) && d.has_nsfw_concepts[0] === true) {
    return { ok: false, error: 'The AI safety filter flagged this result. Try a different portrait — face-forward, well-lit, neutral expression works best.' };
  }

  const firstImage = d?.images?.[0];
  const url: string | undefined =
    (typeof firstImage === 'object' ? firstImage?.url : firstImage) ||
    d?.image?.url ||
    d?.output?.images?.[0]?.url ||
    d?.output?.image?.url ||
    d?.result?.images?.[0]?.url ||
    (typeof d?.output === 'string' ? d.output : undefined) ||
    d?.url;

  if (!url) {
    console.warn('[jewelleryTryOn] No image URL. Full response sample:', JSON.stringify(d).slice(0, 800));
    return {
      ok: false,
      error: `AI completed but returned no usable image. The fal response shape was unexpected (keys: ${Object.keys(d || {}).join(', ')}). Try again — if this persists, the model may be temporarily down.`,
    };
  }
  return { ok: true, outputUrl: url };
}

/** Detect jewellery type from category name + product name. */
export function detectJewelleryType(categoryName: string, productName: string, craft?: string | null): JewelleryType {
  const s = `${categoryName} ${productName} ${craft || ''}`.toLowerCase();
  if (/\b(earring|jhumka|jhumki|kaan|kundal)\b/.test(s)) return 'earrings';
  if (/\b(necklace|haar|maala|mala|choker|rani|polki set)\b/.test(s)) return 'necklace';
  if (/\b(bangle|bracelet|kada|kangan|chooda)\b/.test(s)) return 'bangle';
  if (/\b(ring|anguthi)\b/.test(s)) return 'ring';
  // Default: necklace usually works best for unidentified jewellery on portraits
  return 'necklace';
}
