import sharp from 'sharp';

export const openAiStyleAvailable = () => Boolean(process.env.OPENAI_API_KEY?.trim());

export async function makeStyleImage(prompt: string, refs: string[], aspect?: string, fitting = false): Promise<Buffer> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error('openai_unavailable');
  const ratio = aspect?.match(/^(\d{1,2}):(\d{1,2})$/);
  const width = Number(ratio?.[1]);
  const height = Number(ratio?.[2]);
  const size = !width || !height ? 'auto' : width === height ? '1024x1024' : width > height ? '1536x1024' : '1024x1536';
  const endpoint = refs.length ? 'edits' : 'generations';
  const model = process.env.OPENAI_STYLE_IMAGE_MODEL?.trim() || 'gpt-image-1.5';
  const response = await fetch('https://api.openai.com/v1/images/' + endpoint, {
    method: 'POST', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(175000),
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt, ...(refs.length ? { images: refs.map(image_url => ({ image_url })) } : {}),
      n: 1, quality: fitting ? 'high' : 'medium', size,
      ...(fitting && refs.length && (model === 'gpt-image-1.5' || model === 'gpt-image-1') ? {input_fidelity:'high'} : {}), output_format: 'jpeg',
    }),
  });
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    const raw = String(json?.error?.code || json?.error?.type || 'rejected').toLowerCase();
    const code = /^[a-z0-9_]{1,70}$/.test(raw) ? raw : 'rejected';
    throw new Error('openai_' + response.status + '_' + code);
  }
  const image = json?.data?.[0]?.b64_json;
  if (typeof image !== 'string' || image.length < 100 || image.length > 20000000) throw new Error('openai_invalid_output');
  const photo = sharp(Buffer.from(image, 'base64'), { limitInputPixels: 16000000 }).rotate();
  if (width && height) {
    const scale = Math.min(1536 / Math.max(width, height), 1024 / Math.min(width, height));
    photo.resize(Math.round(width * scale), Math.round(height * scale), { fit: 'cover' });
  } else {
    photo.resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true });
  }
  return photo.jpeg({ quality: fitting ? 94 : 88 }).toBuffer();
}
