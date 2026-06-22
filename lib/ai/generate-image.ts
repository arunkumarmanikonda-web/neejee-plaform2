// v23.40.22 — Generic AI image generator used across CMS, banners, lookbooks, page covers.
//
// Supports three model paths:
//   • nano-banana-pro  — fal-ai/nano-banana-pro (text-to-image; high quality, slow ~30s)
//   • flux-schnell     — fal-ai/flux/schnell    (fast, square output ~5s)
//   • flux-kontext     — fal-ai/flux-pro/kontext/max/multi (image-edit-by-reference)
//
// After generation, optionally re-hosts the output on Supabase for a permanent URL
// (fal.ai URLs expire). Returns the permanent URL.

import { falRun } from '@/lib/ai';
import { uploadFile, storageConfigured, makeUploadPath } from '@/lib/storage';

export type AspectRatio =
  | '1:1' | '4:3' | '3:4' | '16:9' | '9:16' | '21:9' | '3:2' | '2:3' | '4:5' | '5:4';

export type ImageGenModel = 'nano-banana-pro' | 'flux-schnell' | 'flux-kontext';

export interface GenerateImageArgs {
  prompt: string;
  model?: ImageGenModel;
  aspectRatio?: AspectRatio;
  // For flux-kontext (image edit by reference)
  referenceImageUrls?: string[];
  // Where to store final image inside Supabase (e.g., 'cms/hero', 'banners/hero', 'lookbook')
  folder?: string;
  filenameHint?: string;
}

export interface GenerateImageResult {
  ok: boolean;
  imageUrl?: string;        // permanent (re-hosted) or fal-ephemeral if storage missing
  rawUrl?: string;          // original fal URL (for debugging)
  model?: ImageGenModel;
  error?: string;
}

const FAL_ASPECT_TO_NANO: Record<AspectRatio, string> = {
  '1:1':  '1:1',
  '4:3':  '4:3',
  '3:4':  '3:4',
  '16:9': '16:9',
  '9:16': '9:16',
  '21:9': '21:9',
  '3:2':  '3:2',
  '2:3':  '2:3',
  '4:5':  '4:5',
  '5:4':  '5:4',
};

const FAL_ASPECT_TO_FLUX: Record<AspectRatio, string> = {
  '1:1':  'square_hd',
  '4:3':  'landscape_4_3',
  '3:4':  'portrait_4_3',
  '16:9': 'landscape_16_9',
  '9:16': 'portrait_16_9',
  '21:9': 'landscape_16_9',
  '3:2':  'landscape_4_3',
  '2:3':  'portrait_4_3',
  '4:5':  'portrait_4_3',
  '5:4':  'landscape_4_3',
};

export async function generateAiImage(args: GenerateImageArgs): Promise<GenerateImageResult> {
  const prompt = (args.prompt || '').trim();
  if (!prompt) return { ok: false, error: 'prompt is required' };

  const model: ImageGenModel = args.model
    || (args.referenceImageUrls?.length ? 'flux-kontext' : 'nano-banana-pro');

  const aspect = args.aspectRatio || '16:9';

  let endpoint: string;
  let input: Record<string, any>;

  if (model === 'flux-kontext') {
    if (!args.referenceImageUrls?.length) {
      return { ok: false, error: 'flux-kontext requires referenceImageUrls' };
    }
    endpoint = 'fal-ai/flux-pro/kontext/max/multi';
    input = {
      prompt,
      image_urls: args.referenceImageUrls.slice(0, 4),
      aspect_ratio: aspect,
      num_images: 1,
      safety_tolerance: '5',
    };
  } else if (model === 'flux-schnell') {
    endpoint = 'fal-ai/flux/schnell';
    input = {
      prompt,
      image_size: FAL_ASPECT_TO_FLUX[aspect] || 'landscape_16_9',
      num_inference_steps: 4,
      num_images: 1,
      enable_safety_checker: false,
    };
  } else {
    // nano-banana-pro (default)
    endpoint = 'fal-ai/nano-banana-pro';
    input = {
      prompt,
      aspect_ratio: FAL_ASPECT_TO_NANO[aspect] || '16:9',
      num_images: 1,
      output_format: 'jpeg',
    };
  }

  const result = await falRun({ endpoint, input, timeoutMs: 120_000 });
  if (!result.ok || !result.data) {
    return { ok: false, model, error: result.error || 'fal generation failed' };
  }

  // Extract image URL from fal response (different models return different shapes)
  const data = result.data;
  const rawUrl: string | undefined =
       data?.images?.[0]?.url
    || data?.image?.url
    || data?.output?.[0]
    || data?.output
    || (typeof data?.image === 'string' ? data.image : undefined);

  if (!rawUrl) {
    return { ok: false, model, error: 'fal completed but no image URL in response' };
  }

  // Re-host on Supabase for a permanent URL
  let finalUrl = rawUrl;
  if (storageConfigured()) {
    try {
      const fetched = await fetch(rawUrl);
      if (fetched.ok) {
        const buf = Buffer.from(await fetched.arrayBuffer());
        const ct = fetched.headers.get('content-type') || 'image/jpeg';
        const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : 'jpg';
        const folder = args.folder || 'ai-generated';
        const hint = args.filenameHint || 'image';
        const path = makeUploadPath(folder, `${hint}-${Date.now()}.${ext}`);
        const up = await uploadFile(path, buf, ct);
        finalUrl = up.url;
      }
    } catch (e) {
      // fall back to ephemeral fal URL
    }
  }

  return { ok: true, imageUrl: finalUrl, rawUrl, model };
}
